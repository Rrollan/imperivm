import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import WebSocket from 'ws';
import {startServer} from '../src/service';
import {FREE_DECKS as DECKS} from '../../lib/collection/starterDecks';
import {CARDS} from '../../lib/cards';
import {authorizeCollectionDeck} from '../../lib/collection/authority';
import {PACK_CARD_IDS} from '../../lib/collection/access';
import type {Action} from '../../lib/engine/types';
import type {ClientMessage, GameIntent, NetSnapshot, PlayerRegistration, ServerMessage} from '../../lib/net/protocol';

const ORIGIN = 'http://localhost:3101';
type MessageKind = ServerMessage['type'];
type MessageOf<T extends MessageKind> = Extract<ServerMessage, {type: T}>;

/** Exercise the public socket protocol, never the authority's private game state. */
class Peer {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  snapshot: NetSnapshot | null = null;
  private readonly updates = new Set<() => void>();

  constructor(url: string, origin = ORIGIN) {
    this.socket = new WebSocket(url, {headers: {Origin: origin}});
    this.socket.on('message', data => {
      // Server output is the trusted fixture under test; hostile input is tested separately.
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.messages.push(message);
      if (message.type === 'state') this.snapshot = message.snapshot;
      for (const update of this.updates) update();
    });
    this.socket.on('error', () => undefined);
  }

  async open(): Promise<void> {await once(this.socket, 'open');}
  send(message: ClientMessage): void {this.socket.send(JSON.stringify(message));}

  async next<T extends MessageKind>(type: T, predicate: (value: MessageOf<T>) => boolean = () => true): Promise<MessageOf<T>> {
    return this.wait(() => {
      const index = this.messages.findIndex(message => message.type === type && predicate(message as MessageOf<T>));
      if (index < 0) return null;
      return this.messages.splice(index, 1)[0] as MessageOf<T>;
    });
  }

  async state(predicate: (snapshot: NetSnapshot) => boolean = () => true): Promise<NetSnapshot> {
    return this.wait(() => this.snapshot && predicate(this.snapshot) ? this.snapshot : null);
  }

  private async wait<T>(read: () => T | null): Promise<T> {
    const present = read();
    if (present !== null) return present;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {this.updates.delete(update); reject(new Error('WebSocket message timeout'));}, 5_000);
      const update = () => {
        const value = read();
        if (value === null) return;
        clearTimeout(timeout);
        this.updates.delete(update);
        resolve(value);
      };
      this.updates.add(update);
    });
  }

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    const closed = once(this.socket, 'close');
    this.socket.close();
    await closed;
  }
}

function registration(playerName: string, heroId = 'whale'): PlayerRegistration {
  return {playerName, heroId, deckList: [...DECKS[heroId]]};
}

async function room(port: number, heroA = 'whale', heroB = 'degen') {
  const url = `ws://127.0.0.1:${port}`;
  const creator = new Peer(url);
  await creator.open();
  creator.send({type: 'create', ...registration('Aurelius', heroA)});
  const created = await creator.next('joined');
  assert.match(created.roomCode, /^[A-Z0-9]{6}$/);
  await creator.state(snapshot => snapshot.status === 'waiting');
  const joiner = new Peer(url);
  await joiner.open();
  joiner.send({type: 'join', roomCode: created.roomCode, ...registration('Cassia', heroB)});
  const joinerJoined = await joiner.next('joined');
  await Promise.all([creator.state(snapshot => snapshot.status === 'playing'), joiner.state(snapshot => snapshot.status === 'playing')]);
  const creatorJoined = await creator.next('joined');
  // Server fairly assigns the first turn; names / creator status do not dictate turn order.
  const first = creator.snapshot?.seat === 0 ? creator : joiner;
  const second = first === creator ? joiner : creator;
  const firstJoined = first === creator ? creatorJoined : joinerJoined;
  const secondJoined = second === creator ? creatorJoined : joinerJoined;
  assert.equal(firstJoined.you, 'p1');
  assert.equal(secondJoined.you, 'p2');
  return {url, first, second, firstJoined, secondJoined};
}

