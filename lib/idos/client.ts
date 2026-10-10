import { createIDosGamesClient, askPlatformPage, type IDosGamesClient, type GetLeaderboardResponse } from '@idosgames/core';
import { BrowserPlatformAdapter } from '@idosgames/core/platform';
import { IDOS_CONFIG } from '../collection/gateway';
import { authenticateSolanaWallet, authenticatePlatformSolanaWallet, idosResult, SessionQueue } from './auth';
import {IMPERIVM_TITLE} from './title';
import {validateImpToken} from './token';
import type {CollectionAuth} from '../collection/access';
import {WalletProfileService, type ProfileIdentity, type ProfileAvatar} from './profile';
import {WalletSessionMemory, solanaAddress} from './session';
import {browserLocks} from '../browserLocks';

export type IDosSession = { status: 'demo' | 'connecting' | 'guest' | 'wallet' | 'restricted' | 'error'; owner: string | null; userId: string | null; error: string | null; revision: number };
export type IDosStandings = { board: GetLeaderboardResponse; ownScore: number };

export class IDosRuntime {
  private readonly client: IDosGamesClient;
  private readonly queue = new SessionQueue();
  private listeners = new Set<() => void>();
  private session: IDosSession = { status: 'demo', owner: null, userId: null, error: null, revision: 0 };
  private memory: WalletSessionMemory;
  constructor(title: string, client?: IDosGamesClient, memory?: WalletSessionMemory) {
    this.client = client ?? createIDosGamesClient({ titleID: title, platform: new BrowserPlatformAdapter(), debugLogging: false });
    this.memory = memory ?? new WalletSessionMemory(title, IDOS_CONFIG.network);
    // Official SDK refresh tokens restore the authenticated account without replaying a wallet signature.
    this.client.auth.setRememberSession(true);
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
      this.memory.clear();
      this.embeddedOwner = null;
      try {
        await login();
        if (owner || this.embeddedOwner) {
          const defs = idosResult(await this.client.blockchain.getDefinitions());
          const network = defs.Blockchain?.Networks?.[IDOS_CONFIG.network];
          // A wallet login signs a challenge, not a transaction. Pool/RPC details may be
          // supplied by the platform registry; they need not appear in title config.
          if (network?.Type !== 'Solana') throw new Error('Configure the iDos wallet login network as Solana.');
        }
        const pass = this.client.auth.playAccess;
        const address = owner ?? this.embeddedOwner;
        if (address && this.client.auth.context?.userID) this.memory.save(address, this.client.auth.context.userID);
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
      const { PLATFORM_WALLET_MESSAGES } = await import('@idosgames/wallet');
      // askPlatformPage validates the platform origin and correlated replies. The backend
      // exchanges a fresh wallet challenge before this address can become the session owner.
      this.embeddedOwner = await authenticatePlatformSolanaWallet({auth: this.client.auth,
        titleID: this.client.titleID, network: IDOS_CONFIG.network,
        messages: PLATFORM_WALLET_MESSAGES, ask: askPlatformPage});
    });
  }
  private embeddedOwner: string | null = null;
  private starting: Promise<void> | null = null;
  start(currentOwner: () => Promise<string | null> = async () => null) {
    if (this.starting) return this.starting;
    if (['wallet', 'guest', 'restricted'].includes(this.session.status)) return Promise.resolve();
    const restore = () => this.queue.run(async () => {
      this.queue.change();
      this.publish({status: 'connecting', owner: null, userId: null, error: null, revision: this.queue.revision});
      try {
        const remembered = this.memory.read(), authType = this.client.auth.lastAuthType;
        // Do not logout before autoLogin: logout deletes the very refresh token we need.
        idosResult(await this.client.auth.autoLogin());
        const userId = this.client.auth.context?.userID;
        if (!userId) throw new Error('iDos did not restore the account.');
        let owner: string | null = null;
        if (authType === 'Wallet') {
          if (remembered && remembered.userId !== userId) throw new Error('iDos restored a different account. Sign in again.');
          const state = this.client.data.user.state?.Blockchain;
          const verifiedOwner = state?.LastWalletLogin?.NetworkID === IDOS_CONFIG.network ? solanaAddress(state.LastWalletLogin.Address) : null;
          owner = verifiedOwner ?? remembered?.owner ?? null;
          if (!owner || remembered && verifiedOwner && verifiedOwner !== remembered.owner) throw new Error('Sign in with your wallet to restore this account.');
          const connected = await currentOwner();
          if (connected && connected !== owner) {
            this.client.auth.logout(); this.memory.clear();
            idosResult(await this.client.auth.loginWithDeviceID());
            owner = null;
          } else this.memory.save(owner, userId);
        }
        const pass = this.client.auth.playAccess;
        this.publish({status: pass?.Granted === false ? 'restricted' : owner ? 'wallet' : 'guest', owner,
          userId: this.client.auth.context?.userID ?? null, error: pass?.Granted === false ? pass.Error ?? 'iDos play access is required.' : null, revision: this.queue.revision});
      } catch (error) {
        // A temporary network error must not erase a valid remembered login.
        this.publish({status: 'error', owner: null, userId: null, error: error instanceof Error ? error.message : 'iDos login unavailable.', revision: this.queue.revision});
        throw error;
      }
    });
    const locks = browserLocks();
    this.starting = (locks ? locks.request(`imperivm.auth:${this.client.titleID}`, restore) : restore()).finally(() => {this.starting = null;});
    return this.starting;
  }
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
  private profileService(client: IDosGamesClient, expected: ProfileIdentity) {
    return new WalletProfileService({
      identity: () => this.session.status === 'wallet' && this.session.owner && this.session.userId
        ? {owner: this.session.owner, userId: this.session.userId} : null,
      user: client.user, userCustomData: client.userCustomData,
      cachedNickname: () => client.data.user.state?.PublicData?.Username,
    }, expected);
  }
  profile(expected: ProfileIdentity) {return this.withAccount(client => this.profileService(client, expected).load());}
  changeNickname(expected: ProfileIdentity, nickname: string) {return this.withAccount(client => this.profileService(client, expected).changeNickname(nickname));}
  changeAvatar(expected: ProfileIdentity, avatar: ProfileAvatar) {return this.withAccount(client => this.profileService(client, expected).changeAvatar(avatar));}
  async standings(): Promise<IDosStandings> {
    if (!IDOS_CONFIG.leaderboard) throw new Error('iDos leaderboard is not configured.');
    return this.withAccount(async client => ({ board: idosResult(await client.leaderboard.getLeaderboard(IDOS_CONFIG.leaderboard)), ownScore: idosResult(await client.leaderboard.getMyProgress(IDOS_CONFIG.leaderboard)).CurrentScore ?? 0 }));
  }
  async tokenBalance(): Promise<string> {
    return this.withAccount(async client => {
      const definitions = idosResult(await client.title.getCurrencyDefinitions());
      if (IDOS_CONFIG.title === IMPERIVM_TITLE.id) validateImpToken(definitions);
      idosResult(await client.blockchain.getUserState());
      const amount = client.data.user.getCryptoCurrencyAmount(IDOS_CONFIG.currency);
      if (!/^\d+(?:\.\d+)?$/.test(amount)) throw new Error('iDos returned an invalid IMP balance.');
      return amount;
    });
  }
  async withImpTransfers<T>(work: (service: import('./walletTransfer').ImpTransferService) => Promise<T>): Promise<T> {
    return this.withAccount(async client => {
      const session = this.session;
      if (session.status !== 'wallet' || !session.owner || !session.userId) throw new Error('Войдите тем же кошельком в iDos перед переводом IMP.');
      const {ImpTransferService, TransferJournal, transferJournalKey} = await import('./walletTransfer');
      // Storage is mandatory: a transaction cannot start without a durable recovery receipt.
      const service = new ImpTransferService(client, new TransferJournal(window.localStorage, session.userId, session.owner));
      if (!navigator.locks) throw new Error('Для перевода IMP нужен современный браузер с защитой от повторных операций. Откройте кошелёк на iDos.');
      return navigator.locks.request(transferJournalKey(session.userId, session.owner), () => work(service));
    });
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
