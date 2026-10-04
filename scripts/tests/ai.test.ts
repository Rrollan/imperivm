import assert from 'node:assert/strict';
import { chooseAiAction } from '../../lib/ai';
import { createGame, applyAction, legalActions } from '../../lib/engine/engine';
import { DECKS } from '../../lib/decks';
import type { Minion } from '../../lib/engine/types';
const minion = (uid: string, attack: number, health: number, extra: Partial<Minion> = {}): Minion => ({ uid, cardId: 'lending-legionnaire', name: uid, attack, health, maxHealth: health, canAttack: false, staked: false, fresh: false, ...extra });
function fixture() { const s = createGame('whale', DECKS.whale, 'degen', DECKS.degen, 42); s.players[0].hand = []; s.players[0].board = []; s.players[1].board = []; s.players[0].gas = 0; s.players[0].heroPowerUsed = true; return s; }
let state = fixture(); state.players[0].maxGas = 2; state.players[0].hand = [{ uid: 'expensive', cardId: 'imperator-liquidus' }]; state.players[0].board = [minion('income1', 1, 3), minion('income2', 1, 3)];
const first = chooseAiAction(state); assert.equal(first.type, 'stake'); state = applyAction(state, first); assert.equal(chooseAiAction(state).type, 'end-turn', 'A second creature must remain available for later combat');
state.players[0].maxGas = 8; const release = chooseAiAction(state); assert.equal(release.type, 'unstake'); state = applyAction(state, release); assert.equal(chooseAiAction(state).type, 'end-turn', 'No stake/unstake cycle');
state = fixture(); state.players[0].board = [minion('attacker', 3, 5, { canAttack: true })]; state.players[1].board = [minion('guard', 1, 10, { taunt: true })]; assert.deepEqual(chooseAiAction(state), { type: 'attack', attackerUid: 'attacker', target: 'guard' });
state = fixture(); state.players[0].gas = 10; state.players[0].hand = [{ uid: 'new-card', cardId: 'imperator-liquidus' }]; state.players[0].board = [minion('lethal', 4, 6, { canAttack: true })]; state.players[1].treasury = 3; state.players[1].board = [minion('tempting-trade', 1, 1)]; assert.deepEqual(chooseAiAction(state), { type: 'attack', attackerUid: 'lethal', target: 'hero' });
state = fixture(); state.players[0].gas = 10; state.players[0].maxGas = 10; state.players[0].hand = [{ uid: 'rug', cardId: 'rug-pull' }]; state.players[0].board = [minion('winning-army', 5, 5)]; state.players[1].board = [minion('small-rival', 1, 1)]; assert.equal(chooseAiAction(state).type, 'end-turn', 'Keep a reset while ahead');
state.players[1].board = [minion('threat1', 8, 8), minion('threat2', 8, 8)]; assert.deepEqual(chooseAiAction(state), { type: 'cast-spell', uid: 'rug' });
assert(legalActions(state).some(a => JSON.stringify(a) === JSON.stringify(chooseAiAction(state))));
console.log('PASS single income unit, timely unstaking, no loops, Taunt pressure, lethal priority and recovery-only RUG PULL');
