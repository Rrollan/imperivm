'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useImperivmWallet } from './WalletContext';
import { genesisDeployment, type GenesisDeployment } from '../lib/solana/deployment';
import { nftCounts, type OwnedCardNFT } from '../lib/solana/ownership';
import { GENESIS_IDS } from '../lib/solana/metadata';
import { isAddress } from '@solana/kit';
import { metadataBase } from '../lib/solana/metadata';
export function nftScope(owner: string | null, deployment: GenesisDeployment | null): string {
  return JSON.stringify([owner ?? '', deployment?.metadataOrigin ?? metadataBase() ?? '', deployment?.collection ?? '', deployment?.candyMachine ?? '']);
}
export function confirmedNftMatchesScope(card: OwnedCardNFT, expectedScope: string, currentScope: string, owner: string | null): boolean {
  return !!owner && card.owner === owner && expectedScope === currentScope && isAddress(card.address) && GENESIS_IDS.includes(card.cardId);
}
type CoreReader = (owner: string, deployment: GenesisDeployment) => Promise<OwnedCardNFT[]>;
/** A unavailable/throttled/malformed DAS proxy always falls back to confirmed Core RPC reads. */
export async function readNftCards(owner: string, deployment: GenesisDeployment, readCore: CoreReader = async (address, scope) =>
  (await import('../lib/solana/ownedCore')).ownedCoreCards(address, scope)): Promise<{ cards: OwnedCardNFT[]; partial: boolean }> {
  if (process.env.NEXT_PUBLIC_GENESIS_COLLECTION !== deployment.collection || metadataBase() !== deployment.metadataOrigin) return { cards: await readCore(owner, deployment), partial: false };
  try {
    const response = await fetch(`/api/nft/owned?owner=${encodeURIComponent(owner)}`, { signal: AbortSignal.timeout(45_000), cache: 'no-store' });
    if (!response.ok) throw new Error('DAS unavailable');
    const data = await response.json();
    if (!Array.isArray(data.cards) || data.cards.length > 500) throw new Error('Invalid DAS response');
    const cards = data.cards.filter((c: OwnedCardNFT) => c && c.owner === owner && GENESIS_IDS.includes(c.cardId) && isAddress(c.address) && typeof c.compressed === 'boolean' && ['das', 'core-rpc'].includes(c.source));
    if (cards.length !== data.cards.length) throw new Error('Invalid DAS card');
    return { cards, partial: data.partial === true };
  } catch { return { cards: await readCore(owner, deployment), partial: false }; }
}
type NftState = { deployment: GenesisDeployment | null; scope: string; cards: OwnedCardNFT[]; counts: Record<string, number>; busy: boolean; error: string | null; refresh: () => Promise<void>; acceptConfirmed: (card: OwnedCardNFT, expectedScope: string) => boolean; };
const Context = createContext<NftState | null>(null);
export function useNfts() { const value = useContext(Context); if (!value) throw new Error('NFT context is missing'); return value; }
export default function NftContext({ children }: { children: React.ReactNode }) {
  const wallet = useImperivmWallet();
  const [deployment, setDeployment] = useState<GenesisDeployment | null>(null), [records, setRecords] = useState<{ scope: string; cards: OwnedCardNFT[] }>({ scope: '', cards: [] });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const scope = nftScope(wallet.owner, deployment);
  const epoch = useRef(0), currentOwner = useRef(wallet.owner), currentScope = useRef(scope);
  currentOwner.current = wallet.owner; currentScope.current = scope;
  useEffect(() => {
    const update = () => { const next = genesisDeployment(); currentScope.current = nftScope(currentOwner.current, next); epoch.current++; setDeployment(next); };
    update(); window.addEventListener('imperivm:deployment', update); window.addEventListener('storage', update);
    return () => { epoch.current++; window.removeEventListener('imperivm:deployment', update); window.removeEventListener('storage', update); };
  }, []);
  const refresh = useCallback(async () => {
    const owner = wallet.owner, expectedScope = nftScope(owner, deployment), ticket = ++epoch.current;
    setRecords({ scope: expectedScope, cards: [] }); setError(null);
    if (!owner || !deployment) { setBusy(false); return; }
    setBusy(true);
    try {
      const { cards, partial } = await readNftCards(owner, deployment);
      if (epoch.current === ticket && currentScope.current === expectedScope) {
        setRecords({ scope: expectedScope, cards });
        if (partial) setError('Showing the first 500 wallet assets. Some cards may require a later refresh.');
      }
    } catch { if (epoch.current === ticket && currentScope.current === expectedScope) setError('Could not read devnet NFTs. Check collection configuration and retry. Demo cards remain playable.'); }
    finally { if (epoch.current === ticket && currentScope.current === expectedScope) setBusy(false); }
  }, [wallet.owner, deployment]);
  useEffect(() => { void refresh(); return () => { epoch.current++; }; }, [refresh]);
  function acceptConfirmed(card: OwnedCardNFT, expectedScope: string) {
    if (!confirmedNftMatchesScope(card, expectedScope, currentScope.current, currentOwner.current)) return false;
    epoch.current++; setBusy(false);
    setRecords(old => ({ scope: expectedScope, cards: [...(old.scope === expectedScope ? old.cards.filter(c => c.address !== card.address) : []), card] }));
    return true;
  }
  const cards = records.scope === scope ? records.cards : [];
  return <Context.Provider value={{ deployment, scope, cards, counts: nftCounts(cards), busy, error, refresh, acceptConfirmed }}>{children}</Context.Provider>;
}