function intentFor(action: Action): GameIntent {
  switch (action.type) {
    case 'play-minion': case 'cast-spell': return {type: 'playCard', cardId: action.uid};
    case 'attack': return {type: 'attack', cardId: action.attackerUid, targetId: action.target};
    case 'end-turn': return {type: 'endTurn'};
    case 'hero-power': return {type: 'heroPower'};
    case 'buy-card': return {type: 'buyCard'};
    case 'mulligan': return {type: 'mulligan', cardIds: action.uids};
    case 'stake': case 'unstake': return {type: action.type, cardId: action.uid};
  }
}

async function move(first: Peer, second: Peer, actor: Peer, intent: GameIntent): Promise<NetSnapshot> {
  const before = actor.snapshot;
  assert.ok(before?.game, 'Match must be active before a move');
  actor.send({type: 'intent', intent, revision: before.revision});
  const observer = actor === first ? second : first;
  const [after] = await Promise.all([
    actor.state(snapshot => snapshot.revision > before.revision),
    observer.socket.readyState === WebSocket.OPEN ? observer.state(snapshot => snapshot.revision > before.revision) : Promise.resolve(null),
  ]);
  return after;
}

async function launch(options: Parameters<typeof startServer>[0]) {
  const service = startServer(options);
  if (!service.server.listening) await once(service.server, 'listening');
  return service;
}

function portOf(service: Awaited<ReturnType<typeof startServer>>): number {
  const address = service.server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}

test('two sockets receive separate authorized snapshots and reject takeover / a third seat', async t => {
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN]});
  t.after(() => service.close());
  const match = await room(portOf(service));
  const first = await match.first.state();
  const second = await match.second.state();
  assert.equal(first.roomCode, second.roomCode);
  assert.equal(first.turnDuration, 75);
  assert.deepEqual([...first.names].sort(), ['Aurelius', 'Cassia']);
  assert.equal(first.game?.players[0].hand?.length, 3);
  assert.equal(second.game?.players[1].hand?.length, 4);
  assert.equal(first.game?.players[1].hand, undefined);
  assert.equal(second.game?.players[0].hand, undefined);
  assert.equal(Object.hasOwn(first.game ?? {}, 'rng'), false);
  assert.equal(Object.hasOwn(first.game?.players[0] ?? {}, 'deck'), false);
  assert.equal(second.game?.actions.length, 0, 'Inactive player must not receive actionable options');

  for (const playerName of ['Intruder', first.names[0]]) {
    const intruder = new Peer(match.url);
    await intruder.open();
    intruder.send({type: 'join', roomCode: first.roomCode, ...registration(playerName)});
    assert.ok((await intruder.next('error')).reason);
    assert.equal(match.first.snapshot?.revision, first.revision);
    await intruder.close();
  }
});

test('server rejects wrong turn, foreign / nonexistent attacks and stale revisions without changing state', async t => {
  const rejected: string[] = [];
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN], log: message => rejected.push(message)});
  t.after(() => service.close());
  const {first, second} = await room(portOf(service));
  const start = await first.state();
  second.send({type: 'intent', intent: {type: 'endTurn'}, revision: start.revision});
  assert.ok((await second.next('error')).reason);
  first.send({type: 'intent', intent: {type: 'attack', cardId: 'not-your-fighter', targetId: 'hero'}, revision: start.revision});
  assert.ok((await first.next('error')).reason);
  assert.equal(first.snapshot?.revision, start.revision);

  const kept = await move(first, second, first, {type: 'mulligan', cardIds: []});
  first.send({type: 'intent', intent: {type: 'endTurn'}, revision: start.revision});
  assert.ok((await first.next('error')).reason);
  assert.equal(first.snapshot?.revision, kept.revision);
  assert.ok(rejected.length >= 3, 'Illegal moves should be logged');
});

