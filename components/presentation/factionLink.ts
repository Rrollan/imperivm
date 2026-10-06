import type {Faction,PlayerState} from '../../lib/engine/types';

/** The engine pays exactly once, on the second play of each faction. */
export function factionLink(player:PlayerState,faction:Faction){
  const played=player.factionPlaysThisTurn?.[faction]??0;
  const earned=player.pavilionBonuses?.includes(faction)??false;
  return {played,earned,step:earned?2:Math.min(1,played),refundOnNext:played===1&&!earned};
}
