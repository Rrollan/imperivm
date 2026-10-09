'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LocalCollectionGateway, type CollectionGateway, type CollectionSnapshot, type RulerCaseResult, type PackResult } from '../lib/collection/gateway';
import { useIDos } from './IDosContext';
import {deckError} from '../lib/engine/deckValidation';
import {isFreeHero} from '../lib/heroes';
import {needsCollection, deckCardCounts, freeCardCounts, type CollectionAuth} from '../lib/collection/access';

type CollectionState = { snapshot: CollectionSnapshot | null; busy: boolean; error: string | null; refresh: () => Promise<void>; openPack: () => Promise<PackResult>; openRulerCase:()=>Promise<RulerCaseResult>; useLocalDemo: () => Promise<void>; authorizeDeck: (deck: string[],hero?:string) => Promise<CollectionAuth | undefined> };
const Context = createContext<CollectionState | null>(null);
export function useCollection() { const value = useContext(Context); if (!value) throw new Error('CollectionContext is missing'); return value; }
function localGateway() { let storage: Storage | undefined; try { storage = window.localStorage; } catch {} return new LocalCollectionGateway(storage); }
export default function CollectionContext({ children }: { children: React.ReactNode }) {
  const idos = useIDos();
  const [localRevision, setLocalRevision] = useState<number | null>(null);
  const scope = useRef<{ gateway: CollectionGateway | null; version: number; locked: boolean }>({ gateway: null, version: 0, locked: false });
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const captured = scope.current;
    if (!captured.gateway || captured.locked) return;
    captured.locked = true; setBusy(true); setError(null);
    try { const result = await captured.gateway.load(); if (scope.current === captured) setSnapshot(result); }
    catch (e) { if (scope.current === captured) setError(e instanceof Error ? e.message : 'Collection unavailable.'); }
    finally { captured.locked = false; if (scope.current === captured) setBusy(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    const next = { gateway: null as CollectionGateway | null, version: scope.current.version + 1, locked: false };
    scope.current = next; setSnapshot(null); setError(null);
    const local = !idos.configured || localRevision === idos.session.revision;
    if (local) { next.gateway = localGateway(); void refresh(); }
    else if (idos.runtime && ['guest', 'wallet'].includes(idos.session.status)) {
      setBusy(true);
      void import('../lib/collection/idos').then(({ IDosCollectionGateway }) => { if (!cancelled) { next.gateway = new IDosCollectionGateway(idos.runtime!); void refresh(); } })
        .catch(() => { if (!cancelled) { setBusy(false); setError('iDos collection unavailable.'); } });
    } else { setBusy(idos.session.status === 'connecting'); setError(idos.session.error); }
    return () => { cancelled = true; };
  }, [idos.runtime, idos.configured, idos.session.revision, idos.session.status, idos.session.error, localRevision, refresh]);
  useEffect(() => {
    const changed = () => { void refresh(); };
    window.addEventListener('storage', changed); window.addEventListener('imperivm:idos-balance', changed);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('imperivm:idos-balance', changed); };
  }, [refresh]);
  async function openPack() {
    const captured = scope.current;
    if (captured.locked || !captured.gateway) throw new Error('The collection is loading.');
    captured.locked = true; setBusy(true); setError(null);
    try {
      const result = await captured.gateway.openPack();
      if (scope.current !== captured) throw new Error('iDos account changed. Refresh your collection to see the processed pack.');
      setSnapshot(result.snapshot); return result;
    } catch (e) { const message = e instanceof Error ? e.message : 'Pack unavailable.'; if (scope.current === captured) setError(message); throw new Error(message); }
    finally { captured.locked = false; if (scope.current === captured) setBusy(false); }
  }
  async function openRulerCase(){
    const captured=scope.current;if(captured.locked||!captured.gateway)throw new Error('The collection is loading.');
    captured.locked=true;setBusy(true);setError(null);
    try{const result=await captured.gateway.openRulerCase();if(scope.current!==captured)throw new Error('Аккаунт изменился. Обновите коллекцию, чтобы увидеть результат кейса.');setSnapshot(result.snapshot);return result;}
    catch(e){const message=e instanceof Error?e.message:'Кейс недоступен.';if(scope.current===captured)setError(message);throw new Error(message);}
    finally{captured.locked=false;if(scope.current===captured)setBusy(false);}
  }
  async function useLocalDemo() { setLocalRevision(idos.session.revision); }
  async function authorizeDeck(deck: string[],hero='builder'): Promise<CollectionAuth | undefined> {
    if (!needsCollection(deck)&&isFreeHero(hero)) {const problem = deckError(deck, freeCardCounts()); if (problem) throw new Error(problem); return undefined;}
    const captured = scope.current;
    if (!captured.gateway || captured.locked) throw new Error('The collection is loading.');
    const current = await captured.gateway.load();
    if (scope.current !== captured) throw new Error('The account changed. Please choose the deck again.');
    if(!isFreeHero(hero)&&!current.heroes?.includes(hero))throw new Error('Этот правитель ещё не получен из кейса.');
    const problem = deckError(deck, deckCardCounts(current.owned)); if (problem) throw new Error(problem);
    if (current.mode !== 'idos' || !idos.runtime) throw new Error('Pack cards in online matches require iDos. Use the free starter deck or sign in to iDos.');
    const auth = await idos.runtime.collectionAuth();
    if (scope.current !== captured) throw new Error('The account changed. Please choose the deck again.');
    return auth;
  }
  return <Context.Provider value={{ snapshot, busy, error, refresh, openPack, openRulerCase, useLocalDemo, authorizeDeck }}>{children}</Context.Provider>;
}
