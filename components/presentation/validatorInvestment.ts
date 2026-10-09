import {pendingValidatorOrders} from '../../lib/engine/ruleset';
import type {PresentationBatch} from './GameSession';

/** A consumed promise is a payout; merely reserving it never lights the rack. */
export function validatorPayout(batch:PresentationBatch){
  if(batch.action.type!=='end-turn'&&batch.action.type!=='mulligan')return null;
  const owner=batch.after.turn,amount=pendingValidatorOrders(batch.before,owner)+(batch.before.players[owner].powerIncome??0);
  return amount>0&&pendingValidatorOrders(batch.after,owner)+(batch.after.players[owner].powerIncome??0)===0?{owner,amount}:null;
}
