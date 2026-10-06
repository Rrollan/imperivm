import {pendingValidatorOrders} from '../../lib/engine/ruleset';
import type {PresentationBatch} from './GameSession';

/** A consumed promise is a payout; merely reserving it never lights the rack. */
export function validatorPayout(batch:PresentationBatch){
  if(batch.action.type!=='end-turn'&&batch.action.type!=='mulligan')return null;
  const owner=batch.after.turn,amount=pendingValidatorOrders(batch.before,owner);
  return amount>0&&pendingValidatorOrders(batch.after,owner)===0?{owner,amount}:null;
}
