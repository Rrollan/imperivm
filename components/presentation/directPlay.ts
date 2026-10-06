import {CARDS} from '../../lib/cards';
import type {EffectKind,Minion,SpellEffectResult} from '../../lib/engine/types';
import type {PresentationBatch} from './GameSession';

/** The engine appends the played fighter before any Battlecry summons. */
export function playedFighter(batch:PresentationBatch):Minion|undefined{
  if(batch.action.type!=='play-minion'||!batch.events?.play)return;
  const owner=batch.before.turn,cardId=batch.events.play.cardId;
  return batch.after.players[owner].board.find(m=>m.cardId===cardId&&!batch.before.players[owner].board.some(old=>old.uid===m.uid));
}

export type DirectEffect={kind:EffectKind;source:string;targets:SpellEffectResult['targets'];ordersGain:number};

/** One direct play has one Battlecry. Attribute only its observed public delta;
 * delayed queues keep their separate per-spell ledger. A new buffed fighter's
 * baseline is its printed stats, not zero and not an existing fighter's stats. */
export function directEffect(batch:PresentationBatch):DirectEffect|undefined{
  const immediate=batch.events?.spellImmediate;
  if(immediate){
    const effect=CARDS[immediate.cardId].spell;if(!effect)return;
    const result=batch.events?.effectResults?.find(r=>r.mempoolUid===immediate.fromHandUid);
    return {kind:effect.kind,source:immediate.fromHandUid,targets:(result?.targets??[]).filter(t=>t.healthAfter!==t.healthBefore||t.attackAfter!==t.attackBefore),ordersGain:0};
  }
  const played=playedFighter(batch);if(!played)return;
  const card=CARDS[played.cardId],effect=card.battlecry;if(!effect)return;
  const owner=batch.before.turn,before=batch.before.players,after=batch.after.players;
  const targets:DirectEffect['targets']=[];
  const fighter=(old:Minion,next:Minion|undefined)=>({uid:old.uid,attackBefore:old.attack,attackAfter:next?.attack??old.attack,healthBefore:old.health,healthAfter:next?.health??0,maxHealth:next?.maxHealth??old.maxHealth});
  if(effect.kind==='buff-own'){
    for(const next of after[owner].board){
      const old=before[owner].board.find(m=>m.uid===next.uid)??(next.uid===played.uid?{...next,attack:card.attack??0,health:card.health??0,maxHealth:card.health??0}:undefined);
      if(old&&(next.attack!==old.attack||next.health!==old.health))targets.push(fighter(old,next));
    }
  }else if(effect.kind.startsWith('damage-')||effect.kind==='weaken-random-enemy'||effect.kind==='heal-own-minions'){
    const targetOwner=effect.kind==='heal-own-minions'?owner:1-owner;
    for(const old of before[targetOwner].board){
      const next=after[targetOwner].board.find(m=>m.uid===old.uid),value=fighter(old,next);
      if(effect.kind==='weaken-random-enemy'?value.attackAfter<value.attackBefore:effect.kind==='heal-own-minions'?value.healthAfter>value.healthBefore:value.healthAfter<value.healthBefore)targets.push(value);
    }
  }
  const ruler=effect.kind==='heal-treasury'?owner:effect.kind.startsWith('damage-')?1-owner:undefined;
  if(ruler!==undefined){
    const old=before[ruler].treasury,next=Math.max(0,after[ruler].treasury);
    if(effect.kind==='heal-treasury'?next>old:next<old)targets.push({uid:`hero-${ruler}`,attackBefore:0,attackAfter:0,healthBefore:old,healthAfter:next,maxHealth:30});
  }
  const rebate=(after[owner].pavilionBonuses??[]).filter(f=>!before[owner].pavilionBonuses?.includes(f)).length;
  const ordersGain=effect.kind==='gain-gas'?Math.max(0,after[owner].gas-before[owner].gas+card.cost-rebate):0;
  return {kind:effect.kind,source:played.uid,targets,ordersGain};
}
