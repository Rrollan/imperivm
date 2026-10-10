import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {parseWalletRpc, createWalletRpcRelay} from '../src/walletRpc';
import {startServer} from '../src/service';
import {Connection, PublicKey} from '@solana/web3.js';
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
  const preflight = await fetch(url, {method: 'OPTIONS', headers: {Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,solana-client'}});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.deepEqual(preflight.headers.get('Access-Control-Allow-Headers')?.toLowerCase().split(',').map(header => header.trim()).sort(), ['content-type', 'solana-client']);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  const response = await fetch(url, init); assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await fetch(url, {...init, headers: {Origin: 'https://attacker.test'}})).status, 403);
  assert.equal((await fetch(url, {...init, headers: {}})).status, 403);
  assert.equal((await fetch(url, {...init, body: 'x'.repeat(8193)})).status, 413);
  assert.equal((await fetch(url, {...init, body: JSON.stringify(rpc('requestAirdrop', [owner, 1]))})).status, 400);
  assert.equal(calls, 1);
});
test('real web3.js mint read passes browser preflight with its automatic client header', async t => {
  const origin = 'https://si4ips8b.idos.games';
  const mint = '7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos';
  let calls = 0;
  const service = startServer({port: 0, host: '127.0.0.1', origins: [origin], callWalletRpc: async request => {
    calls++;
    assert.equal(request.method, 'getAccountInfo');
    assert.equal(request.params[0], mint);
    return {jsonrpc: '2.0', id: request.id, result: {context: {slot: 1}, value: {data: [Buffer.alloc(82).toString('base64'), 'base64'], executable: false, lamports: 1, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', rentEpoch: 0}}};
  }});
  t.after(() => service.close()); if (!service.server.listening) await once(service.server, 'listening');
  const url = `http://127.0.0.1:${(service.server.address() as {port: number}).port}/wallet/rpc`;
  const connection = new Connection(url, {commitment: 'confirmed', fetch: async (input, init) => {
    const headers = new Headers(init?.headers);
    assert.ok(headers.get('solana-client'), 'web3.js adds this non-simple header');
    const requestedHeaders = [...headers.keys()].sort();
    const preflight = await fetch(input, {method: 'OPTIONS', headers: {Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': requestedHeaders.join(',')}});
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
    const allowedHeaders = preflight.headers.get('Access-Control-Allow-Headers')?.toLowerCase().split(',').map(header => header.trim()) ?? [];
    for (const header of requestedHeaders) assert.ok(allowedHeaders.includes(header), `Browser would block header ${header}`);
    headers.set('Origin', origin);
    return fetch(input, {...init, headers});
  }});
  const account = await connection.getAccountInfo(new PublicKey(mint));
  assert.equal(account?.data.length, 82);
  assert.equal(calls, 1);
});
