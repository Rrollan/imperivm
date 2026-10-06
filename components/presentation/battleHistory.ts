import type {Action,GameState,PlayerId} from '../../lib/engine/types';
import type {PresentationBatch} from './GameSession';

export type PublicPiece={owner:PlayerId;cardId?:string;heroId?:string};
export type HistoryChange={piece:PublicPiece;health?:[number,number];attack?:[number,number];removed?:boolean;arrived?:boolean};
export type HistoryDetail=
  | {kind:'queued'|'immediate'|'resolved'|'countered';owner:PlayerId;cardId:string;fizzled?:boolean;changes?:HistoryChange[];noChange?:boolean}
  | {kind:'growth';piece:PublicPiece}
  | {kind:'draw';owner:PlayerId;received:number;burned:number;fatigue:number};
export type HistoryEntry={
  id:number;block:number;owner:PlayerId;kind:Action['type'];
  source?:PublicPiece;target?:PublicPiece;replaced?:number;
  orders?:[number,number];
  details:HistoryDetail[];changes:HistoryChange[];winner:GameState['winner'];
};

function piece(state:GameState,uid:string):PublicPiece|undefined{
  if(uid==='hero-0'||uid==='hero-1'){const owner=uid==='hero-0'?0:1;return {owner,heroId:state.players[owner].heroId};}
  for(const owner of [0,1] as const){const fighter=state.players[owner].board.find(m=>m.uid===uid);if(fighter)return {owner,cardId:fighter.cardId};}
}

/** Freeze public facts only. Never retain a GameState, hand UID, deck identity or raw log. */
export function historyEntry(batch:PresentationBatch):HistoryEntry{
  const {before,after,action,events}=batch,actor=before.turn;
  const locate=(uid:string)=>piece(before,uid)??piece(after,uid);
  const entry:HistoryEntry={id:batch.id,block:action.type==='end-turn'?after.block:before.block,owner:action.type==='end-turn'?after.turn:actor,kind:action.type,details:[],changes:[],winner:after.winner};
  if(action.type!=='mulligan'&&before.players[entry.owner].gas!==after.players[entry.owner].gas)entry.orders=[before.players[entry.owner].gas,after.players[entry.owner].gas];
  if(action.type==='play-minion'||action.type==='cast-spell'){
    // The selected card becomes public when played. Other hand cards never enter this DTO.
    const played=before.players[actor].hand.find(card=>card.uid===action.uid);
    if(played)entry.source={owner:actor,cardId:played.cardId};
  }else if(action.type==='hero-power')entry.source={owner:actor,heroId:before.players[actor].heroId};
  else if(action.type==='attack'){
    entry.source=locate(action.attackerUid);entry.target=locate(action.target==='hero'?`hero-${1-actor}`:action.target);
  }else if(action.type==='stake'||action.type==='unstake')entry.source=locate(action.uid);
  else if(action.type==='mulligan')entry.replaced=action.uids.length;
  if(events?.spellImmediate)entry.details.push({kind:'immediate',owner:events.spellImmediate.owner,cardId:events.spellImmediate.cardId});
  if(events?.spellQueued)entry.details.push({kind:'queued',owner:events.spellQueued.owner,cardId:events.spellQueued.cardId});
  for(const resolved of events?.spellResolved??[]){
    const changes:HistoryChange[]=[];
    const ledgers=events?.effectResults?.filter(effect=>effect.mempoolUid===resolved.mempoolUid)??[];
    // Only a per-spell ledger can attribute a delta to one edict in a shared turn batch.
    for(const result of ledgers){
      for(const target of result.targets){
        const publicPiece=locate(target.uid);if(!publicPiece)continue;
        const change:HistoryChange={piece:publicPiece};
        if(target.healthAfter!==target.healthBefore)change.health=[target.healthBefore,target.healthAfter];
        if(target.attackAfter!==target.attackBefore)change.attack=[target.attackBefore,target.attackAfter];
        if(change.health||change.attack)changes.push(change);
      }
    }
    const noChange=ledgers.length>0&&ledgers.every(result=>result.targets.every(target=>target.healthBefore===target.healthAfter&&target.attackBefore===target.attackAfter));
    entry.details.push({kind:'resolved',owner:resolved.owner,cardId:resolved.cardId,fizzled:resolved.fizzled,changes,noChange});
  }
  for(const counter of events?.spellCounters??(events?.spellCountered?[events.spellCountered]:[]))entry.details.push({kind:'countered',owner:counter.owner,cardId:counter.cardId});
  for(const growth of events?.halvings??[]){const target=locate(growth.uid);if(target)entry.details.push({kind:'growth',piece:target});}
  for(const owner of [0,1] as const){
    const prev=before.players[owner],next=after.players[owner];
    const hpBefore=Math.max(0,prev.treasury),hpAfter=Math.max(0,next.treasury);
    if(hpBefore!==hpAfter)entry.changes.push({piece:{owner,heroId:prev.heroId},health:[hpBefore,hpAfter]});
    for(const fighter of prev.board){
      const current=next.board.find(m=>m.uid===fighter.uid),change:HistoryChange={piece:{owner,cardId:fighter.cardId}};
      if(!current){change.removed=true;change.health=[fighter.health,0];}
      else{
        if(fighter.health!==current.health)change.health=[fighter.health,current.health];
        if(fighter.attack!==current.attack)change.attack=[fighter.attack,current.attack];
      }
      if(change.removed||change.health||change.attack)entry.changes.push(change);
    }
    for(const added of next.board.filter(fighter=>!prev.board.some(old=>old.uid===fighter.uid)))entry.changes.push({piece:{owner,cardId:added.cardId},arrived:true});
    if(action.type!=='mulligan'){
      const drawn=Math.max(0,prev.deck.length-next.deck.length);
      const played=(action.type==='play-minion'||action.type==='cast-spell')&&actor===owner?1:0;
      const received=Math.max(0,next.hand.length-prev.hand.length+played),burned=Math.max(0,drawn-received),fatigue=next.fatigue-prev.fatigue;
      if(received||burned||fatigue)entry.details.push({kind:'draw',owner,received,burned,fatigue});
    }
  }
  return entry;
}