test('opening replacement accepts the same legal subset in either UID order', async t => {
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN]});
  t.after(() => service.close());
  const {first, second} = await room(portOf(service));
  const before = first.snapshot!;
  const ownHand = before.game!.players[0].hand!;
  const replaced = ownHand.slice(0, 2).map(card => card.uid).reverse();
  const after = await move(first, second, first, {type: 'mulligan', cardIds: replaced});
  assert.equal(after.game?.players[0].hand?.length, ownHand.length);
  assert.equal(after.game?.mulliganOpen, false);
  assert.ok(after.game?.players[0].hand?.every(card => !replaced.includes(card.uid)));
  assert.equal(second.snapshot?.game?.players[0].hand, undefined);
});

test('75-second timer resolves an idle opening and is not extended by a legal move or ping', async t => {
  let now = 1_800_000_000_000;
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN], clock: () => now, tickIntervalMs: 60_000});
  t.after(() => service.close());
  const {first, second} = await room(portOf(service));
  const opening = await first.state();
  assert.equal(opening.game?.turnDeadline, now + 75_000);
  now += 74_999;
  service.rooms.tick();
  first.send({type: 'ping'});
  await first.next('pong');
  assert.equal(first.snapshot?.revision, opening.revision);
  now += 1;
  service.rooms.tick();
  const after = await first.state(snapshot => snapshot.revision > opening.revision);
  assert.equal(after.game?.turn, 1);
  assert.equal(after.game?.block, 2);
  assert.equal(after.game?.turnDeadline, now + 75_000);
  const nextOpening = await second.state(snapshot => snapshot.revision === after.revision);
  assert.equal(nextOpening.game?.mulliganOpen, true);
  const deadline = nextOpening.game?.turnDeadline;
  now += 10_000;
  const kept = await move(first, second, second, {type: 'mulligan', cardIds: []});
  assert.equal(kept.game?.turnDeadline, deadline);
  now = deadline!;
  service.rooms.tick();
  const final = await first.state(snapshot => snapshot.revision > kept.revision);
  assert.equal(final.game?.turn, 0);
  assert.equal(final.game?.turnDeadline, now + 75_000);
});

test('a ten-second network break resumes the same seat and current state with its private token', {timeout: 25_000}, async t => {
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN]});
  t.after(() => service.close());
  const match = await room(portOf(service));
  await move(match.first, match.second, match.first, {type: 'mulligan', cardIds: []});
  await move(match.first, match.second, match.first, {type: 'endTurn'});
  const disconnectedAt = match.second.snapshot!;
  match.first.socket.terminate();
  await match.second.next('opponentLeft');
  await delay(10_000);
  const afterOtherPlayed = await move(match.first, match.second, match.second, {type: 'mulligan', cardIds: []});
  assert.ok(afterOtherPlayed.revision > disconnectedAt.revision);
  const resumed = new Peer(match.url);
  await resumed.open();
  resumed.send({type: 'join', roomCode: match.firstJoined.roomCode, resumeToken: match.firstJoined.resumeToken,
    ...registration(match.first.snapshot!.names[0], match.first.snapshot!.heroId)});
  const joined = await resumed.next('joined');
  assert.equal(joined.you, 'p1');
  assert.equal(joined.resumeToken, match.firstJoined.resumeToken);
  const snapshot = await resumed.state(value => value.status === 'playing');
  assert.equal(snapshot.revision, afterOtherPlayed.revision);
  assert.equal(snapshot.game?.turn, 1);
  assert.equal(snapshot.game?.players[1].hand, undefined);
  assert.equal(snapshot.game?.players[0].hand?.length, 3);
  assert.equal(snapshot.game?.turnDeadline, afterOtherPlayed.game?.turnDeadline);
});

