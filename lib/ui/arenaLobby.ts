import { CARDS } from '../cards';
import type { Rarity } from '../engine/types';
import type { CollectionSnapshot } from '../collection/gateway';

export const ARENA_RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const RUG_STAKES = [10, 25, 50, 100];
export type StakeMode = 'free' | 'rug' | 'card';
export type LobbyTerms = { mode: StakeMode; amount: number; cardId: string; rarity: Rarity };
export type StakeProblem = 'collection' | 'amount' | 'balance' | 'ownership' | 'rarity' | null;

/** UI guard only. The future server must validate ownership and both offers atomically. */
export function validateLobbyTerms(terms: LobbyTerms, collection: CollectionSnapshot | null, opponentCardId?: string): StakeProblem {
  if (terms.mode === 'free') return null;
  if (!collection) return 'collection';
  if (terms.mode === 'rug') {
    if (!Number.isSafeInteger(terms.amount) || !RUG_STAKES.includes(terms.amount)) return 'amount';
    return collection.rug >= terms.amount ? null : 'balance';
  }
  const card = CARDS[terms.cardId];
  if (!card || !(collection.owned[terms.cardId] > 0)) return 'ownership';
  if (!ARENA_RARITIES.includes(terms.rarity) || card.rarity !== terms.rarity) return 'rarity';
  if (opponentCardId && (!CARDS[opponentCardId] || CARDS[opponentCardId].rarity !== card.rarity)) return 'rarity';
  return null;
}

export {createRoomCode, normalizeRoomCode, validRoomCode} from '../net/roomCode';
