import {IMPERIVM_TITLE} from '../../lib/idos/title';
import {tokenBalance, validSolanaAddress} from '../../lib/solana/tokenBalance';

export interface ImpBalance {owner: string; mint: string; amount: string; decimals: 6; slot: number; checkedAt: number}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parseImpBalance(value: unknown, owner: string, checkedAt = Date.now()): ImpBalance {
  if (!record(value) || value.error || !record(value.result) || !record(value.result.context) || !Number.isSafeInteger(value.result.context.slot) || !Array.isArray(value.result.value) || value.result.value.length > 1000) throw new Error('Invalid Solana response');
  const entries = value.result.value.map((entry: unknown) => {
    if (!record(entry) || !record(entry.account) || !record(entry.account.data) || !record(entry.account.data.parsed)) throw new Error('Invalid IMP token account');
    const parsed = entry.account.data.parsed;
    if (!record(parsed.info) || !record(parsed.info.tokenAmount) || parsed.info.tokenAmount.decimals !== IMPERIVM_TITLE.decimals) throw new Error('Invalid IMP decimals');
    return parsed;
  });
  return {owner, mint: IMPERIVM_TITLE.mint, amount: tokenBalance(entries, owner, IMPERIVM_TITLE.mint), decimals: 6, slot: value.result.context.slot as number, checkedAt};
}

/** Fixed mint, fixed RPC method, bounded concurrency, exact integers, no signing. */
export function createImpBalanceReader({fetcher = fetch, rpc = process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com', clock = Date.now}: {fetcher?: typeof fetch; rpc?: string; clock?: () => number} = {}) {
  const url = new URL(rpc);
  if (url.protocol !== 'https:') throw new Error('SOLANA_MAINNET_RPC_URL must use HTTPS');
  const cache = new Map<string, ImpBalance>(), pending = new Map<string, Promise<ImpBalance>>();
  let windowStart = clock(), requests = 0;
  return async (owner: string): Promise<ImpBalance> => {
    if (!validSolanaAddress(owner)) throw new Error('Invalid wallet address');
    const cached = cache.get(owner);
    if (cached && clock() - cached.checkedAt < 15_000) return cached;
    const existing = pending.get(owner); if (existing) return existing;
    const now = clock(); if (now - windowStart >= 10_000) {windowStart = now; requests = 0;}
    if (pending.size >= 16 || requests >= 30) throw new Error('Balance service is busy');
    requests++;
    const task = (async () => {
      const response = await fetcher(url, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000), headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [owner, {mint: IMPERIVM_TITLE.mint}, {encoding: 'jsonParsed', commitment: 'confirmed'}]})});
      if (!response.ok) throw new Error('Solana RPC unavailable');
      const content = await response.text(); if (content.length > 1_000_000) throw new Error('Solana response too large');
      const result = parseImpBalance(JSON.parse(content), owner, clock());
      cache.delete(owner); cache.set(owner, result);
      while (cache.size > 512) cache.delete(cache.keys().next().value!);
      return result;
    })();
    pending.set(owner, task);
    try {return await task;} finally {pending.delete(owner);}
  };
}