test('a full match accepts public legal card, spell, hero and attack intents through to gameOver', {timeout: 30_000}, async t => {
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN], maxMessagesPerWindow: 10_000});
  t.after(() => service.close());
  const {first, second} = await room(portOf(service), 'validator', 'whale');
  const exercised = new Set<Action['type']>();
  let turns = 0;
  let changed = 0;
  let foreignAttackChecked = false;
  for (; changed < 700; changed++) {
    const common = first.snapshot!;
    if (common.status === 'finished') break;
    const actor = common.game?.turn === 0 ? first : second;
    const snapshot = actor.snapshot!;
    const game = snapshot.game!;
    const own = game.players[snapshot.seat];
    const other = game.players[snapshot.seat === 0 ? 1 : 0];
    if (!foreignAttackChecked && other.board.length) {
      const revision = snapshot.revision;
      actor.send({type: 'intent', intent: {type: 'attack', cardId: other.board[0].uid, targetId: 'hero'}, revision});
      assert.ok((await actor.next('error')).reason);
      assert.equal(actor.snapshot?.revision, revision);
      foreignAttackChecked = true;
    }
    const actions = game.actions;
    assert.ok(actions.length, 'Active seat needs server-provided legal actions');
    const action =
      actions.find(value => value.type === 'mulligan' && !value.uids.length) ??
      (!exercised.has('stake') ? actions.find(value => value.type === 'stake') : undefined) ??
      (!exercised.has('unstake') ? actions.find(value => value.type === 'unstake') : undefined) ??
      (!exercised.has('hero-power') ? actions.find(value => value.type === 'hero-power') : undefined) ??
      actions.find(value => value.type === 'cast-spell') ??
      actions.find(value => value.type === 'play-minion') ??
      actions.find(value => value.type === 'attack' && value.target === 'hero') ??
      actions.find(value => value.type === 'attack') ??
      (own.treasury < 20 ? actions.find(value => value.type === 'hero-power') : undefined) ??
      actions.find(value => value.type === 'end-turn');
    assert.ok(action);
    if (action.type === 'cast-spell') {
      const card = own.hand?.find(value => value.uid === action.uid);
      assert.ok(card && CARDS[card.cardId].type === 'spell');
    }
    if (action.type === 'end-turn') turns++;
    await move(first, second, actor, intentFor(action));
    exercised.add(action.type);
  }
  assert.ok(changed < 700, 'Match should terminate rather than loop indefinitely');
  assert.ok(turns > 2);
  assert.equal(first.snapshot?.status, 'finished');
  assert.equal(second.snapshot?.status, 'finished');
  assert.equal(first.snapshot?.game?.winner, second.snapshot?.game?.winner);
  assert.ok(foreignAttackChecked, 'An enemy fighter attack was rejected during a real battle');
  for (const kind of ['mulligan', 'play-minion', 'cast-spell', 'hero-power', 'attack', 'end-turn', 'stake', 'unstake'] as const) {
  assert.ok(exercised.has(kind), `Exercise ${kind} over the network`);
  }
  const [firstOver, secondOver] = await Promise.all([first.next('gameOver'), second.next('gameOver')]);
  assert.equal(firstOver.winner, secondOver.winner);
  first.send({type: 'intent', intent: {type: 'endTurn'}, revision: first.snapshot!.revision});
  assert.ok((await first.next('error')).reason);
});

