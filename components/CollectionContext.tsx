'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IDOS_CONFIG, LocalCollectionGateway, type CollectionGateway, type CollectionSnapshot, type PackResult } from '../lib/collection/gateway';
type CollectionState = { snapshot: CollectionSnapshot | null; busy: boolean; error: string | null; refresh: () => Promise<void>; openPack: () => Promise<PackResult>; useLocalDemo: () => Promise<void>; };
const Context = createContext<CollectionState | null>(null);
export function useCollection() { const value = useContext(Context); if (!value) throw new Error('CollectionContext is missing'); return value; }
export default function CollectionContext({ children }: { children: React.ReactNode }) {
  const gateway = useRef<CollectionGateway | null>(null), lock = useRef(false);
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const constructLocal = () => { let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* memory only */ } return new LocalCollectionGateway(storage); };
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (!gateway.current) gateway.current = IDOS_CONFIG.title ? new (await import('../lib/collection/idos')).IDosCollectionGateway() : constructLocal();
      setSnapshot(await gateway.current.load());
    } catch (e) { setError(e instanceof Error ? e.message : 'Collection unavailable.'); }
    finally { lock.current = false; setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const changed = () => { if (gateway.current instanceof LocalCollectionGateway) void refresh(); };
    window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed);
  }, [refresh]);
  async function openPack() {
    if (lock.current || !gateway.current) throw new Error('The collection is loading.');
    lock.current = true; setBusy(true); setError(null);
    try { const result = await gateway.current.openPack(); setSnapshot(result.snapshot); return result; }
    catch (e) { const message = e instanceof Error ? e.message : 'Pack unavailable.'; setError(message); throw new Error(message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function useLocalDemo() { if (lock.current) return; gateway.current = constructLocal(); setSnapshot(null); await refresh(); }
  return <Context.Provider value={{ snapshot, busy, error, refresh, openPack, useLocalDemo }}>{children}</Context.Provider>;
}

