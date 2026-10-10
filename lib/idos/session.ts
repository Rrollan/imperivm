import {PublicKey} from '@solana/web3.js';

export type RememberedWallet = {version: 1; owner: string; userId: string; network: string};
type Storage = {getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void};
export function solanaAddress(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 44) return null;
  try {return new PublicKey(value).toBase58() === value ? value : null;} catch {return null;}
}

/** Only an identity hint. The SDK keeps/rotates credentials and the server must validate them. */
export class WalletSessionMemory {
  private key: string;
  constructor(title: string, private network: string, private storage?: Storage) {
    this.key = `imperivm.wallet-session.v1:${title}:${network}`;
    if (!storage && typeof window !== 'undefined') try {this.storage = window.localStorage;} catch {/* Storage may be blocked by the browser. */}
  }
  read(): RememberedWallet | null {
    try {
      const raw = this.storage?.getItem(this.key); if (!raw || raw.length > 1024) return null;
      const value = JSON.parse(raw);
      if (value?.version !== 1 || value.network !== this.network || !solanaAddress(value.owner) || typeof value.userId !== 'string' || !/^[\w-]{1,160}$/.test(value.userId)) return null;
      return {version: 1, owner: value.owner, userId: value.userId, network: this.network};
    } catch {return null;}
  }
  save(owner: string, userId: string) {
    if (!solanaAddress(owner)) throw new Error('Invalid Solana wallet.');
    try {this.storage?.setItem(this.key, JSON.stringify({version: 1, owner, userId, network: this.network}));} catch {/* Current login still works without persistence. */}
  }
  clear() {try {this.storage?.removeItem(this.key);} catch {/* No persistent storage. */}}
}
