'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { IDOS_CONFIG } from '../lib/collection/gateway';
import type { IDosRuntime, IDosSession } from '../lib/idos/client';
import { useImperivmWallet } from './WalletContext';
import type {ProfileIdentity, WalletProfile} from '../lib/idos/profile';
import {WalletProfileStore, type WalletProfileScope} from '../lib/idos/profileState';

type IDosState = { runtime: IDosRuntime | null; session: IDosSession; embedded: boolean; configured: boolean; busy: boolean; login: () => Promise<void>; logout: () => Promise<void>; retry: () => Promise<void>; profile: WalletProfile | null; profileIdentity: ProfileIdentity | null; profileLoading: boolean; profileError: string | null; refreshProfile: () => Promise<void>; confirmProfile: (profile: WalletProfile) => void };
const Context = createContext<IDosState | null>(null);
export function useIDos() { const value = useContext(Context); if (!value) throw new Error('IDosContext is missing'); return value; }
export default function IDosContext({ children }: { children: React.ReactNode }) {
  const wallet = useImperivmWallet();
  const [runtime, setRuntime] = useState<IDosRuntime | null>(null);
  const [session, setSession] = useState<IDosSession>({ status: IDOS_CONFIG.title ? 'connecting' : 'demo', owner: null, userId: null, error: null, revision: 0 });
  const [embedded, setEmbedded] = useState(false), [busy, setBusy] = useState(false);
  const lock = useRef(false), currentWallet = useRef(wallet); currentWallet.current = wallet;
  const [profileStore] = useState(() => new WalletProfileStore());
  const profileState = useSyncExternalStore(profileStore.subscribe, profileStore.getSnapshot, profileStore.getServerSnapshot);
  const profileScope: WalletProfileScope | null = session.status === 'wallet' && session.owner && session.userId && (!wallet.owner || session.owner === wallet.owner || embedded)
    ? {owner: session.owner, userId: session.userId, revision: session.revision} : null;
  const profileKey = profileScope ? JSON.stringify([profileScope.owner, profileScope.userId, profileScope.revision]) : '';
  const currentProfileKey = useRef(profileKey); currentProfileKey.current = profileKey;
  const refreshProfile = useCallback(async () => {
    if (!runtime || !profileScope || currentProfileKey.current !== profileKey) return;
    await profileStore.load(profileScope, identity => runtime.profile(identity));
  // The key includes owner, account and login revision; old callbacks cannot reactivate an old identity.
  }, [runtime, profileStore, profileKey]);
  const confirmProfile = useCallback((profile: WalletProfile) => {
    if (profileScope && currentProfileKey.current === profileKey) profileStore.confirm(profileScope, profile);
  }, [profileStore, profileKey]);
  useEffect(() => {
    profileStore.activate(profileScope);
    if (profileScope) void refreshProfile();
  }, [profileStore, profileKey, refreshProfile]);
  useEffect(() => {
    const changed = () => {void refreshProfile();};
    window.addEventListener('imperivm:profile-changed', changed);
    return () => window.removeEventListener('imperivm:profile-changed', changed);
  }, [refreshProfile]);
  const restoreOwner = useCallback(async () => {
    const {isEmbeddedInPlatform, PLATFORM_WALLET_MESSAGES} = await import('@idosgames/wallet');
    if (isEmbeddedInPlatform()) {
      const [{askPlatformPage}, {readPlatformSolanaWallet}] = await Promise.all([import('@idosgames/core'), import('../lib/idos/auth')]);
      try {return await readPlatformSolanaWallet({titleID: IDOS_CONFIG.title ?? '', messages: PLATFORM_WALLET_MESSAGES, ask: askPlatformPage});} catch {return null;}
    }
    return currentWallet.current.owner ?? await currentWallet.current.restore();
  }, []);
  useEffect(() => {
    if (!IDOS_CONFIG.title) return;
    let cancelled = false, off = () => {}, platformOff = () => {};
    void import('../lib/idos/client').then(({ getIDosRuntime }) => {
      if (cancelled) return;
      const client = getIDosRuntime(); if (!client) return;
      setRuntime(client); setSession(client.getSnapshot());
      off = client.subscribe(() => { if (!cancelled) setSession(client.getSnapshot()); });
      void client.start(restoreOwner).catch(() => { /* backend error is visible; demo remains available */ });
    }).catch(() => { if (!cancelled) setSession({ status: 'error', error: 'iDos SDK unavailable. Choose local demo.', owner: null, userId: null, revision: 0 }); });
    void import('@idosgames/wallet').then(({ isEmbeddedInPlatform, onWalletBalanceChanged }) => {
      if (!cancelled) setEmbedded(isEmbeddedInPlatform());
      // Balances will be refreshed on demand in the collection; never trust postMessage amounts.
      if (!cancelled) platformOff = onWalletBalanceChanged(() => window.dispatchEvent(new Event('imperivm:idos-balance')));
    }).catch(() => { /* Standalone Phantom login remains available if the platform bridge fails. */ });
    return () => { cancelled = true; off(); platformOff(); };
  }, [restoreOwner]);
  const previousOwner = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousOwner.current; previousOwner.current = wallet.owner;
    if (runtime?.getSnapshot().owner && !embedded && ((wallet.owner && wallet.owner !== runtime.getSnapshot().owner) || (previous && !wallet.owner)) && !lock.current) void runtime.disconnect().catch(() => {});
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
  async function retry() { if (runtime) try { await runtime.start(restoreOwner); } catch {} }
  const matchingProfile = profileStore.matches(profileScope);
  return <Context.Provider value={{ runtime, session, embedded, configured: !!IDOS_CONFIG.title, busy: busy || session.status === 'connecting', login, logout, retry,
    profile: matchingProfile ? profileState.profile : null, profileIdentity: profileScope,
    profileLoading: !!profileScope && (!matchingProfile || profileState.loading), profileError: matchingProfile ? profileState.error : null, refreshProfile, confirmProfile }}>{children}</Context.Provider>;
}
