import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {parseWalletRpc, createWalletRpcRelay} from '../src/walletRpc';
import {startServer} from '../src/service';
const owner = 'BpN6zQ3rec4sCyuRCzo9RaVk433fXyBBEmPghXswWnL6';
const rpc = (method: string, params: unknown[] = []) => ({jsonrpc: '2.0' as const, id: 1, method, params});
test('wallet RPC rejects batches, arbitrary methods/URLs, unsigned wires and preflight bypass', () => {
  assert.equal(parseWalletRpc(rpc('getAccountInfo', [owner, {encoding: 'base64', commitment: 'confirmed'}])).method, 'getAccountInfo');
  assert.throws(() => parseWalletRpc([rpc('getBlockHeight')]));
  assert.throws(() => parseWalletRpc({...rpc('getBlockHeight'), url: 'https://attacker.test'}));
  assert.throws(() => parseWalletRpc(rpc('getProgramAccounts', [owner])));
  assert.throws(() => parseWalletRpc(rpc('requestAirdrop', [owner, 1])));
  const wire = Buffer.alloc(150); wire[0] = 1;
  assert.throws(() => parseWalletRpc(rpc('sendTransaction', [wire.toString('base64'), {encoding: 'base64'}])));
  wire[1] = 1;
  assert.equal(parseWalletRpc(rpc('sendTransaction', [wire.toString('base64'), {encoding: 'base64', preflightCommitment: 'confirmed', maxRetries: 3}])).method, 'sendTransaction');
  assert.throws(() => parseWalletRpc(rpc('sendTransaction', [wire.toString('base64'), {encoding: 'base64', skipPreflight: true}])));
  assert.throws(() => parseWalletRpc(rpc('getSignatureStatuses', [Array(5).fill('1'.repeat(88))])));
});
test('relay targets fixed mainnet, preserves errors and never substitutes a successful transaction', async () => {
  const relay = createWalletRpcRelay({fetcher: async (url, init) => {
    assert.equal(String(url), 'https://api.mainnet-beta.solana.com/'); assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    return new Response(JSON.stringify({jsonrpc: '2.0', id: 1, error: {code: -32002, message: 'Simulation failed'}}));
  }});
  assert.deepEqual(await relay(rpc('getBlockHeight')), {jsonrpc: '2.0', id: 1, error: {code: -32002, message: 'Simulation failed'}});
  const bad = createWalletRpcRelay({fetcher: async () => new Response('{"jsonrpc":"2.0","id":7,"result":"wrong"}')});
  await assert.rejects(bad(rpc('getBlockHeight')));
});
test('wallet relay requires exact Origin and preflight, and bounds request body', async t => {
  const origin = 'https://si4ips8b.idos.games'; let calls = 0;
  const service = startServer({port: 0, host: '127.0.0.1', origins: [origin], callWalletRpc: async request => {calls++; return {jsonrpc: '2.0', id: request.id, result: 42};}});
  t.after(() => service.close()); if (!service.server.listening) await once(service.server, 'listening');
  const url = `http://127.0.0.1:${(service.server.address() as {port: number}).port}/wallet/rpc`;
  const init = {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify(rpc('getBlockHeight'))};
  assert.equal((await fetch(url, {method: 'OPTIONS', headers: {Origin: origin}})).status, 204);
  const response = await fetch(url, init); assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await fetch(url, {...init, headers: {Origin: 'https://attacker.test'}})).status, 403);
  assert.equal((await fetch(url, {...init, headers: {}})).status, 403);
  assert.equal((await fetch(url, {...init, body: 'x'.repeat(8193)})).status, 413);
  assert.equal((await fetch(url, {...init, body: JSON.stringify(rpc('requestAirdrop', [owner, 1]))})).status, 400);
  assert.equal(calls, 1);
});
