import { Connection, PublicKey } from '@solana/web3.js';
import { assertDevnet, DEVNET_RPC } from './devnet';

/** Optional future mint. Empty means the token has not been launched. */
export function rugMint(value = process.env.NEXT_PUBLIC_IMP_DEVNET_MINT || process.env.NEXT_PUBLIC_RUG_DEVNET_MINT): string | null {
  if (!value?.trim() || /^(your|replace|placeholder|todo|<)/i.test(value.trim())) return null;
  try { return new PublicKey(value.trim()).toBase58(); } catch { return null; }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid devnet token account.');
  return value as Record<string, unknown>;
}
export function tokenBalance(entries: readonly unknown[], owner: string, mint: string): string {
  let total = BigInt(0), decimals: number | null = null;
  for (const entry of entries) {
    const info = object(object(entry).info), amount = object(info.tokenAmount);
    if (info.owner !== owner || info.mint !== mint || typeof amount.amount !== 'string' || !/^\d{1,20}$/.test(amount.amount) || typeof amount.decimals !== 'number' || !Number.isInteger(amount.decimals) || amount.decimals < 0 || amount.decimals > 18) throw new Error('Invalid devnet token account.');
    if (decimals !== null && decimals !== amount.decimals) throw new Error('Inconsistent devnet token decimals.');
    decimals = amount.decimals; total += BigInt(amount.amount);
  }
  if (!decimals) return total.toString();
  const digits = total.toString().padStart(decimals + 1, '0'), fraction = digits.slice(-decimals).replace(/0+$/, '');
  return `${digits.slice(0, -decimals)}${fraction ? `.${fraction}` : ''}`;
}
export async function readRugBalance(owner: string, mint = rugMint()): Promise<string | null> {
  if (!mint) return null;
  await assertDevnet();
  const result = await new Connection(DEVNET_RPC, 'confirmed').getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(mint) });
  const entries: unknown[] = result.value.map(({ account }) => {
    const data: unknown = account.data;
    return object(data).parsed;
  });
  return tokenBalance(entries, owner, mint);
}
