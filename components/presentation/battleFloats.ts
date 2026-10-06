import type {PresentationBatch} from './GameSession';
import {directEffect} from './directPlay';

export type FloatKind='damage'|'heal'|'gas'|'buff'|'weaken';
export type FloatCue={anchor:string;label:string;kind:FloatKind;wave?:string};
const signed=(amount:number)=>`${amount>=0?'+':'−'}${Math.abs(amount)}`;

/** Numeric feedback follows actual health/stat changes, never a card's label. */
export function battleFloats(batch:PresentationBatch):FloatCue[]{
  const cues:FloatCue[]=[],healed=new Map<string,number>(),weakened=new Map<string,number>(),damaged=new Map<string,number>(),buffed=new Map<string,{attack:number;health:number}>();
  const attributedTreasury=new Map<string,number>();
  const attributeTreasury=(uid:string,delta:number)=>{if(uid==='hero-0'||uid==='hero-1')attributedTreasury.set(uid,(attributedTreasury.get(uid)??0)+delta);};
  const add=(anchor:string,label:string,kind:FloatKind)=>cues.push({anchor,label,kind});
  const direct=directEffect(batch);
  // Preserve every resolved source. Two edicts hitting the same fighter are
  // two moments; combining them hides order, healing caps and passive growth.
  for(const result of batch.events?.effectResults??[]){
    const wave=`queued-${result.mempoolUid}`;
    for(const target of result.targets){
      const hp=target.healthAfter-target.healthBefore,ap=target.attackAfter-target.attackBefore;
      attributeTreasury(target.uid,hp);
      if((result.kind.startsWith('damage-')||result.kind==='draw')&&hp<0){cues.push({anchor:target.uid,label:signed(hp),kind:'damage',wave});damaged.set(target.uid,0);}
      if((result.kind==='heal-own-minions'||result.kind==='heal-treasury')&&hp>0){cues.push({anchor:target.uid,label:signed(hp),kind:'heal',wave});healed.set(target.uid,0);}
      if(result.kind==='weaken-random-enemy'&&ap<0){cues.push({anchor:target.uid,label:signed(ap),kind:'weaken',wave});weakened.set(target.uid,0);}
      if(result.kind==='buff-own'&&(ap||hp)){cues.push({anchor:target.uid,label:`${signed(ap)}/${signed(hp)}`,kind:'buff',wave});buffed.set(target.uid,{attack:0,health:0});}
    }
  }
  const results=direct?[direct]:[];
  for(const result of results)for(const target of result.targets){
    attributeTreasury(target.uid,target.healthAfter-target.healthBefore);
    if((result.kind==='heal-own-minions'||result.kind==='heal-treasury')&&target.healthAfter>target.healthBefore)healed.set(target.uid,(healed.get(target.uid)??0)+target.healthAfter-target.healthBefore);
    if(result.kind.startsWith('damage-')&&target.healthAfter<target.healthBefore)damaged.set(target.uid,(damaged.get(target.uid)??0)+target.healthBefore-target.healthAfter);
    if(result.kind==='weaken-random-enemy'&&target.attackAfter<target.attackBefore)weakened.set(target.uid,(weakened.get(target.uid)??0)+target.attackBefore-target.attackAfter);
    if(result.kind==='buff-own'){const value=buffed.get(target.uid)??{attack:0,health:0};value.attack+=target.attackAfter-target.attackBefore;value.health+=target.healthAfter-target.healthBefore;buffed.set(target.uid,value);}
  }
  batch.events?.damages?.forEach(d=>{const delta=d.health-d.prevHealth;if(delta&&!healed.has(d.uid)&&!damaged.has(d.uid)&&!buffed.has(d.uid)&&!batch.events?.halvings?.some(h=>h.uid===d.uid))add(d.uid,signed(delta),delta>0?'heal':'damage');});
  healed.forEach((amount,uid)=>{if(amount)add(uid,signed(amount),'heal');});
  damaged.forEach((amount,uid)=>{if(amount)add(uid,`−${amount}`,'damage');});
  weakened.forEach((amount,uid)=>{if(amount)add(uid,`−${amount}`,'weaken');});
  // A turn draw still owns its remaining delta even if a preceding edict
  // already healed or damaged the same ruler. Do not swallow or count it twice.
  batch.after.players.forEach((player,owner)=>{const uid=`hero-${owner}`,delta=Math.max(0,player.treasury)-Math.max(0,batch.before.players[owner].treasury)-(attributedTreasury.get(uid)??0);if(delta)add(uid,signed(delta),delta>0?'heal':'damage');});
  batch.events?.statChanges?.filter(s=>s.attackAfter<s.attackBefore&&!weakened.has(s.uid)).forEach(s=>add(s.uid,signed(s.attackAfter-s.attackBefore),'weaken'));
  batch.events?.halvings?.forEach(h=>cues.push({anchor:h.uid,label:'+1/+1',kind:'buff',wave:'growth'}));
  buffed.forEach((value,uid)=>{if(value.attack||value.health)add(uid,`${signed(value.attack)}/${signed(value.health)}`,'buff');});
  if(direct?.ordersGain)add(batch.before.turn===0?'gas-counter':'hero-1',signed(direct.ordersGain),'gas');
  if(batch.action.type==='hero-power'){
    const owner=batch.before.turn,gained=batch.after.players[owner].gas-batch.before.players[owner].gas;
    if(gained>0)add(owner===0?'gas-counter':`hero-${owner}`,signed(gained),'gas');
    add(owner===0?'hero-power':`hero-${owner}`,'','buff');
  }
  return cues;
}
