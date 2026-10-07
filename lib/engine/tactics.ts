import type {CardDef, EffectDef, GameState, PlayerId, PlayerState} from './types';
import {CARDS} from '../cards';

export const BASE_BOARD_CAPACITY = 5;
export const MAX_BOARD_CAPACITY = 7;
export function boardCapacity(player: PlayerState): number {
  const capacity = player.boardCapacity;
  return typeof capacity === 'number' && Number.isInteger(capacity)
    ? Math.max(BASE_BOARD_CAPACITY, Math.min(MAX_BOARD_CAPACITY, capacity)) : BASE_BOARD_CAPACITY;
}
/** Evaluate before paying/placing the card: the new fighter cannot satisfy its own condition. */
export function ultimateProgress(state: GameState, owner: PlayerId, card: CardDef): number {
  const ultimate = card.ultimate, player = state.players[owner];
  if (!ultimate) return 0;
  if (ultimate.condition === 'faction-plays') return player.factionPlaysThisTurn?.[ultimate.faction ?? card.faction] ?? 0;
  return player.board.filter(fighter => (fighter.arrivedBlock === undefined ? !fighter.fresh : state.block - fighter.arrivedBlock >= 2) && (ultimate.condition === 'staked'
    ? fighter.staked : CARDS[fighter.cardId]?.faction === (ultimate.faction ?? card.faction))).length;
}
export function ultimateReady(state: GameState, owner: PlayerId, card: CardDef): boolean {
  return !!card.ultimate && ultimateProgress(state, owner, card) >= card.ultimate.count;
}
export function battlecryFor(state: GameState, owner: PlayerId, card: CardDef): EffectDef | undefined {
  return ultimateReady(state, owner, card) ? card.ultimate?.effect : card.battlecry;
}
