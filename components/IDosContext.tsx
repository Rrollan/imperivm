'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { IDOS_CONFIG } from '../lib/collection/gateway';
import type { IDosRuntime, IDosSession } from '../lib/idos/client';
import { useImperivmWallet } from './WalletContext';

type IDosState = { runtime: IDosRuntime | null; session: IDosSession; embedded: boolean; configured: boolean; busy: boolean; login: () => Promise<void>; logout: () => Promise<void>; retry: () => Promise<void> };
const Context = createContext<IDosState | null>(null);
export function useIDos() { const value = useContext(Context); if (!value) throw new Error('IDosContext is missing'); return value; }
export default function IDosContext({ children }: { children: React.ReactNode }) {
  const wallet = useImperivmWallet();
  const [runtime, setRuntime] = useState<IDosRuntime | null>(null);
  const [session, setSession] = useState<IDosSession>({ status: IDOS_CONFIG.title ? 'connecting' : 'demo', owner: null, userId: null, error: null, revision: 0 });
  const [embedded, setEmbedded] = useState(false), [busy, setBusy] = useState(false);
  const lock = useRef(false), currentWallet = useRef(wallet); currentWallet.current = wallet;
  useEffect(() => {
    if (!IDOS_CONFIG.title) return;
    let cancelled = false, off = () => {}, platformOff = () => {};
    void import('../lib/idos/client').then(({ getIDosRuntime }) => {
      if (cancelled) return;
      const client = getIDosRuntime(); if (!client) return;
      setRuntime(client); setSession(client.getSnapshot());
      off = client.subscribe(() => { if (!cancelled) setSession(client.getSnapshot()); });
      void client.start().catch(() => { /* backend error is visible; demo remains available */ });
    }).catch(() => { if (!cancelled) setSession({ status: 'error', error: 'iDos SDK unavailable. Choose local demo.', owner: null, userId: null, revision: 0 }); });
    void import('@idosgames/wallet').then(({ isEmbeddedInPlatform, onWalletBalanceChanged }) => {
      if (!cancelled) setEmbedded(isEmbeddedInPlatform());
      // Balances will be refreshed on demand in the collection; never trust postMessage amounts.
      if (!cancelled) platformOff = onWalletBalanceChanged(() => window.dispatchEvent(new Event('imperivm:idos-balance')));
    }).catch(() => { /* Standalone Phantom login remains available if the platform bridge fails. */ });
    return () => { cancelled = true; off(); platformOff(); };
  }, []);
  useEffect(() => {
    if (runtime?.getSnapshot().owner && !embedded && wallet.owner !== runtime.getSnapshot().owner && !lock.current) void runtime.disconnect().catch(() => {});
  }, [wallet.owner, runtime, embedded]);
  async function login() {
    if (!runtime || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (embedded) await runtime.loginEmbedded();
      else {
        const owner = currentWallet.current.owner ?? await currentWallet.current.connect();
        if (!owner) return;
        await runtime.loginWallet(owner, currentWallet.current.signMessage);
        // The wallet may switch while the verified challenge is being exchanged by the backend.
        if (currentWallet.current.owner !== owner) await runtime.disconnect();
      }
    } catch { /* runtime / Phantom exposes the actual error */ }
    finally { lock.current = false; setBusy(false); }
  }
  async function logout() {
    if (!runtime || lock.current) return;
    lock.current = true; setBusy(true);
    try { await runtime.disconnect(); } catch { /* guest access may be disabled by the title */ }
    finally { lock.current = false; setBusy(false); }
  }
  async function retry() { if (runtime) try { await runtime.guest(); } catch {} }
  return <Context.Provider value={{ runtime, session, embedded, configured: !!IDOS_CONFIG.title, busy: busy || session.status === 'connecting', login, logout, retry }}>{children}</Context.Provider>;
}
