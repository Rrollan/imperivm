import { Connection, PublicKey } from '@solana/web3.js';
import { assertDevnet, DEVNET_RPC } from './devnet';

/** Optional future mint. Empty means the token has not been launched. */
export function rugMint(value = process.env.NEXT_PUBLIC_IMP_DEVNET_MINT || process.env.NEXT_PUBLIC_RUG_DEVNET_MINT): string | null {
  if (!value?.trim() || /^(your|replace|placeholder|todo|<)/i.test(value.trim())) return null;
  try { return new PublicKey(value.trim()).toBase58(); } catch { return null; }
}
import {tokenBalance} from './tokenBalance';
export {tokenBalance} from './tokenBalance';
export async function readRugBalance(owner: string, mint = rugMint()): Promise<string | null> {
  if (!mint) return null;
  await assertDevnet();
  const result = await new Connection(DEVNET_RPC, 'confirmed').getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(mint) });
  const entries: unknown[] = result.value.map(({ account }) => {
    const data: unknown = account.data;
    if (!data || typeof data !== 'object' || !('parsed' in data)) throw new Error('Invalid token account.');
    return data.parsed;
  });
  return tokenBalance(entries, owner, mint);
}
