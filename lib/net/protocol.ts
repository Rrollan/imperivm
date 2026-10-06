import type {OnlineRoom} from '../multiplayer/types';

export type Seat = 'p1' | 'p2';
export interface PlayerRegistration {playerName: string; deckList: string[]; heroId?: string}
export interface CreateMessage extends PlayerRegistration {type: 'create'}
export interface JoinMessage extends PlayerRegistration {type: 'join'; roomCode: string; resumeToken?: string}
export type GameIntent =
  | {type: 'playCard'; cardId: string}
  | {type: 'attack'; cardId: string; targetId: string}
  | {type: 'endTurn'}
  | {type: 'heroPower'}
  | {type: 'mulligan'; cardIds: string[]}
  | {type: 'stake' | 'unstake'; cardId: string}
  | {type: 'concede'};
/** cardId / cardIds identify card INSTANCE UIDs, not catalogue definition IDs. */
export interface IntentMessage {type: 'intent'; intent: GameIntent; revision?: number}
export type ClientMessage = CreateMessage | JoinMessage | IntentMessage | {type: 'ping'} | {type: 'sync'} | {type: 'leave'};
export interface NetSnapshot extends OnlineRoom {
  roomCode: string;
  names: [string, string | null];
  serverTime: number;
  turnDuration: 75;
}
export interface JoinedMessage {type: 'joined'; you: Seat; roomCode: string; resumeToken: string; opponent: {name: string}}
export interface StateMessage {type: 'state'; snapshot: NetSnapshot}
export interface ErrorMessage {type: 'error'; reason: string; code: string; fatal?: boolean}
export interface GameOverMessage {type: 'gameOver'; winner: Seat | 'draw'; reason: string}
export type ServerMessage = JoinedMessage | StateMessage | ErrorMessage | GameOverMessage | {type: 'opponentLeft'} | {type: 'pong'; serverTime: number};
