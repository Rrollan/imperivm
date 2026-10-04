import type { Action, GameState } from '../engine/types';
import type { BattleEvents } from '../events';
import { mempoolOf } from '../engine/engine';
export interface MatchStats {
  cardsPlayed: number; attacks: number; treasuryDamage: number;
  treasuryHealed: number; minionsLost: number; counters: number; stakes: number;
}
export const emptyMatchStats = (): MatchStats => ({ cardsPlayed: 0, attacks: 0, treasuryDamage: 0,
  treasuryHealed: 0, minionsLost: 0, counters: 0, stakes: 0 });
export function updateMatchStats(stats: MatchStats, prev: GameState, next: GameState,
  action: Action | null, events: BattleEvents | null): MatchStats {
  const ownAction = prev.turn === 0;
  const ownResolution = action?.type === 'end-turn' && next.turn === 0;
  return {
    cardsPlayed: stats.cardsPlayed + (ownAction && (action?.type === 'play-minion' || action?.type === 'cast-spell') ? 1 : 0),
    attacks: stats.attacks + (ownAction && action?.type === 'attack' ? 1 : 0),
    treasuryDamage: stats.treasuryDamage + (ownAction || ownResolution ? Math.max(0, prev.players[1].treasury - next.players[1].treasury) : 0),
    treasuryHealed: stats.treasuryHealed + Math.max(0, next.players[0].treasury - prev.players[0].treasury),
    minionsLost: stats.minionsLost + prev.players[0].board.filter(m => !next.players[0].board.some(n => n.uid === m.uid)).length,
    counters: stats.counters + (ownAction && action?.type !== 'end-turn' ? mempoolOf(prev, 1).filter(e => !mempoolOf(next, 1).some(n => n.uid === e.uid)).length : 0),
    stakes: stats.stakes + (ownAction && action?.type === 'stake' ? 1 : 0),
  };
}
