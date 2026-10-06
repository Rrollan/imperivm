import type {CreateGameOptions,GameState,PlayerId} from './types';

export type RulesetId='classic-v1'|'validator-investment-v1';
export interface RulesetOptions extends CreateGameOptions {ruleset?:RulesetId}

/** Optional, serializable experiment metadata; legacy state shapes stay intact. */
export function rulesetOf(state:GameState):RulesetId {
  return (state as GameState&{rulesetVersion?:RulesetId}).rulesetVersion==='validator-investment-v1'?'validator-investment-v1':'classic-v1';
}
export function pendingValidatorOrders(state:GameState,owner:PlayerId):number {
  return rulesetOf(state)==='validator-investment-v1'?(state.players[owner] as GameState['players'][0]&{validatorIncome?:number}).validatorIncome??0:0;
}
