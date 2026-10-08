import { createIDosGamesClient, type IDosGamesClient, type GetLeaderboardResponse } from '@idosgames/core';
import { BrowserPlatformAdapter } from '@idosgames/core/platform';
import { IDOS_CONFIG } from '../collection/gateway';
import { authenticateSolanaWallet, idosResult, SessionQueue } from './auth';
import { DEVNET_RPC } from '../solana/devnet';
import type {CollectionAuth} from '../collection/access';

export type IDosSession = { status: 'demo' | 'connecting' | 'guest' | 'wallet' | 'restricted' | 'error'; owner: string | null; userId: string | null; error: string | null; revision: number };
export type IDosStandings = { board: GetLeaderboardResponse; ownScore: number };

export class IDosRuntime {
  private readonly client: IDosGamesClient;
  private readonly queue = new SessionQueue();
  private listeners = new Set<() => void>();
  private session: IDosSession = { status: 'demo', owner: null, userId: null, error: null, revision: 0 };
  constructor(title: string) {
    this.client = createIDosGamesClient({ titleID: title, platform: new BrowserPlatformAdapter(), debugLogging: false });
    // Session credentials stay in this tab. A different Phantom account never inherits a remembered login.
    this.client.auth.setRememberSession(false);
    this.client.on('playAccess:required', () => this.publish({ ...this.session, status: 'restricted' }));
    this.client.on('playAccess:changed', pass => {
      if (pass?.Granted === false) this.publish({ ...this.session, status: 'restricted' });
    });
  }
  getSnapshot = () => this.session;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: IDosSession) { this.session = value; this.listeners.forEach(fn => fn()); }
  private async authenticate(owner: string | null, login: () => Promise<unknown>) {
    return this.queue.run(async () => {
      this.queue.change();
      this.publish({ status: 'connecting', owner: null, userId: null, error: null, revision: this.queue.revision });
      this.client.auth.logout();
      this.embeddedOwner = null;
      try {
        await login();
        if (owner || this.embeddedOwner) {
          const defs = idosResult(await this.client.blockchain.getDefinitions());
          const network = defs.Blockchain?.Networks?.[IDOS_CONFIG.network];
          if (network?.Type !== 'Solana' || network.RpcUrl?.replace(/\/$/, '') !== DEVNET_RPC) throw new Error('Configure the iDos login network with the Solana devnet RPC. The IMP shop has a separate mainnet configuration.');
        }
        const pass = this.client.auth.playAccess;
        const address = owner ?? this.embeddedOwner;
        this.publish({ status: pass?.Granted === false ? 'restricted' : address ? 'wallet' : 'guest', owner: address,
          userId: this.client.auth.context?.userID ?? null, error: pass?.Granted === false ? pass.Error ?? 'iDos play access is required.' : null, revision: this.queue.revision });
      } catch (error) {
        this.client.auth.logout();
        this.publish({ status: 'error', owner: null, userId: null, error: error instanceof Error ? error.message : 'iDos login unavailable.', revision: this.queue.revision });
        throw error;
      }
    });
  }
  async guest() {
    if (this.session.status === 'guest') return;
    await this.authenticate(null, async () => idosResult(await this.client.auth.loginWithDeviceID()));
  }
  async loginWallet(owner: string, sign: (message: Uint8Array, expectedOwner: string) => Promise<Uint8Array>) {
    await this.authenticate(owner, () => authenticateSolanaWallet(this.client.auth, owner, IDOS_CONFIG.network, sign));
  }
  async loginEmbedded() {
    await this.authenticate(null, async () => {
      const { loginWithWalletViaPlatform } = await import('@idosgames/wallet');
      const result = await loginWithWalletViaPlatform({ client: this.client, networkID: IDOS_CONFIG.network, family: 'solana' });
      if (!result.ok) throw new Error(`iDos ${result.stage}: ${result.error}`);
      const linked = this.client.data.user.state?.Blockchain?.LastWalletLogin;
      if (linked?.NetworkID !== IDOS_CONFIG.network || !linked.Address) throw new Error('iDos did not return the connected Solana wallet.');
      // authenticate() reads this only after the backend verified the platform signature.
      this.embeddedOwner = linked.Address;
    });
  }
  private embeddedOwner: string | null = null;
  private starting: Promise<void> | null = null;
  start() { return this.starting ??= this.guest(); }
  async disconnect() { await this.authenticate(null, async () => idosResult(await this.client.auth.loginWithDeviceID())); }
  withAccount<T>(work: (client: IDosGamesClient) => Promise<T>) {
    return this.queue.forAccount(async () => {
      if (!this.client.auth.isLoggedIn || !['guest', 'wallet'].includes(this.session.status)) throw new Error('Sign in to iDos or choose local demo.');
      return work(this.client);
    });
  }
  collectionAuth(): Promise<CollectionAuth> {
    return this.withAccount(async client => {
      const auth = client.auth.context;
      if (!auth) throw new Error('Sign in to iDos to use pack cards online.');
      return {userId: auth.userID, sessionTicket: auth.clientSessionTicket};
    });
  }
  async standings(): Promise<IDosStandings> {
    if (!IDOS_CONFIG.leaderboard) throw new Error('iDos leaderboard is not configured.');
    return this.withAccount(async client => ({ board: idosResult(await client.leaderboard.getLeaderboard(IDOS_CONFIG.leaderboard)), ownScore: idosResult(await client.leaderboard.getMyProgress(IDOS_CONFIG.leaderboard)).CurrentScore ?? 0 }));
  }
  async publishPracticeWins(wins: number) {
    if (!Number.isSafeInteger(wins) || wins < 1) throw new Error('No signed practice wins to publish.');
    return this.withAccount(async client => {
      if (this.session.status !== 'wallet') throw new Error('Sign in with your wallet before publishing wins.');
      const defs = idosResult(await client.leaderboard.getDefinitions());
      const board = defs.Definitions?.[IDOS_CONFIG.leaderboard];
      // BestScore makes retries idempotent. No ranked rewards for client-reported AI games.
      if (!board?.IsEnabled || board.ScoreAggregation !== 'BestScore' || board.RankRewards?.length || Object.keys(board.Milestones ?? {}).length || board.Presets?.RankRewards || board.Presets?.Milestones) throw new Error('Configure a BestScore practice leaderboard without rewards.');
      return idosResult(await client.leaderboard.submitScore(IDOS_CONFIG.leaderboard, wins)).NewScore;
    });
  }
}

let runtime: IDosRuntime | null = null;
/** One client for the app, created only in the browser; collection adapters never create clients. */
export function getIDosRuntime(): IDosRuntime | null {
  if (typeof window === 'undefined' || !IDOS_CONFIG.title) return null;
  return runtime ??= new IDosRuntime(IDOS_CONFIG.title);
}
