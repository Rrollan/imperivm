import assert from 'node:assert/strict';
import {MultiplayerStore, OnlineError, DISCONNECT_MS, TURN_MS} from '../lib/multiplayer/store';
import {parseCommand} from '../lib/multiplayer/validation';
import {multiplayerOrigin} from '../lib/multiplayer/origin';
import type {Action} from '../lib/engine/types';
import type {OnlineCommand, OnlineSession} from '../lib/multiplayer/types';

let now = 1_000_000;
assert.equal(multiplayerOrigin('http://localhost:3101/api/multiplayer', '127.0.0.1:3101'), 'http://127.0.0.1:3101');
assert.equal(multiplayerOrigin('http://localhost:3101/api/multiplayer', 'evil.invalid:3101'), 'http://localhost:3101');
assert.equal(multiplayerOrigin('http://localhost:3101/api/multiplayer', '127.0.0.1:3102'), 'http://localhost:3101');
assert.equal(multiplayerOrigin('https://game.example.com/api/multiplayer', 'evil.invalid'), 'https://game.example.com');
assert.equal(multiplayerOrigin('http://localhost:3101/api/multiplayer', '127.0.0.1:3101', 'https://game.example.com'), 'https://game.example.com');
const store = new MultiplayerStore(() => now);
const a = store.createSession(), b = store.createSession(), stranger = store.createSession();
const fails = (code: string, fn: () => unknown) => assert.throws(fn, (error: unknown) => error instanceof OnlineError && error.code === code);
const create = store.command(a, {type: 'create', heroId: 'builder'});
assert.equal(create.room!.status, 'waiting');
assert.equal(create.room!.game, null);
const roomId = create.room!.id;
// Same guest opening their own invitation does not consume the second seat.
assert.equal(store.command(a, {type: 'join', roomId, heroId: 'degen'}).room!.status, 'waiting');
const joined = store.command(b, {type: 'join', roomId, heroId: 'degen'});
assert.equal(joined.room!.status, 'playing');
assert.equal(store.status(a).room!.id, roomId);
assert.notEqual(store.status(a).room!.seat, joined.room!.seat);
fails('room-full', () => store.command(stranger, {type: 'join', roomId, heroId: 'validator'}));
fails('seat', () => store.command(stranger, {type: 'action', roomId, revision: joined.room!.revision, action: {type: 'end-turn'}}));
fails('active-match', () => store.command(a, {type: 'cancel'}));
fails('already-in-room', () => store.command(a, {type: 'queue', heroId: 'whale'}));

function project(token: string) {
  const view = store.status(token), room = view.room!, game = room.game!;
  assert(!Object.hasOwn(game, 'rng')); assert(!Object.hasOwn(game, 'log')); assert(!Object.hasOwn(game, 'spellEffects'));
  assert(!Object.hasOwn(game.players[0], 'deck')); assert(!Object.hasOwn(game.players[1], 'deck'));
  assert(Array.isArray(game.players[room.seat].hand));
  assert(!Object.hasOwn(game.players[1 - room.seat], 'hand'));
  if (game.turn !== room.seat) assert.deepEqual(game.actions, []);
  return view;
}
project(a); project(b);
let active = store.status(a).room!.seat === 0 ? a : b, inactive = active === a ? b : a;
let view = store.status(active);
fails('wrong-turn', () => store.command(inactive, {type: 'action', roomId, revision: view.room!.revision, action: {type: 'mulligan', uids: []}}));
// Own turn is not permission to play the other seat's hidden hand UID.
const enemyUid = store.status(inactive).room!.game!.players[store.status(inactive).room!.seat].hand![0].uid;
fails('illegal-action', () => store.command(active, {type: 'action', roomId, revision: view.room!.revision, action: {type: 'mulligan', uids: [enemyUid]}}));
const initialRevision = view.room!.revision;
store.command(active, {type: 'action', roomId, revision: initialRevision, action: {type: 'mulligan', uids: []}});
fails('revision', () => store.command(active, {type: 'action', roomId, revision: initialRevision, action: {type: 'end-turn'}}));
view = store.status(active);
fails('illegal-action', () => store.command(active, {type: 'action', roomId, revision: view.room!.revision, action: {type: 'play-minion', uid: enemyUid}}));
// Run real engine turns and attacks through the server boundary, never injecting a result.
let played = false, attacked = false;
for (let step = 0; step < 45; step++) {
  const va = store.status(a), vb = store.status(b);
  if (va.room!.game!.winner !== null) break;
  const current = va.room!.seat === va.room!.game!.turn ? a : b;
  const currentView = current === a ? va : vb, actions = currentView.room!.game!.actions;
  const action = actions.find(x => x.type === 'mulligan' && x.uids.length === 0)
    || actions.find(x => x.type === 'attack') || actions.find(x => x.type === 'play-minion') || actions.find(x => x.type === 'end-turn');
  assert(action);
  if (action.type === 'play-minion') played = true;
  if (action.type === 'attack') attacked = true;
  store.command(current, {type: 'action', roomId, revision: currentView.room!.revision, action});
  project(a); project(b);
  if (played && attacked) break;
}
assert(played && attacked, 'Both deployment and attacks cross the authoritative boundary');
const beforeConcede = store.status(a).room!;
const winner = 1 - beforeConcede.seat;
assert.equal(store.command(a, {type: 'concede', roomId, revision: beforeConcede.revision}).room!.game!.winner, winner);
assert.equal(store.status(b).room!.resultReason, 'concede');
store.command(a, {type: 'cancel'});
assert.equal(store.status(a).room, null);
assert.equal(store.status(b).room!.status, 'finished', 'One player returning to lobby must not erase the other result');
store.command(b, {type: 'cancel'});

