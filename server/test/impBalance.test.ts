import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {createImpBalanceReader, parseImpBalance} from '../src/impBalance';
import {startServer} from '../src/service';
import {IMPERIVM_TITLE} from '../../lib/idos/title';
import {validSolanaAddress} from '../../lib/solana/tokenBalance';
const owner = 'BpN6zQ3rec4sCyuRCzo9RaVk433fXyBBEmPghXswWnL6';
const account = (amount: string, address = owner, decimals = 6) => ({account: {data: {parsed: {info: {owner: address, mint: IMPERIVM_TITLE.mint, tokenAmount: {amount, decimals}}}}}});
const envelope = (value: unknown[]) => ({result: {context: {slot: 123}, value}});
test('IMP balances sum exact base units, validate owner/mint/decimals and reject RPC errors', () => {
  assert.equal(parseImpBalance(envelope([account('490021764541'), account('1')]), owner).amount, '490021.764542');
  assert.equal(parseImpBalance(envelope([]), owner).amount, '0');
  assert.throws(() => parseImpBalance(envelope([account('1', 'another-wallet')]), owner));
  assert.throws(() => parseImpBalance(envelope([account('1', owner, 0)]), owner));
  assert.throws(() => parseImpBalance({error: {code: 403}}, owner));
  assert.equal(validSolanaAddress(owner), true);
  assert.equal(validSolanaAddress('1'.repeat(33)), false);
  assert.equal(validSolanaAddress('https://attacker.test'), false);
});
test('read-only balance RPC is fixed, deduplicates, caches and does not turn failures into zero', async () => {
  let calls = 0, now = 1000;
  const read = createImpBalanceReader({clock: () => now, fetcher: async (_url, init) => {
    calls++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.method, 'getTokenAccountsByOwner');
    assert.deepEqual(request.params, [owner, {mint: IMPERIVM_TITLE.mint}, {encoding: 'jsonParsed', commitment: 'confirmed'}]);
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    return new Response(JSON.stringify(envelope([account('42')])));
  }});
  assert.deepEqual(await Promise.all([read(owner), read(owner)]), [await read(owner), await read(owner)]);
  assert.equal(calls, 1); now += 16000; await read(owner); assert.equal(calls, 2);
  const failed = createImpBalanceReader({fetcher: async () => new Response('{}', {status: 403})});
  await assert.rejects(failed(owner)); await assert.rejects(failed(owner));
});
test('HTTP balance route validates inputs and permits only exact game Origins', async t => {
  const service = startServer({port: 0, host: '127.0.0.1', origins: ['https://si4ips8b.idos.games'], readImpBalance: async address => parseImpBalance(envelope([account('42')]), address)});
  t.after(() => service.close());
  if (!service.server.listening) await once(service.server, 'listening');
  const port = (service.server.address() as {port: number}).port;
  const url = `http://127.0.0.1:${port}/wallet/imp?owner=${owner}`;
  const ok = await fetch(url, {headers: {Origin: 'https://si4ips8b.idos.games'}});
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://si4ips8b.idos.games');
  assert.equal(((await ok.json()) as {amount: string}).amount, '0.000042');
  assert.equal((await fetch(url, {headers: {Origin: 'https://attacker.test'}})).status, 403);
  assert.equal((await fetch(url + '&rpc=https://attacker.test')).status, 400);
  assert.equal((await fetch(url + `&owner=${owner}`)).status, 400);
  assert.equal((await fetch(url, {method: 'POST'})).status, 405);
});
