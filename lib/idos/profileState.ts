import type {ProfileIdentity, WalletProfile} from './profile';

export type WalletProfileScope = ProfileIdentity & {revision: number};
export type WalletProfileSnapshot = {profile: WalletProfile | null; loading: boolean; error: string | null};
const empty: WalletProfileSnapshot = {profile: null, loading: false, error: null};
const keyOf = (scope: WalletProfileScope | null) => scope ? JSON.stringify([scope.owner, scope.userId, scope.revision]) : '';

/** A tab-wide profile, scoped to one verified wallet login. Stale reads cannot replace a confirmed edit. */
export class WalletProfileStore {
  private key = '';
  private generation = 0;
  private snapshot = empty;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => empty;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  matches(scope: WalletProfileScope | null) {return this.key === keyOf(scope);}
  private publish(snapshot: WalletProfileSnapshot) {this.snapshot = snapshot; this.listeners.forEach(listener => listener());}
  activate(scope: WalletProfileScope | null) {
    const next = keyOf(scope);
    if (this.key === next) return;
    this.key = next; this.generation++;
    this.publish({...empty});
  }
  async load(scope: WalletProfileScope, reader: (identity: ProfileIdentity) => Promise<WalletProfile>) {
    if (!this.matches(scope)) return;
    const generation = ++this.generation;
    this.publish({...this.snapshot, loading: true, error: null});
    try {
      const profile = await reader({owner: scope.owner, userId: scope.userId});
      if (!this.matches(scope) || generation !== this.generation) return;
      if (profile.owner !== scope.owner || profile.userId !== scope.userId) throw new Error('PROFILE_ACCOUNT_CHANGED');
      this.publish({profile, loading: false, error: null});
    } catch (reason) {
      if (this.matches(scope) && generation === this.generation) this.publish({...this.snapshot, loading: false, error: reason instanceof Error ? reason.message : 'PROFILE_LOAD_FAILED'});
    }
  }
  confirm(scope: WalletProfileScope, profile: WalletProfile) {
    if (!this.matches(scope) || profile.owner !== scope.owner || profile.userId !== scope.userId) return false;
    this.generation++;
    this.publish({profile, loading: false, error: null});
    return true;
  }
}
