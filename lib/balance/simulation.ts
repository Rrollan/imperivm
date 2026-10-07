import {chooseAiAction} from '../ai';
import {CARDS} from '../cards';
import {spellTiming} from '../engine/spellTiming';
import {createGame,applyAction,legalActions,mempoolOf} from '../engine/engine';
import type {Action,GameState,PlayerId} from '../engine/types';
import {pendingValidatorOrders,type RulesetId} from '../engine/ruleset';

export type ProbePolicy='greedy'|'pressure';
export interface MatchProbe {
  winner:PlayerId|'draw'|null;
  blocks:number;
  actions:number;
  casts:number;
  counters:number;
  powers:[number,number];
  neutralPowers:[number,number];
  stakes:number;
  factionRefunds:number;
}

/** A deliberately simple second policy, not a human-player model or a stronger AI. */
export function chooseProbeAction(state:GameState,policy:ProbePolicy):Action {
  if(policy==='pressure'){
    const attacks=legalActions(state).filter((a):a is Extract<Action,{type:'attack'}>=>a.type==='attack'&&a.target==='hero');
    attacks.sort((a,b)=>(state.players[state.turn].board.find(m=>m.uid===b.attackerUid)?.attack??0)-(state.players[state.turn].board.find(m=>m.uid===a.attackerUid)?.attack??0));
    if(attacks[0])return attacks[0];
  }
  return chooseAiAction(state);
}

/** Real engine transitions, opening mulligans included, with bounded termination. */
export function probeMatch(heroA:string,deckA:string[],heroB:string,deckB:string[],seed:number,policies:[ProbePolicy,ProbePolicy]=['greedy','greedy'],ruleset:RulesetId='classic-v1'):MatchProbe {
  let state=createGame(heroA,deckA,heroB,deckB,{enableMulligan:true,ruleset},seed);
  const result:MatchProbe={winner:null,blocks:1,actions:0,casts:0,counters:0,powers:[0,0],neutralPowers:[0,0],stakes:0,factionRefunds:0};
  while(state.winner===null&&result.actions<2000){
    const owner=state.turn,enemy:PlayerId=owner===0?1:0;
    const action=chooseProbeAction(state,policies[owner]);
    const after=applyAction(state,action);
    if(action.type==='cast-spell')result.casts++;
    if(action.type==='play-minion'||action.type==='cast-spell'){
      result.counters+=Math.max(0,mempoolOf(state,enemy).length-mempoolOf(after,enemy).length);
      result.factionRefunds+=(after.players[owner].pavilionBonuses??[]).filter(f=>!state.players[owner].pavilionBonuses?.includes(f)).length;
    }
    if(action.type==='hero-power'){
      result.powers[owner]++;
      const beforeMe=state.players[owner],afterMe=after.players[owner];
      const sameEnemy=JSON.stringify(state.players[enemy].board)===JSON.stringify(after.players[enemy].board)&&state.players[enemy].treasury===after.players[enemy].treasury;
      if(sameEnemy&&beforeMe.treasury===afterMe.treasury&&beforeMe.hand.length===afterMe.hand.length&&beforeMe.gas===afterMe.gas&&pendingValidatorOrders(state,owner)===pendingValidatorOrders(after,owner))result.neutralPowers[owner]++;
    }
    if(action.type==='stake')result.stakes++;
    state=after;result.actions++;
  }
  result.winner=state.winner;result.blocks=state.block;
  return result;
}

/** Exact mechanical twins only. Faction rebates can still distinguish these cards. */
export function mechanicalTwins(){
  const groups=new Map<string,string[]>();
  for(const card of Object.values(CARDS)){
    const signature=JSON.stringify([card.type,card.attack??null,card.health??null,card.taunt??false,card.rush??false,card.lifesteal??false,card.priority??false,card.halvingPeriod??null,card.battlecry??null,card.ultimate??null,card.spell??null,card.type==='spell'?spellTiming(card):null]);
    groups.set(signature,[...(groups.get(signature)??[]),card.id]);
  }
  return Array.from(groups.values()).filter(ids=>ids.length>1).map(ids=>({cards:ids.map(id=>({id,cost:CARDS[id].cost,faction:CARDS[id].faction})),differentCost:new Set(ids.map(id=>CARDS[id].cost)).size>1}));
}
