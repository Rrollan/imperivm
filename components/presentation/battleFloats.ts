import type {PresentationBatch} from './GameSession';
import {directEffect} from './directPlay';

export type FloatKind='damage'|'heal'|'gas'|'buff'|'weaken';
export type FloatCue={anchor:string;label:string;kind:FloatKind};
const signed=(amount:number)=>`${amount>=0?'+':'−'}${Math.abs(amount)}`;

/** Numeric feedback follows actual health/stat changes, never a card's label. */
export function battleFloats(batch:PresentationBatch):FloatCue[]{
  const cues:FloatCue[]=[],healed=new Map<string,number>(),weakened=new Map<string,number>(),damaged=new Map<string,number>(),buffed=new Map<string,{attack:number;health:number}>();
  const add=(anchor:string,label:string,kind:FloatKind)=>cues.push({anchor,label,kind});
  const direct=directEffect(batch);
  const results=[...(batch.events?.effectResults??[]),...(direct?[direct]:[])];
  for(const result of results)for(const target of result.targets){
    if((result.kind==='heal-own-minions'||result.kind==='heal-treasury')&&target.healthAfter>target.healthBefore)healed.set(target.uid,(healed.get(target.uid)??0)+target.healthAfter-target.healthBefore);
    if(result.kind.startsWith('damage-')&&target.healthAfter<target.healthBefore)damaged.set(target.uid,(damaged.get(target.uid)??0)+target.healthBefore-target.healthAfter);
    if(result.kind==='weaken-random-enemy'&&target.attackAfter<target.attackBefore)weakened.set(target.uid,(weakened.get(target.uid)??0)+target.attackBefore-target.attackAfter);
    if(result.kind==='buff-own'){const value=buffed.get(target.uid)??{attack:0,health:0};value.attack+=target.attackAfter-target.attackBefore;value.health+=target.healthAfter-target.healthBefore;buffed.set(target.uid,value);}
  }
  batch.events?.damages?.forEach(d=>{const delta=d.health-d.prevHealth;if(delta&&!healed.has(d.uid)&&!damaged.has(d.uid)&&!buffed.has(d.uid)&&!batch.events?.halvings?.some(h=>h.uid===d.uid))add(d.uid,signed(delta),delta>0?'heal':'damage');});
  healed.forEach((amount,uid)=>add(uid,signed(amount),'heal'));
  damaged.forEach((amount,uid)=>add(uid,`−${amount}`,'damage'));
  weakened.forEach((amount,uid)=>add(uid,`−${amount}`,'weaken'));
  batch.after.players.forEach((player,owner)=>{const delta=Math.max(0,player.treasury)-Math.max(0,batch.before.players[owner].treasury);if(delta&&!healed.has(`hero-${owner}`)&&!damaged.has(`hero-${owner}`))add(`hero-${owner}`,signed(delta),delta>0?'heal':'damage');});
  batch.events?.statChanges?.filter(s=>s.attackAfter<s.attackBefore&&!weakened.has(s.uid)).forEach(s=>add(s.uid,signed(s.attackAfter-s.attackBefore),'weaken'));
  batch.events?.halvings?.forEach(h=>{const value=buffed.get(h.uid)??{attack:0,health:0};value.attack++;value.health++;buffed.set(h.uid,value);});
  buffed.forEach((value,uid)=>{if(value.attack||value.health)add(uid,`${signed(value.attack)}/${signed(value.health)}`,'buff');});
  if(direct?.ordersGain)add(batch.before.turn===0?'gas-counter':'hero-1',signed(direct.ordersGain),'gas');
  if(batch.action.type==='hero-power'){
    const owner=batch.before.turn,gained=batch.after.players[owner].gas-batch.before.players[owner].gas;
    if(gained>0)add(owner===0?'gas-counter':`hero-${owner}`,signed(gained),'gas');
    add(owner===0?'hero-power':`hero-${owner}`,'','buff');
  }
  return cues;
}
