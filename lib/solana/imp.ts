import {IMPERIVM_TITLE} from '../idos/title';
import {validSolanaAddress} from './tokenBalance';

/** Use the same authority host as PvP; public RPC blocks browser Origins. */
function balanceService(): string {
  if (process.env.NEXT_PUBLIC_IMP_BALANCE_URL) return process.env.NEXT_PUBLIC_IMP_BALANCE_URL;
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (ws) {const url = new URL(ws); url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'; url.pathname = '/wallet/imp'; url.search = ''; return url.href;}
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return `${window.location.protocol}//${window.location.hostname}:3102/wallet/imp`;
  throw new Error('Wallet balance service is not configured');
}
const pending = new Map<string, Promise<string>>();
export async function readImpWalletBalance(owner: string): Promise<string> {
  if (!validSolanaAddress(owner)) throw new Error('Invalid wallet address');
  const existing = pending.get(owner); if (existing) return existing;
  const task = (async () => {
    const url = new URL(balanceService()); url.searchParams.set('owner', owner);
    const response = await fetch(url, {cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error('Wallet balance unavailable');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('owner' in value) || value.owner !== owner || !('mint' in value) || value.mint !== IMPERIVM_TITLE.mint || !('amount' in value) || typeof value.amount !== 'string' || !/^\d{1,21}(\.\d{1,6})?$/.test(value.amount) || !('decimals' in value) || value.decimals !== 6) throw new Error('Invalid IMP balance');
    return value.amount;
  })();
  pending.set(owner, task);
  try {return await task;} finally {pending.delete(owner);}
}
export function formatImpAmount(amount: string, locale: 'ru' | 'en'): string {
  const [integer, fraction] = amount.split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'ru' ? '\u202f' : ',')}${fraction ? (locale === 'ru' ? ',' : '.') + fraction : ''}`;
}
