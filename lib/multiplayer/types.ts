import type {Action, HandCard, MempoolEntry, Minion, PlayerId, PlayerState} from '../engine/types';

/** Deliberate wire allowlist. Never send GameState, hidden decks, RNG, or guest credentials. */
export interface OnlinePlayer {
  id: PlayerId;
  heroId: string;
  treasury: number;
  gas: number;
  maxGas: number;
  fatigue: number;
  heroPowerUsed: boolean;
  reinforcementUsed?: boolean;
  powerCost: number;
  handCount: number;
  deckCount: number;
  board: Minion[];
  edicts: MempoolEntry[];
  hand?: HandCard[];
  boardCapacity?: number;
  factionPlaysThisTurn?: PlayerState['factionPlaysThisTurn'];
  pavilionBonuses?: PlayerState['pavilionBonuses'];
}
export interface OnlineGame {
  block: number;
  turn: PlayerId;
  winner: PlayerId | 'draw' | null;
  players: [OnlinePlayer, OnlinePlayer];
  actions: Action[];
  mulliganOpen: boolean;
  turnDeadline: number;
}
export interface OnlineRoom {
  id: string;
  mode: 'friend' | 'random';
  status: 'waiting' | 'playing' | 'finished';
  revision: number;
  seat: PlayerId;
  heroId: string;
  expiresAt: number;
  opponentPresent: boolean;
  disconnectDeadline: number | null;
  resultReason: 'battle' | 'concede' | 'disconnect' | 'expired' | null;
  game: OnlineGame | null;
  history: Array<{revision: number; text: string; textEn?: string}>;
}
export interface OnlineSession {
  room: OnlineRoom | null;
  queue: {enteredAt: number; expiresAt: number; heroId: string} | null;
}
export type OnlineCommand =
  | {type: 'session'}
  | {type: 'create'; heroId: string}
  | {type: 'join'; roomId: string; heroId: string}
  | {type: 'queue'; heroId: string}
  | {type: 'cancel'}
  | {type: 'action'; roomId: string; revision: number; action: Action}
  | {type: 'concede'; roomId: string; revision: number};
