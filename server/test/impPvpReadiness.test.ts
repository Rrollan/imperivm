import assert from 'node:assert/strict';
import {once} from 'node:events';
import test from 'node:test';
import WebSocket from 'ws';
import {startServer} from '../src/service';
import {impPvpReadiness} from '../src/impPvpReadiness';
import {parseMessage, ProtocolError} from '../src/validation';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {IMPERIVM_TITLE} from '../../lib/idos/title';

const ORIGIN = 'http://localhost:3101';
const registration = {playerName: 'Imp player', heroId: 'builder', deckList: [...FREE_DECKS.builder]};

test('free protocol refuses financial fields by presence, including null/zero and nested entry bundles', () => {
  const unsupported = [
    {entry: {CryptoCurrencies: {Main: 100_000}}}, {stake: '100000'}, {stake_amount: '0'},
    {currencyID: 'Main'}, {amount: 0}, {paid: false}, {payment: null}, {escrow: {}},
    {mint: IMPERIVM_TITLE.mint}, {mode: 'imp'}, {mode: 'paid'},
  ];
  for (const type of ['create', 'queue', 'join']) {
    for (const extra of unsupported) {
      assert.throws(() => parseMessage(JSON.stringify({type, ...registration, ...(type === 'join' ? {roomCode: 'ABC234'} : {}), ...extra})),
        error => error instanceof ProtocolError && error.code === 'paid-pvp-unavailable');
    }
  }
  assert.throws(() => parseMessage(JSON.stringify({type: 'queue', ...registration, bank: {amount: 1}})), ProtocolError,
    'Unknown registration fields must not silently downgrade a money request to a free match');
  assert.deepEqual(parseMessage(JSON.stringify({type: 'queue', ...registration})), {type: 'queue', ...registration});
  assert.deepEqual(parseMessage(JSON.stringify({type: 'intent', intent: {type: 'stake', cardId: 'fighter-1'}})),
    {type: 'intent', intent: {type: 'stake', cardId: 'fighter-1'}}, 'The in-game fighter action is not a token entry');
});

test('public readiness and health agree; no payment/mint override is accepted', async t => {
  const service = startServer({port: 0, host: '127.0.0.1', origins: [ORIGIN]});
  t.after(() => service.close());
  if (!service.server.listening) await once(service.server, 'listening');
  const address = service.server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/pvp/imp/readiness`, {headers: {Origin: ORIGIN}});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const readiness = await response.json();
  assert.deepEqual(readiness, impPvpReadiness());
  assert.equal(readiness.enabled, false);
  assert.equal(readiness.currencyID, 'Main'); assert.equal(readiness.symbol, 'IMP');
  assert.equal(readiness.mint, IMPERIVM_TITLE.mint); assert.equal(readiness.decimals, 6);
  const health = await (await fetch(`${base}/health`)).json() as {paidPvp: ReturnType<typeof impPvpReadiness>; capabilities: string[]};
  assert.deepEqual(health.paidPvp, readiness);
  assert.ok(health.capabilities.includes('random-pvp'));
  assert.equal((await fetch(`${base}/pvp/imp/readiness?mint=other`)).status, 400);
  assert.equal((await fetch(`${base}/pvp/imp/readiness`, {method: 'POST'})).status, 405);
  assert.equal((await fetch(`${base}/pvp/imp/readiness`, {headers: {Origin: 'https://evil.invalid'}})).status, 403);
});

test('paid registration is rejected before collection lookup and cannot occupy a free queue/room', async t => {
  let authorizations = 0;
  const service = startServer({port: 0, host: '127.0.0.1', origins: [ORIGIN], log: () => {}, authorizeDeck: async () => {authorizations++;}});
  t.after(() => service.close());
  if (!service.server.listening) await once(service.server, 'listening');
  const address = service.server.address(); assert.ok(address && typeof address !== 'string');
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}`, {headers: {Origin: ORIGIN}});
  await once(socket, 'open');
  for (const type of ['create', 'queue', 'join']) {
    const next = once(socket, 'message');
    socket.send(JSON.stringify({type, ...registration, ...(type === 'join' ? {roomCode: 'ABC234'} : {}), entry: {CryptoCurrencies: {Main: 100_000}}}));
    const [data] = await next; const message = JSON.parse(data.toString());
    assert.equal(message.type, 'error'); assert.equal(message.code, 'paid-pvp-unavailable');
    assert.equal(service.rooms.queued, 0); assert.equal(service.rooms.size, 0);
  }
  assert.equal(authorizations, 0);
  const next = once(socket, 'message');
  socket.send(JSON.stringify({type: 'queue', ...registration}));
  const [data] = await next; assert.equal(JSON.parse(data.toString()).type, 'queued');
  assert.equal(authorizations, 1); assert.equal(service.rooms.queued, 1);
});
