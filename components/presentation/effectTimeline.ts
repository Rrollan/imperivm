import type {PresentationBatch} from './GameSession';
import {battleFloats,type FloatCue} from './battleFloats';
import {abilityCues,type AbilityCue} from './abilityCues';
import type {Minion} from '../../lib/engine/types';

export const EFFECT_POOL_SIZE=18;
export const EFFECT_WAVE_MS=360;
export type EffectWindow={key:string;startMs:number;contactMs:number;endMs:number};
export type ScheduledCue<T>={cue:T;slot:number;window:EffectWindow};
export type EffectTimeline={windows:EffectWindow[];floats:ScheduledCue<FloatCue>[];abilities:ScheduledCue<AbilityCue>[];tailMs:number};

/** A bounded renderer pool is reused between sources; no logical target is dropped. */
export function effectTimeline(batch:PresentationBatch,reduced=false):EffectTimeline|null{
  const floats=battleFloats(batch),abilities=abilityCues(batch);
  if(!batch.events?.spellResolved?.length&&floats.length<=EFFECT_POOL_SIZE&&abilities.length<=EFFECT_POOL_SIZE)return null;
  const keys=Array.from(new Set([...(batch.events?.spellResolved??[]).map(s=>`queued-${s.mempoolUid}`),'growth','aftermath',...floats.map(c=>c.wave??'aftermath'),...abilities.map(c=>c.wave??'aftermath')]));
  const timeline:EffectTimeline={windows:[],floats:[],abilities:[],tailMs:0};
  for(const key of keys){
    const numbers=floats.filter(c=>(c.wave??'aftermath')===key),accents=abilities.filter(c=>(c.wave??'aftermath')===key);
    const resolvedSource=(batch.events?.spellResolved??[]).some(s=>`queued-${s.mempoolUid}`===key);
    const chunks=Math.max(resolvedSource?1:0,Math.ceil(Math.max(numbers.length,accents.length)/EFFECT_POOL_SIZE));
    for(let chunk=0;chunk<chunks;chunk++){
      const waveMs=reduced?240:EFFECT_WAVE_MS,startMs=timeline.windows.length*waveMs;
      const window={key,startMs,contactMs:startMs+(reduced?0:120),endMs:startMs+waveMs};
      timeline.windows.push(window);
      const assign=<T>(items:T[],output:ScheduledCue<T>[])=>items.slice(chunk*EFFECT_POOL_SIZE,(chunk+1)*EFFECT_POOL_SIZE).forEach((cue,slot)=>output.push({cue,slot,window}));
      assign(numbers,timeline.floats);assign(accents,timeline.abilities);
    }
  }
  timeline.tailMs=timeline.windows.at(-1)?.endMs??230;
  return timeline;
}

export function effectWindowAt(timeline:EffectTimeline,elapsedMs:number){
  return timeline.windows.find(window=>elapsedMs>=window.startMs&&elapsedMs<window.endMs);
}

/** Public ledger values paint at their own contact, rather than jumping to the
 * final batch result before the first spell has travelled to its target. */
export function effectFrame(batch:PresentationBatch,timeline:EffectTimeline,elapsedMs:number){
  const fighters=new Map<string,Minion>(batch.before.players.flatMap(p=>p.board).map(m=>[m.uid,{...m}]));
  const treasuries=batch.before.players.map(p=>p.treasury);
  const reached=new Set(timeline.windows.filter(w=>elapsedMs>=w.contactMs).map(w=>w.key));
  for(const spell of batch.events?.spellResolved??[]){
    if(!reached.has(`queued-${spell.mempoolUid}`))continue;
    for(const result of batch.events?.effectResults?.filter(r=>r.mempoolUid===spell.mempoolUid)??[])for(const target of result.targets){
      const fighter=fighters.get(target.uid);
      if(fighter)Object.assign(fighter,{attack:target.attackAfter,health:target.healthAfter,maxHealth:target.maxHealth});
      if(target.uid==='hero-0'||target.uid==='hero-1')treasuries[target.uid==='hero-0'?0:1]=target.healthAfter;
    }
    if(spell.cardId==='rug-pull'&&!spell.fizzled)batch.events?.deaths?.filter(d=>d.cause==='rugpull').forEach(d=>{const fighter=fighters.get(d.uid);if(fighter)fighter.health=0;});
  }
  if(reached.has('growth'))batch.events?.halvings?.forEach(h=>{const fighter=fighters.get(h.uid);if(fighter){fighter.attack++;fighter.health++;fighter.maxHealth++;}});
  if(elapsedMs>=timeline.tailMs){
    for(const m of batch.after.players.flatMap(p=>p.board))fighters.set(m.uid,{...m});
    batch.events?.deaths?.forEach(d=>{const fighter=fighters.get(d.uid);if(fighter)fighter.health=0;});
    batch.after.players.forEach((p,i)=>treasuries[i]=p.treasury);
  }
  return {fighters,treasuries,key:Array.from(reached).join(':')+(elapsedMs>=timeline.tailMs?':final':'')};
}

export function deathWindow(batch:PresentationBatch,timeline:EffectTimeline,uid:string):EffectWindow|undefined{
  const death=batch.events?.deaths?.find(d=>d.uid===uid);
  const source=death?.cause==='rugpull'?batch.events?.spellResolved?.find(s=>s.cardId==='rug-pull'&&!s.fizzled)?.mempoolUid:
    batch.events?.effectResults?.find(r=>r.kind.startsWith('damage-')&&r.targets.some(t=>t.uid===uid&&t.healthAfter<=0))?.mempoolUid;
  return timeline.windows.find(w=>w.key===`queued-${source}`)??timeline.windows.at(-1);
}