// Real random queue: one waits; a separate guest joins; both get the same room.
assert.equal(store.command(a, {type: 'queue', heroId: 'whale'}).room, null);
assert(store.status(a).queue);
store.command(a, {type: 'queue', heroId: 'whale'});
assert.equal(store.status(a).room, null, 'Repeated queue cannot match itself');
const matched = store.command(b, {type: 'queue', heroId: 'validator'});
assert.equal(matched.room!.mode, 'random'); assert.equal(store.status(a).room!.id, matched.room!.id);
assert.equal(store.status(a).queue, null);
const randomRoom = store.status(a).room!;
// Timer chooses legal keep + end turn when its mulligan window expires.
now += TURN_MS + 1;
const timed = store.status(a).room!;
assert.notEqual(timed.game!.turn, randomRoom.game!.turn);
assert(timed.history.at(-1)!.text.includes('90 секунд'));
// Poll one client; leave the other offline beyond grace.
now += 60_000;
const disconnected = store.status(a).room!;
assert.equal(disconnected.game!.winner, disconnected.seat, 'The connected player wins after the opponent exceeds grace');
assert.equal(disconnected.resultReason, 'disconnect');
store.command(a, {type: 'cancel'}); store.command(b, {type: 'cancel'});
store.command(a, {type: 'queue', heroId: 'builder'}); store.command(b, {type: 'queue', heroId: 'degen'});
now += DISCONNECT_MS + 1;
assert.equal(store.status(a).room!.game!.winner, 'draw', 'If both players exceed grace, a first reconnect does not steal a win');
store.command(a, {type: 'cancel'}); store.command(b, {type: 'cancel'});
store.command(a, {type: 'queue', heroId: 'builder'}); store.command(a, {type: 'cancel'});
assert.equal(store.status(a).queue, null);
store.command(a, {type: 'queue', heroId: 'builder'}); now += 5 * 60_000 + 1;
assert.equal(store.status(a).queue, null, 'Expired queues do not remain searchable');
const expiring = store.command(a, {type: 'create', heroId: 'builder'}).room!.id;
now += 10 * 60_000 + 1;
fails('room-expired', () => store.command(b, {type: 'join', roomId: expiring, heroId: 'degen'}));
assert.equal(store.status(a).room, null);
fails('hero', () => store.command(a, {type: 'create', heroId: '__proto__'}));
fails('session-expired', () => store.status('fake-token'));
for (const payload of [null, [], {type: 'create', heroId: 'builder', state: {}}, {type: 'action', roomId, revision: -1, action: {type: 'end-turn'}},
  {type: 'action', roomId, revision: 0, action: {type: 'attack', attackerUid: 'x', target: 'hero', damage: 999}}, {type: 'join', heroId: 'degen', roomId: '../etc/passwd'}]) fails('payload', () => parseCommand(payload));
console.log('multiplayer-check: authority, hidden hands, seats, revisions, matchmaking, expiry, timers, and action validation passed');

