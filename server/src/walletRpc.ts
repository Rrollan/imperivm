import {validSolanaAddress} from '../../lib/solana/tokenBalance';
export type WalletRpcRequest = {jsonrpc: '2.0'; id: number | string; method: string; params: unknown[]};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const signature = (v: unknown) => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(v);
const config = (v: unknown, keys: string[]) => v === undefined || record(v) && Object.keys(v).every(k => keys.includes(k)) && (!('commitment' in v) || ['confirmed', 'finalized'].includes(String(v.commitment)));
/** Fixed mainnet relay: no URL input, RPC batch, account enumeration or server-side signing. */
export function parseWalletRpc(value: unknown): WalletRpcRequest {
  if (!record(value) || value.jsonrpc !== '2.0' || !['number', 'string'].includes(typeof value.id) || String(value.id).length > 80 || typeof value.method !== 'string' || !Array.isArray(value.params) || Object.keys(value).some(k => !['jsonrpc', 'id', 'method', 'params'].includes(k))) throw new Error('Invalid RPC request');
  const p = value.params;
  let valid = false;
  switch (value.method) {
    case 'getAccountInfo': valid = p.length >= 1 && p.length <= 2 && typeof p[0] === 'string' && validSolanaAddress(p[0]) && config(p[1], ['encoding', 'commitment', 'minContextSlot']) && (!record(p[1]) || !p[1].encoding || p[1].encoding === 'base64'); break;
    case 'getLatestBlockhash': case 'getBlockHeight': valid = p.length <= 1 && config(p[0], ['commitment', 'minContextSlot']); break;
    case 'getSignatureStatuses': valid = p.length >= 1 && p.length <= 2 && Array.isArray(p[0]) && p[0].length >= 1 && p[0].length <= 4 && p[0].every(signature) && config(p[1], ['searchTransactionHistory']) && (!record(p[1]) || p[1].searchTransactionHistory === undefined || typeof p[1].searchTransactionHistory === 'boolean'); break;
    case 'getTransaction': valid = p.length >= 1 && p.length <= 2 && signature(p[0]) && config(p[1], ['encoding', 'commitment', 'maxSupportedTransactionVersion']) && (!record(p[1]) || !p[1].encoding || ['json', 'base64'].includes(String(p[1].encoding))) && (!record(p[1]) || p[1].maxSupportedTransactionVersion === undefined || p[1].maxSupportedTransactionVersion === 0); break;
    case 'sendTransaction': {
      if (p.length !== 2 || typeof p[0] !== 'string' || p[0].length > 1650 || !/^[A-Za-z0-9+/]+={0,2}$/.test(p[0]) || !record(p[1]) || !config(p[1], ['encoding', 'skipPreflight', 'preflightCommitment', 'maxRetries', 'minContextSlot']) || p[1].encoding !== 'base64' || p[1].skipPreflight === true || p[1].preflightCommitment !== undefined && !['confirmed', 'finalized'].includes(String(p[1].preflightCommitment)) || p[1].maxRetries !== undefined && (!Number.isSafeInteger(p[1].maxRetries) || Number(p[1].maxRetries) < 0 || Number(p[1].maxRetries) > 5)) break;
      const bytes = Buffer.from(p[0], 'base64');
      valid = bytes.length <= 1232 && bytes[0] >= 1 && bytes[0] <= 16 && bytes.length > 1 + bytes[0] * 64 && Array.from(bytes.subarray(1, 65)).some(b => b !== 0);
      break;
    }
  }
  if (!valid) throw new Error('RPC method or parameters not allowed');
  return value as WalletRpcRequest;
}
export function createWalletRpcRelay({fetcher = fetch, rpc = process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com'}: {fetcher?: typeof fetch; rpc?: string} = {}) {
  const url = new URL(rpc); if (url.protocol !== 'https:') throw new Error('Wallet RPC must use HTTPS');
  let active = 0;
  return async (request: WalletRpcRequest): Promise<unknown> => {
    if (active >= 12) throw new Error('RPC busy'); active++;
    try {
      const response = await fetcher(url, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000), headers: {'Content-Type': 'application/json'}, body: JSON.stringify(parseWalletRpc(request))});
      if (!response.ok || !response.body) throw new Error('RPC unavailable');
      const reader = response.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
      while (true) {const {done, value} = await reader.read(); if (done) break; bytes += value.length; if (bytes > 1_000_000) {await reader.cancel(); throw new Error('RPC response too large');} chunks.push(value);}
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!record(value) || value.jsonrpc !== '2.0' || value.id !== request.id || !('result' in value || 'error' in value)) throw new Error('Invalid RPC response');
      return value;
    } finally {active--;}
  };
}
