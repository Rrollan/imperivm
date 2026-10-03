/** Deterministic rule fixtures plus bounded AI matches. Run npm run smoke. */
import assert from 'node:assert/strict';
import { applyAction, createGame, legalActions, mempoolOf, effectivePowerCost, mulliganAvailable } from '../lib/engine/engine';
import { CARDS } from '../lib/cards';
import { DECKS } from '../lib/decks';
import { chooseAiAction } from '../lib/ai';
import type { GameState, Minion, PlayerId, MempoolEntry, Action } from '../lib/engine/types';

let tests = 0;
function test(name: string, run: () => void) { run(); tests++; console.log(`PASS ${name}`); }
function fixture(): GameState {
  const s = createGame('whale', DECKS.whale, 'builder', DECKS.builder, 42);
  for (const p of s.players) { p.hand = []; p.board = []; p.gas = 10; p.maxGas = 10; }
  return s;
}
function hand(s: GameState, pid: PlayerId, ...ids: string[]) {
  s.players[pid].hand = ids.map((cardId, i) => ({ uid: `h${pid}-${i}`, cardId }));
}
function minion(s: GameState, pid: PlayerId, id: string, props: Partial<Minion> = {}): Minion {
  const c = CARDS[id]; assert(c.type === 'minion');
  const m: Minion = { uid: `m${pid}-${s.players[pid].board.length}`, cardId: id, name: c.name,
    attack: c.attack!, health: c.health!, maxHealth: c.health!, canAttack: true, staked: false,
    taunt: c.taunt, rush: c.rush, lifesteal: c.lifesteal, fresh: false, ...props };
  s.players[pid].board.push(m); return m;
}
function pool(s: GameState, pid: PlayerId, ...ids: string[]) {
  (s.players[pid] as typeof s.players[0] & { mempool: MempoolEntry[] }).mempool = ids.map((cardId, i) =>
    ({ uid: `e${pid}-${i}`, cardId, name: CARDS[cardId].name, owner: pid }));
}
const end = (s: GameState) => applyAction(s, { type: 'end-turn' });
const round = (s: GameState) => end(end(s));
function play(s: GameState): GameState { const h = s.players[s.turn].hand[0]; return applyAction(s,
  CARDS[h.cardId].type === 'minion' ? { type: 'play-minion', uid: h.uid } : { type: 'cast-spell', uid: h.uid }); }
const attack = (attackerUid: string, target: string): Action => ({ type: 'attack', attackerUid, target });