// Optional HTTP boundary regression using two independent cookie jars:
// node --import tsx scripts/multiplayer-check.ts http://127.0.0.1:3101
async function httpCheck(base: string) {
  const origin = new URL(base).origin, endpoint = `${origin}/api/multiplayer`;
  interface Client {cookie: string}
  const ca: Client = {cookie: ''}, cb: Client = {cookie: ''}, cx: Client = {cookie: ''};
  async function post(client: Client, command: OnlineCommand, expected = 200): Promise<OnlineSession> {
    const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, Cookie: client.cookie}, body: JSON.stringify(command)});
    assert.equal(response.status, expected, `${command.type}: HTTP ${response.status}`);
    const cookie = response.headers.get('set-cookie');
    if (cookie) {assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Strict/i); client.cookie = cookie.split(';')[0];}
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    return await response.json() as OnlineSession;
  }
  async function get(client: Client, expected = 200) {
    const response = await fetch(endpoint, {headers: {Cookie: client.cookie}}); assert.equal(response.status, expected); return await response.json() as OnlineSession;
  }
  await get(cx, 401);
  await post(ca, {type: 'session'}); await post(cb, {type: 'session'}); await post(cx, {type: 'session'});
  assert.notEqual(ca.cookie, cb.cookie); assert.notEqual(ca.cookie, cx.cookie);
  const invitation = await post(ca, {type: 'create', heroId: 'builder'});
  const id = invitation.room!.id;
  const self = await post(ca, {type: 'join', roomId: id, heroId: 'builder'}); assert.equal(self.room!.status, 'waiting');
  await post(cb, {type: 'join', roomId: id, heroId: 'degen'});
  const va = await get(ca), vb = await get(cb);
  assert.equal(va.room!.id, vb.room!.id); assert.notEqual(va.room!.seat, vb.room!.seat);
  for (const data of [va, vb]) {const room = data.room!, game = room.game!; assert(!('rng' in game)); assert(!('deck' in game.players[0])); assert(!('hand' in game.players[1 - room.seat]));}
  const current = va.room!.seat === va.room!.game!.turn ? ca : cb, opponent = current === ca ? cb : ca;
  let state = await get(current), revision = state.room!.revision;
  await post(opponent, {type: 'action', roomId: id, revision, action: {type: 'mulligan', uids: []}}, 403);
  await post(cx, {type: 'concede', roomId: id, revision}, 403);
  state = await post(current, {type: 'action', roomId: id, revision, action: {type: 'mulligan', uids: []}});
  await post(current, {type: 'action', roomId: id, revision, action: {type: 'end-turn'}}, 409);
  await post(current, {type: 'concede', roomId: id, revision: state.room!.revision});
  await post(ca, {type: 'cancel'}); await post(cb, {type: 'cancel'});
  assert((await post(ca, {type: 'queue', heroId: 'builder'})).queue);
  const random = await post(cb, {type: 'queue', heroId: 'whale'}); assert.equal(random.room!.mode, 'random'); assert.equal((await get(ca)).room!.id, random.room!.id);
  await post(cb, {type: 'concede', roomId: random.room!.id, revision: random.room!.revision});
  await post(ca, {type: 'cancel'}); await post(cb, {type: 'cancel'});
  assert((await post(ca, {type: 'queue', heroId: 'builder'})).queue); assert.equal((await post(ca, {type: 'cancel'})).queue, null);
  for (const attack of [
    {headers: {'Content-Type': 'application/json', Origin: 'https://evil.invalid', Cookie: ca.cookie}, body: JSON.stringify({type: 'session'}), status: 403},
    {headers: {'Content-Type': 'text/plain', Origin: origin, Cookie: ca.cookie}, body: 'x', status: 415},
    {headers: {'Content-Type': 'application/json', Origin: origin, Cookie: ca.cookie}, body: '{bad', status: 400},
    {headers: {'Content-Type': 'application/json', Origin: origin, Cookie: ca.cookie}, body: JSON.stringify({type: 'session', state: {winner: 0}}), status: 400},
    {headers: {'Content-Type': 'application/json', Origin: origin, Cookie: ca.cookie}, body: 'x'.repeat(8193), status: 413},
  ]) {const response = await fetch(endpoint, {method: 'POST', headers: attack.headers, body: attack.body}); assert.equal(response.status, attack.status); assert(!(await response.text()).includes('at MultiplayerStore'));}
  const health = await fetch(`${endpoint}/health`); assert.equal(health.status, 200); assert.equal((await health.json()).protocol, 'imperivm-pvp-v1');
  console.log('multiplayer HTTP: independent HttpOnly cookies, CSRF, bounded JSON, two-player room/queue, secrecy, legal actions, and revisions passed');
}
if (process.argv[2]) void httpCheck(process.argv[2]).catch(error => {console.error(error); process.exitCode = 1;});
