import assert from 'node:assert/strict';
import { applyAction, createGame, mempoolOf } from '../lib/engine/engine';
import { DECKS } from '../lib/decks';
import { diffAction } from '../lib/events';
import type { GameState, Minion } from '../lib/engine/types';

const fighter = (uid: string, health: number): Minion => ({
  uid,
  cardId: 'amm-centurion',
  name: 'AMM Centurion',
  attack: 2,
  health,
  maxHealth: health,
  staked: false,
  canAttack: true,
  fresh: false,
  taunt: false,
  rush: false,
  lifesteal: false,
});

function mixedQueueFixture(): GameState {
  const state = createGame('builder', DECKS.builder, 'degen', DECKS.degen, 501);
  state.players[0].hand = [
    { uid: 'fixture-solar', cardId: 'solar-sapper' },
    { uid: 'fixture-rug', cardId: 'rug-pull' },
  ];
  // This is a legal above-cap bonus balance: each cast is validated against
  // current gas, and both casts fit (3 + 8). The engine permits bonus gas.
  state.players[0].gas = 11;
  state.players[0].maxGas = 10;
  state.players[0].board = [];
  state.players[1].board = [
    fighter('dies-to-solar', 2),
    fighter('dies-to-rug', 4),
  ];
  return state;
}

let state = mixedQueueFixture();
state = applyAction(state, { type: 'cast-spell', uid: 'fixture-solar' });
state = applyAction(state, { type: 'cast-spell', uid: 'fixture-rug' });
assert.equal(mempoolOf(state, 0).length, 2, 'Both legal spells enter the queue');
state = applyAction(state, { type: 'end-turn' });
const beforeResolve = state;
const afterResolve = applyAction(beforeResolve, { type: 'end-turn' });
const events = diffAction(beforeResolve, afterResolve, { type: 'end-turn' });

assert.ok(events, 'The owner-turn queue resolution produces an event batch');
assert.deepEqual(events.spellResolved?.map(spell => spell.cardId), ['solar-sapper', 'rug-pull']);
assert.deepEqual(
  events.deaths?.map(death => [death.uid, death.byRugi, death.cause]),
  [['dies-to-solar', false, 'damage'], ['dies-to-rug', true, 'rugpull']],
  'A prior lethal damage effect and the later RUG PULL retain their own death causes',
);

const solar = events.effectResults?.find(effect => effect.cardId === 'solar-sapper');
assert.deepEqual(
  solar?.targets.map(target => [target.uid, target.healthBefore, target.healthAfter]),
  [['dies-to-solar', 2, 0], ['dies-to-rug', 4, 2]],
  'The damage ledger retains exact targets and results before the later board reset',
);
assert.deepEqual(
  events.damages?.map(damage => [damage.uid, damage.prevHealth, damage.health, damage.died]),
  [['dies-to-solar', 2, 0, true]],
  'Only the fighter killed by damage gets the aggregate lethal damage float; RUG PULL adds no fictitious damage float',
);
assert.equal(events.damages?.filter(damage => damage.uid === 'dies-to-solar').length, 1,
  'A lethal damage result is represented once in the aggregate float list');
assert.equal(afterResolve.players[1].board.length, 0, 'RUG PULL still removes the remaining board');

console.log('PASS mixed queue: per-minion death cause, lethal damage float, and no RUG PULL damage float');