test('legacy seed, opening hand, immutable action, caps and burns', () => {
  const initial = createGame('whale', DECKS.whale, 'builder', DECKS.builder, 42);
  assert.deepEqual(initial, createGame('whale', DECKS.whale, 'builder', DECKS.builder, 42));
  assert.deepEqual(initial.players.map(p => [p.hand.length, p.gas, p.treasury]), [[3, 1, 30], [4, 0, 30]]);
  let s = fixture(); hand(s, 0, ...Array(10).fill('lending-legionnaire'));
  for (let i = 0; i < 7; i++) minion(s, 0, 'lending-legionnaire');
  const original = structuredClone(s);
  assert(!legalActions(s).some(a => a.type === 'play-minion'));
  s = round(s); assert.deepEqual(original.players[0].hand.length, 10);
  assert.equal(s.players[0].hand.length, 10); assert(s.log.some(l => l.includes('burns')));
  assert.equal(s.players[0].maxGas, 10); assert.equal(s.players[0].gas, 10);
  assert.equal(original.block, 1); assert.equal(original.players[0].deck.length, 27);
  assert.equal(initial.block, 1); assert.equal(end(initial).block, 2); assert.equal(initial.block, 1);
});
test('fatigue increases, lethal and simultaneous draw', () => {
  let s = fixture(); s.players[0].deck = []; s.players[0].treasury = 4;
  s = round(s); assert.equal(s.players[0].fatigue, 1); assert.equal(s.players[0].treasury, 3);
  s = round(s); assert.equal(s.players[0].fatigue, 2); assert.equal(s.players[0].treasury, 1);
  s = round(s); assert.equal(s.winner, 1); assert.equal(legalActions(s).length, 0);
  s = fixture(); s.players.forEach(p => p.treasury = 0); s.players[1].deck = []; s = end(s); assert.equal(s.winner, 'draw');
});
test('halving at actual next block, staking and unstaking', () => {
  let s = fixture(); s.block = 3; const farmer = minion(s, 0, 'yield-farmer');
  s = end(s); const m = s.players[0].board[0]; assert.equal(m.attack, farmer.attack + 1);
  assert.equal(m.health, farmer.health + 1); assert.equal(s.block, 4);
  s = fixture(); minion(s, 0, 'lending-legionnaire', { staked: true, canAttack: false });
  s.players[0].maxGas = 2; s = round(s); assert.equal(s.players[0].gas, 4);
  const uid = s.players[0].board[0].uid; s = applyAction(s, { type: 'unstake', uid });
  assert(!legalActions(s).some(a => a.type === 'attack'));
  s = round(s); assert(legalActions(s).some(a => a.type === 'attack'));
});
test('mempool resolves on owner turn, in order, before halving', () => {
  let s = fixture(); hand(s, 0, 'solar-sapper'); minion(s, 1, 'pixel-squire', { health: 1 });
  s = play(s); assert.equal(mempoolOf(s, 0).length, 1); s = end(s);
  assert.equal(mempoolOf(s, 0).length, 1); assert.equal(s.players[1].board.length, 1);
  s = end(s); assert.equal(mempoolOf(s, 0).length, 0); assert.equal(s.players[1].board.length, 0);
  s = fixture(); s.turn = 1; s.block = 3; pool(s, 0, 'rug-pull', 'flash-loan');
  minion(s, 0, 'yield-farmer'); minion(s, 1, 'yield-farmer'); s = end(s);
  assert.equal(s.players[0].board.length, 0); assert.equal(s.players[1].board.length, 0);
  assert(!s.log.some(l => l.startsWith('Halving:')));
  const resolves = s.log.filter(l => l.endsWith(' resolves'));
  assert.deepEqual(resolves, ['RUG PULL resolves', 'Flash Loan resolves']);
});
test('priority highest cost and earliest ties; original Frontrun double counter', () => {
  let s = fixture(); pool(s, 1, 'flash-loan', 'rug-pull', 'rug-pull'); hand(s, 0, 'priority-fee');
  s = play(s); assert.deepEqual(mempoolOf(s, 1).map(e => e.uid), ['e1-0', 'e1-2']);
  s = fixture(); pool(s, 1, 'flash-loan', 'rug-pull', 'solar-sapper'); hand(s, 0, 'frontrun-bot');
  s = play(s); assert.deepEqual(mempoolOf(s, 1).map(e => e.cardId), ['flash-loan']);
});
test('Taunt rejects face and non-taunt, supports multiple and staked guards', () => {
  let s = fixture(); const a = minion(s, 0, 'lending-legionnaire', { attack: 10, health: 20, maxHealth: 20 });
  const t = minion(s, 1, 'profile-pic-phalanx', { staked: true });
  const t2 = minion(s, 1, 'hotspot-hoplite'); const n = minion(s, 1, 'pixel-squire');
  assert.throws(() => applyAction(s, attack(a.uid, 'hero')));
  assert.throws(() => applyAction(s, attack(a.uid, n.uid)));
  assert.deepEqual(legalActions(s).filter(a => a.type === 'attack').map(a => a.type === 'attack' && a.target), [t.uid, t2.uid]);
  s = applyAction(s, attack(a.uid, t.uid)); assert.equal(s.players[1].board.length, 2);
  s = round(s); s = applyAction(s, attack(a.uid, t2.uid)); s = round(s);
  assert(legalActions(s).some(x => x.type === 'attack' && x.target === 'hero'));
});
test('Rush only minions on summon turn, staking blocks rush, next turn allows face', () => {
  let s = fixture(); hand(s, 0, 'blue-chip-basilisk'); minion(s, 1, 'pixel-squire'); s = play(s);
  const uid = s.players[0].board[0].uid;
  assert(legalActions(s).some(a => a.type === 'attack')); assert.throws(() => applyAction(s, attack(uid, 'hero')));
  s = applyAction(s, { type: 'stake', uid }); assert(!legalActions(s).some(a => a.type === 'attack'));
  s = applyAction(s, { type: 'unstake', uid }); assert(!legalActions(s).some(a => a.type === 'attack'));
  s = round(s); assert(legalActions(s).some(a => a.type === 'attack' && a.target === 'hero'));
});
test('Lifesteal uses actual HP: minion/hero overkill, fatal attacker, retaliation, cap', () => {
  let s = fixture(); s.players[0].treasury = 20; s.players[1].treasury = 2;
  let a = minion(s, 0, 'liquidation-officer', { attack: 8 }); s = applyAction(s, attack(a.uid, 'hero'));
  assert.equal(s.players[0].treasury, 22); assert.equal(s.winner, 0);
  s = fixture(); s.players[0].treasury = 29; s.players[1].treasury = 20;
  a = minion(s, 0, 'liquidation-officer', { attack: 8, health: 1 });
  const b = minion(s, 1, 'liquidation-officer', { attack: 8, health: 2 });
  s = applyAction(s, attack(a.uid, b.uid)); assert.equal(s.players[0].board.length, 0);
  assert.equal(s.players[1].board.length, 0); assert.equal(s.players[0].treasury, 30); assert.equal(s.players[1].treasury, 21);
});
test('Pavilion exactly second faction play, resets and does not count resolves', () => {
  let s = fixture(); hand(s, 0, 'lending-legionnaire', 'lending-legionnaire', 'lending-legionnaire');
  s = play(s); assert.equal(s.players[0].gas, 9); s = play(s); assert.equal(s.players[0].gas, 9);
  s = play(s); assert.equal(s.players[0].gas, 8); assert.deepEqual(s.players[0].pavilionBonuses, ['DeFi']);
  s = round(s); assert.deepEqual(s.players[0].pavilionBonuses, []);
  s = fixture(); s.turn = 1; pool(s, 0, 'flash-loan', 'flash-loan'); s = end(s);
  assert.deepEqual(s.players[0].factionPlaysThisTurn, {}); assert.deepEqual(s.players[0].pavilionBonuses, []);
});
test('Comeback boundaries and once-per-turn power', () => {
  let s = fixture(); s.players[0].treasury = 12; s.players[1].treasury = 24;
  assert.equal(effectivePowerCost(s, 0), 1); s.players[1].treasury = 23; assert.equal(effectivePowerCost(s, 0), 2);
  s.players[0].treasury = 13; s.players[1].treasury = 30; assert.equal(effectivePowerCost(s, 0), 2);
  s.players[0].treasury = 12; s.players[0].gas = 1; s = applyAction(s, { type: 'hero-power' });
  assert.equal(s.players[0].gas, 0); assert.equal(s.players[0].heroPowerUsed, true);
  s.players[0].gas = 10; assert.throws(() => applyAction(s, { type: 'hero-power' }));
});
test('Mulligan all subsets/keep, validates selection and closes one-shot window', () => {
  let s = createGame('whale', DECKS.whale, 'builder', DECKS.builder, { enableMulligan: true }, 1);
  assert.equal(legalActions(s).length, 8); assert(legalActions(s).every(a => a.type === 'mulligan'));
  assert.throws(() => end(s)); const u = s.players[0].hand[0].uid;
  assert.throws(() => applyAction(s, { type: 'mulligan', uids: [u, u] }));
  assert.throws(() => applyAction(s, { type: 'mulligan', uids: ['foreign'] }));
  const before = structuredClone(s.players[0]); s = applyAction(s, { type: 'mulligan', uids: [] });
  assert.deepEqual(s.players[0].hand, before.hand); assert.equal(s.players[0].deck.length, 27);
  assert.equal(s.players[0].gas, 1); assert(!mulliganAvailable(s));
  assert.throws(() => applyAction(s, { type: 'mulligan', uids: [] }));
  s = end(s); assert.equal(s.block, 2); assert.equal(s.players[1].gas, 0); assert.equal(s.players[1].hand.length, 4);
  assert.equal(legalActions(s).length, 16); s = applyAction(s, { type: 'mulligan', uids: [s.players[1].hand[0].uid] });
  assert.equal(s.block, 2); assert.equal(s.turn, 1); assert.equal(s.players[1].gas, 1);
  assert.equal(s.players[1].hand.length, 5); assert.equal(s.players[1].deck.length, 25);
  s = end(s); assert.equal(s.block, 3); assert.equal(s.players[0].gas, 2);
  s = createGame('whale', DECKS.whale, 'builder', DECKS.builder, { enableMulligan: true, mulliganCount: 2 }, 1);
  assert.equal(legalActions(s).length, 7);
  assert.throws(() => applyAction(s, { type: 'mulligan', uids: s.players[0].hand.map(h => h.uid) }));
});
test('Mulligan replacement drawn before rejected card is reinserted, conservation', () => {
  let s = createGame('whale', DECKS.whale, 'builder', DECKS.builder, { enableMulligan: true }, 3);
  hand(s, 0, 'rug-pull', 'priority-fee', 'flash-loan'); s.players[0].deck = ['yield-farmer', 'pixel-squire'];
  s = applyAction(s, { type: 'mulligan', uids: ['h0-0'] });
  assert.deepEqual(s.players[0].hand.map(h => h.cardId), ['priority-fee', 'flash-loan', 'yield-farmer']);
  assert.equal(s.players[0].deck.length, 2); assert(s.players[0].deck.includes('rug-pull'));
});
test('Audit counters highest enemy Rug immediately, delayed buff and affordability', () => {
  let s = fixture(); pool(s, 1, 'rug-pull', 'rug-pull', 'flash-loan'); hand(s, 0, 'audit');
  s.players[0].gas = 2; assert.throws(() => play(s)); s.players[0].gas = 3;
  minion(s, 0, 'lending-legionnaire'); s = play(s);
  assert.deepEqual(mempoolOf(s, 1).map(e => e.uid), ['e1-1', 'e1-2']);
  assert.equal(s.players[0].board[0].attack, 1); assert.equal(mempoolOf(s, 0).length, 1);
  s = fixture(); hand(s, 0, 'audit'); minion(s, 0, 'lending-legionnaire'); s = play(s);
  assert(s.log.some(l => l.includes('counter fizzles'))); s = round(s);
  assert.equal(s.players[0].board[0].attack, 2); assert.equal(s.players[0].board[0].health, 2);
});
for (const a of Object.keys(DECKS)) for (const b of Object.keys(DECKS)) for (const seed of [1, 42, 1337]) {
  test(`AI ${a}/${b} seed ${seed} with mulligan`, () => {
    let s = createGame(a, DECKS[a], b, DECKS[b], { enableMulligan: true }, seed); let steps = 0;
    while (s.winner === null && steps++ < 3000) {
      const action = chooseAiAction(s);
      assert(legalActions(s).some(x => JSON.stringify(x) === JSON.stringify(action)), 'AI returned illegal action');
      s = applyAction(s, action); assert(s.log.length <= 120); assert(s.players.every(p => p.hand.length <= 10 && p.board.length <= 7));
    }
    assert.notEqual(s.winner, null, `AI stalled at block ${s.block}`);
  });
}
console.log(`${tests} regression groups passed.`);