test('empty-deck reinforcement is paid once over WS and never exposes the private deck', {timeout:30_000}, async t => {
  const service=await launch({port:0,host:'127.0.0.1',origins:[ORIGIN],maxMessagesPerWindow:10_000});
  t.after(()=>service.close());
  const {first,second}=await room(portOf(service),'builder','builder');
  // Reach exhaustion through ordinary public moves, without editing authority state.
  // Treasury attacks are omitted so this exercises the actual late-game purchase.
  for(let step=0;step<900;step++){
    const actor=first.snapshot!.game!.turn===0?first:second;
    const before=actor.snapshot!,game=before.game!,own=game.players[before.seat];
    assert.equal(before.status,'playing','The defensive match must survive until reserve availability');
    const purchase=game.actions.find(action=>action.type==='buy-card');
    if(purchase){
      assert.equal(own.deckCount,0);
      const observer=actor===first?second:first;
      const after=await move(first,second,actor,{type:'buyCard'});
      const bought=after.game!.players[after.seat];
      assert.equal(bought.gas,own.gas-2);
      assert.equal(bought.handCount,own.handCount+1);
      assert.equal(bought.deckCount,0);
      assert.equal(bought.fatigue,own.fatigue);
      assert.equal(bought.reinforcementUsed,true);
      const added=bought.hand!.find(card=>!own.hand!.some(old=>old.uid===card.uid));
      assert.ok(added&&DECKS.builder.includes(added.cardId));
      const concealed=observer.snapshot!.game!.players[before.seat];
      assert.equal(concealed.hand,undefined);
      assert.equal(Object.hasOwn(concealed,'reinforcementPool'),false);
      assert.equal(Object.hasOwn(concealed,'deck'),false);
      assert.equal(after.game!.actions.some(action=>action.type==='buy-card'),false);
      actor.send({type:'intent',intent:{type:'buyCard'},revision:after.revision});
      assert.ok((await actor.next('error')).reason);
      assert.equal(actor.snapshot!.revision,after.revision);
      observer.send({type:'intent',intent:{type:'buyCard'},revision:after.revision});
      assert.ok((await observer.next('error')).reason);
      assert.equal(observer.snapshot!.revision,after.revision);
      return;
    }
    const action=game.actions.find(a=>a.type==='mulligan'&&!a.uids.length)??
      (own.treasury<=27?game.actions.find(a=>a.type==='hero-power'):undefined)??
      game.actions.find(a=>a.type==='cast-spell')??
      game.actions.find(a=>a.type==='play-minion')??
      game.actions.find(a=>a.type==='attack'&&a.target!=='hero')??
      game.actions.find(a=>a.type==='end-turn');
    assert.ok(action);
    await move(first,second,actor,intentFor(action));
  }
  assert.fail('A real empty-deck purchase should become reachable in the bounded defensive match');
});

test('default rate limit rejects the 101st message in a ten-second window', async t => {
  const logged: string[] = [];
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN], log: line => logged.push(line)});
  t.after(() => service.close());
  const peer = new Peer(`ws://127.0.0.1:${portOf(service)}`);
  await peer.open();
  for (let i = 0; i < 100; i++) {
    peer.send({type: 'ping'});
    await peer.next('pong');
  }
  peer.send({type: 'ping'});
  const error = await peer.next('error');
  assert.equal(error.code, 'rate-limit');
  assert.ok(logged.some(line => line.includes('rate-limit')));
  assert.equal(service.rooms.size, 0);
});

test('malformed JSON and invalid decks are rejected; harmless ping remains usable', async t => {
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN]});
  t.after(() => service.close());
  const peer = new Peer(`ws://127.0.0.1:${portOf(service)}`);
  await peer.open();
  peer.socket.send('{broken');
  assert.ok((await peer.next('error')).reason);
  peer.send({type: 'create', ...registration('Invalid'), deckList: ['lending-legionnaire']});
  assert.ok((await peer.next('error')).reason);
  peer.send({type: 'create', ...registration('Invalid'), deckList: Array<string>(30).fill('unknown-card')});
  assert.ok((await peer.next('error')).reason);
  peer.send({type: 'ping'});
  assert.equal((await peer.next('pong')).type, 'pong');
});

test('foreign origins and oversized frames cannot access the service', async t => {
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN]});
  t.after(() => service.close());
  const url = `ws://127.0.0.1:${portOf(service)}`;
  const foreign = new WebSocket(url, {headers: {Origin: 'https://evil.invalid'}});
  foreign.on('error', () => undefined);
  await new Promise<void>(resolve => foreign.once('close', () => resolve()));
  assert.notEqual(foreign.readyState, WebSocket.OPEN);
  const peer = new Peer(url);
  await peer.open();
  const closed = once(peer.socket, 'close');
  peer.socket.send('x'.repeat(100_000));
  const [code] = await closed;
  assert.equal(code, 1009);
});

