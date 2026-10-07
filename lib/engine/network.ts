/** DOM-free facade: this exact engine and content run in Next and in the WS service. */
import {CARDS} from '../cards';
import {boardCapacity} from './tactics';
import {applyAction, createGame, effectivePowerCost, legalActions, mempoolOf, mulliganAvailable} from './engine';
import type {Action, GameState, PlayerId} from './types';
import type {OnlineGame, OnlinePlayer} from '../multiplayer/types';
import type {GameIntent} from '../net/protocol';
export {createGame};

export function actionForIntent(state: GameState, intent: Exclude<GameIntent, {type: 'concede'}>): Action {
  switch (intent.type) {
    case 'playCard': {
      const card = state.players[state.turn].hand.find(c => c.uid === intent.cardId);
      if (!card) throw new Error('Карта отсутствует в вашей руке.');
      return {type: CARDS[card.cardId].type === 'minion' ? 'play-minion' : 'cast-spell', uid: card.uid};
    }
    case 'attack': return {type: 'attack', attackerUid: intent.cardId, target: intent.targetId};
    case 'endTurn': return {type: 'end-turn'};
    case 'heroPower': return {type: 'hero-power'};
    case 'mulligan': return {type: 'mulligan', uids: intent.cardIds};
    case 'stake': case 'unstake': return {type: intent.type, uid: intent.cardId};
  }
}
export function isLegalMove(state: GameState, seat: PlayerId, action: Action): boolean {
  // The engine treats opening picks as a set; clicking them in another order
  // must not change legality. Keep duplicates so the engine still rejects them.
  const key = (move: Action) => JSON.stringify(move.type === 'mulligan' ? {...move, uids: [...move.uids].sort()} : move);
  return state.winner === null && state.turn === seat && legalActions(state).some(candidate => key(candidate) === key(action));
}
export function applyMove(state: GameState, seat: PlayerId, action: Action): GameState {
  if (!isLegalMove(state, seat, action)) throw new Error('Это действие сейчас недоступно.');
  return applyAction(state, action);
}
export function endExpiredTurn(state: GameState): GameState {
  const ready = mulliganAvailable(state) ? applyAction(state, {type: 'mulligan', uids: []}) : state;
  return ready.winner === null ? applyMove(ready, ready.turn, {type: 'end-turn'}) : ready;
}
/** A full authorized view. No enemy hand, deck order, private bookkeeping, or RNG. */
export function gameSnapshot(state: GameState, seat: PlayerId, turnDeadline: number): OnlineGame {
  const players = state.players.map((p, index): OnlinePlayer => ({
    id: p.id, heroId: p.heroId, treasury: p.treasury, gas: p.gas, maxGas: p.maxGas,
    fatigue: p.fatigue, heroPowerUsed: p.heroPowerUsed, powerCost: effectivePowerCost(state, index as PlayerId),
    handCount: p.hand.length, deckCount: p.deck.length,
    boardCapacity: boardCapacity(p), factionPlaysThisTurn: {...p.factionPlaysThisTurn}, pavilionBonuses: [...(p.pavilionBonuses??[])],
    board: p.board.map(m => ({uid: m.uid, cardId: m.cardId, name: m.name, attack: m.attack, health: m.health,
      maxHealth: m.maxHealth, canAttack: m.canAttack, staked: m.staked, taunt: !!m.taunt, rush: !!m.rush,
      lifesteal: !!m.lifesteal, fresh: !!m.fresh, ...(m.arrivedBlock===undefined?{}:{arrivedBlock:m.arrivedBlock})})),
    edicts: mempoolOf(state, index as PlayerId).map(e => ({...e})),
    ...(index === seat ? {hand: p.hand.map(c => ({...c}))} : {}),
  })) as [OnlinePlayer, OnlinePlayer];
  return {block: state.block, turn: state.turn, winner: state.winner, players,
    actions: state.turn === seat && state.winner === null ? legalActions(state) : [],
    mulliganOpen: state.turn === seat && mulliganAvailable(state), turnDeadline};
}
