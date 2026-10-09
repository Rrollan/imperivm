'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import type { StandardConnectFeature, StandardDisconnectFeature, StandardEventsFeature } from '@wallet-standard/features';
import type { SolanaSignMessageFeature, SolanaSignTransactionFeature } from '@solana/wallet-standard-features';
import { DEVNET_CHAIN, readDevnetBalance } from '../lib/solana/devnet';
import { bytesToBase64, proofMessage, verifyPlaySignature, type PlayProof } from '../lib/solana/proof';
import {playProofEnabled} from '../lib/solana/features';
const walletChain = () => playProofEnabled() ? DEVNET_CHAIN : 'solana:mainnet';

type Phantom = Omit<Wallet, 'features'> & { features: Wallet['features'] & StandardConnectFeature & StandardEventsFeature & Partial<StandardDisconnectFeature> & Partial<SolanaSignMessageFeature> & Partial<SolanaSignTransactionFeature> };
type WalletState = {
  owner: string | null; balance: number | null; installed: boolean; busy: boolean; error: string | null;
  connect: () => Promise<string | null>; disconnect: () => Promise<void>; refresh: () => Promise<void>;
  signMessage: (message: Uint8Array, expectedOwner: string) => Promise<Uint8Array>;
  signPlay: (matchId: string, heroId: string) => Promise<PlayProof>;
  signTransaction: (bytes: Uint8Array, expectedOwner: string) => Promise<Uint8Array>;
};
const Context = createContext<WalletState | null>(null);
export function useImperivmWallet() {
  const value = useContext(Context);
  if (!value) throw new Error('WalletContext is missing');
  return value;
}
export default function WalletContext({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Phantom | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [installed, setInstalled] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const liveWallet = useRef<Phantom | null>(null);
  const liveAccount = useRef(account); liveAccount.current = account;
  useEffect(() => {
    const registry = getWallets();
    const discover = () => setInstalled(registry.get().some(w => w.name.toLowerCase() === 'phantom' && 'standard:connect' in w.features));
    discover();
    const offRegister = registry.on('register', discover), offUnregister = registry.on('unregister', discover);
    return () => { offRegister(); offUnregister(); };
  }, []);
  useEffect(() => {
    if (!wallet) return;
    return wallet.features['standard:events'].on('change', change => {
      if (change.accounts) { const next = change.accounts.find(a => a.chains.includes(walletChain())) ?? null; liveAccount.current = next; setAccount(next); setBalance(null); setError(null); }
    });
  }, [wallet]);
  const owner = account?.address ?? null;
  const refresh = useCallback(async () => {
    const captured = liveAccount.current?.address;
    if (!captured) return;
    try {
      const amount = await readDevnetBalance(captured);
      if (liveAccount.current?.address === captured) { setBalance(amount); setError(null); }
    } catch { if (liveAccount.current?.address === captured) setError('Devnet balance unavailable. Retry when the RPC responds.'); }
  }, []);
  useEffect(() => { setBalance(null); if (owner && playProofEnabled()) void refresh(); }, [owner, refresh]);
  async function connect() {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(null);
    try {
      const candidate = getWallets().get().find(w => w.name.toLowerCase() === 'phantom' && 'standard:connect' in w.features && 'standard:events' in w.features) as Phantom | undefined;
      if (!candidate) throw new Error('Install Phantom to connect. Demo play is always available.');
      const result = await candidate.features['standard:connect'].connect();
      const selected = result.accounts.find(a => a.chains.includes(walletChain()));
      if (!selected) throw new Error('This wallet account does not support the required Solana network.');
      liveWallet.current = candidate; liveAccount.current = selected; setWallet(candidate); setAccount(selected);
      return selected.address;
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection declined. Continue in demo mode.'); return null; }
    finally { lock.current = false; setBusy(false); }
  }
  async function disconnect() {
    // Clear local state even if the extension no longer responds.
    const previous = wallet;
    liveAccount.current = null; liveWallet.current = null; setAccount(null); setWallet(null); setBalance(null); setError(null);
    try { await previous?.features['standard:disconnect']?.disconnect(); } catch { /* already disconnected locally */ }
  }
  async function signMessage(bytes: Uint8Array, expectedOwner: string): Promise<Uint8Array> {
    const selected = liveAccount.current, feature = liveWallet.current?.features['solana:signMessage'];
    if (!selected || selected.address !== expectedOwner || !feature) throw new Error('Connect the same Phantom account to sign in.');
    if (lock.current) throw new Error('A wallet request is already open.');
    lock.current = true; setBusy(true);
    try {
      const [result] = await feature.signMessage({ account: selected, message: bytes });
      if (liveAccount.current?.address !== expectedOwner) throw new Error('Wallet changed. Please sign in again.');
      if (!result || !verifyPlaySignature(bytes, result.signedMessage, result.signature, Uint8Array.from(selected.publicKey))) throw new Error('The wallet signature did not verify.');
      return result.signature;
    } finally { lock.current = false; setBusy(false); }
  }
  async function signPlay(matchId: string, heroId: string): Promise<PlayProof> {
    const selected = liveAccount.current;
    const feature = wallet?.features['solana:signMessage'];
    if (!selected || !feature) throw new Error('Message signing is unavailable. Continue in demo mode.');
    if (lock.current) throw new Error('A wallet request is already open.');
    lock.current = true; setBusy(true);
    try {
      const createdAt = new Date().toISOString();
      const nonce = crypto.randomUUID();
      const message = proofMessage(window.location.host, matchId, heroId, nonce, createdAt);
      const bytes = new TextEncoder().encode(message);
      const [result] = await feature.signMessage({ account: selected, message: bytes });
      if (liveAccount.current?.address !== selected.address) throw new Error('Wallet changed. This match remains a demo.');
      if (!result || !verifyPlaySignature(bytes, result.signedMessage, result.signature, Uint8Array.from(selected.publicKey))) throw new Error('The wallet signature did not verify.');
      return { matchId, owner: selected.address, heroId, message, signature: bytesToBase64(result.signature), createdAt };
    } finally { lock.current = false; setBusy(false); }
  }
  async function signTransaction(bytes: Uint8Array, expectedOwner: string) {
    const selected = liveAccount.current;
    const feature = wallet?.features['solana:signTransaction'];
    if (!selected || selected.address !== expectedOwner || !feature) throw new Error('Connect the same Phantom account to approve this devnet transaction.');
    if (!selected.chains.includes(DEVNET_CHAIN)) throw new Error('This account does not support Solana devnet.');
    if (lock.current) throw new Error('A wallet request is already open.');
    if (!feature.supportedTransactionVersions.includes(0)) throw new Error('This wallet does not support v0 transactions.');
    lock.current = true; setBusy(true);
    try {
      const [result] = await feature.signTransaction({ account: selected, transaction: bytes, chain: DEVNET_CHAIN, options: { preflightCommitment: 'confirmed' } });
      if (!result || liveAccount.current?.address !== expectedOwner) throw new Error('Wallet changed while signing. Transaction was not sent.');
      return result.signedTransaction;
    } finally { lock.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ owner, balance, installed, busy, error, connect, disconnect, refresh, signPlay, signMessage, signTransaction }}>{children}</Context.Provider>;
}