test('30 minutes of player inactivity expires a waiting room; explicit departure removes an empty room', async t => {
  let now = 1_800_000_000_000;
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN], clock: () => now, tickIntervalMs: 60_000});
  t.after(() => service.close());
  const peer = new Peer(`ws://127.0.0.1:${portOf(service)}`);
  await peer.open();
  peer.send({type: 'create', ...registration('Idler')});
  const joined = await peer.next('joined');
  await peer.state();
  now += 30 * 60_000 + 1;
  service.rooms.tick();
  assert.equal(service.rooms.size, 0);
  const newcomer = new Peer(`ws://127.0.0.1:${portOf(service)}`);
  await newcomer.open();
  newcomer.send({type: 'join', roomCode: joined.roomCode, ...registration('TooLate')});
  assert.ok((await newcomer.next('error')).reason);
  await newcomer.close();

  const match = await room(portOf(service));
  match.first.send({type: 'leave'});
  await match.second.next('opponentLeft');
  match.second.send({type: 'leave'});
  const afterLeave = new Peer(match.url);
  await afterLeave.open();
  afterLeave.send({type: 'join', roomCode: match.firstJoined.roomCode, ...registration('Uninvited')});
  assert.ok((await afterLeave.next('error')).reason);
  assert.equal(service.rooms.size, 0);
});

test('premium decks require backend ownership; free decks and frozen paid-seat reconnect need no wallet lookup', async t => {
  const previousTitle = process.env.IDOS_TITLE_ID;
  process.env.IDOS_TITLE_ID = 'fixture-title';
  t.after(() => {if (previousTitle === undefined) delete process.env.IDOS_TITLE_ID; else process.env.IDOS_TITLE_ID = previousTitle;});
  const paidCard = PACK_CARD_IDS.find(id => CARDS[id].rarity === 'common')!;
  const paid = registration('Collector');paid.deckList.splice(0, 2, paidCard, paidCard);
  const credential = {userId: 'collector', sessionTicket: 'fixture-secret-ticket-never-expose'};
  let lookups = 0;
  const fetcher: typeof fetch = async (url, options) => {
    lookups++; assert.match(String(url), /fixture-title\/Client\/Collection\/GetUserState\/collector$/);
    assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${credential.sessionTicket}`);
    return new Response(JSON.stringify({Success: true, Data: {CollectionID: 'IMPERIVM_AGORA', OwnedCollectibles: {[paidCard]: 1}}}));
  };
  const service = await launch({port: 0, host: '127.0.0.1', origins: [ORIGIN], authorizeDeck: data => authorizeCollectionDeck(data.deckList, data.collectionAuth, fetcher)});
  t.after(() => service.close());
  const url = `ws://127.0.0.1:${portOf(service)}`, rejected = new Peer(url);
  await rejected.open();rejected.send({type: 'create', ...paid});
  assert.equal((await rejected.next('error')).code, 'collection-access');assert.equal(service.rooms.size, 0);assert.equal(lookups, 0);
  rejected.send({type: 'create', ...registration('Free player')});
  await rejected.next('joined');assert.equal(lookups, 0);await rejected.close();

  const collector = new Peer(url);await collector.open();collector.send({type: 'create', ...paid, collectionAuth: credential});
  const joined = await collector.next('joined');await collector.state(value => value.status === 'waiting');assert.equal(lookups, 1);
  const opponent = new Peer(url);await opponent.open();opponent.send({type: 'join', roomCode: joined.roomCode, ...registration('Free opponent')});
  await opponent.next('joined');const before = await collector.state(value => value.status === 'playing');
  const wire = JSON.stringify([before, opponent.snapshot, ...opponent.messages]);
  assert.equal(wire.includes(credential.sessionTicket), false);assert.equal(wire.includes('collectionAuth'), false);
  await collector.close();
  const resumed = new Peer(url);await resumed.open();
  // Changed registration deck is ignored: resume uses the existing authorized seat and frozen deck.
  resumed.send({type: 'join', roomCode: joined.roomCode, resumeToken: joined.resumeToken, ...registration('Collector')});
  await resumed.next('joined');const after = await resumed.state(value => value.status === 'playing');
  assert.equal(after.revision, before.revision);assert.equal(lookups, 1);assert.deepEqual(after.game, before.game);
});
