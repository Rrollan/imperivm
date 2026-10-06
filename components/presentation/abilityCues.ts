import {CARDS} from '../../lib/cards';
import {HEROES} from '../../lib/heroes';
import type {EffectKind} from '../../lib/engine/types';
import type {PresentationBatch} from './GameSession';
import {directEffect,playedFighter} from './directPlay';
import {rulesetOf} from '../../lib/engine/ruleset';
import {validatorPayout} from './validatorInvestment';

export type AccentKind='steel'|'heal'|'gas'|'dice'|'seal'|'buff'|'counter'|'weaken'|'destroy';
export type AbilityCue={kind:AccentKind;from:string;to:string;phase:'contact'|'after';delay:number;wave?:string};
const glyph:Record<EffectKind,AccentKind>={
  'damage-all-enemy-minions':'steel','damage-random-enemy':'steel','damage-enemy-treasury':'steel',
  'heal-own-minions':'heal','weaken-random-enemy':'weaken','heal-treasury':'heal',draw:'dice','buff-own':'buff','gain-gas':'gas','counter-mempool':'counter',rugpull:'destroy',summon:'buff',
};

/** Presentation follows public rule fields and exact UID diffs; it never changes rules. */
export function abilityCues(batch:PresentationBatch):AbilityCue[]{
  const cues:AbilityCue[]=[],owner=batch.before.turn,hero=`hero-${owner}`;
  const firstRug=batch.events?.spellResolved?.find(s=>s.cardId==='rug-pull'&&!s.fizzled)?.mempoolUid;
  const gas=(p:number)=>p===0?'gas-counter':`hero-${p}`;
  const enemy=(p:number)=>{
    const uid=batch.events?.damages?.find(d=>d.prevHealth>d.health&&batch.before.players[1-p].board.some(m=>m.uid===d.uid))?.uid;
    return uid??`hero-${1-p}`;
  };
  const add=(kind:AccentKind,from:string,to:string,phase:AbilityCue['phase']='contact',delay=0,wave?:string)=>cues.push({kind,from,to,phase,delay,...(wave?{wave}:{})});
  if(batch.action.type==='hero-power'){
    switch(HEROES[batch.before.players[owner].heroId].power){
      case 'heal-treasury':if(batch.after.players[owner].treasury>batch.before.players[owner].treasury)add('heal',owner===0?'hero-power':hero,hero);break;
      case 'gain-gas':add('seal',owner===0?'hero-power':hero,rulesetOf(batch.before)==='validator-investment-v1'?hero:gas(owner));break;
      case 'draw-burn':add('dice',owner===0?'hero-power':hero,hero);break;
      case 'damage-random-enemy':add('steel',hero,enemy(owner));break;
    }
  }
  const effect=(kind:EffectKind,p:number,from:string,multiple=false,delay=0)=>{
    if(kind==='counter-mempool')return; // Only the confirmed victims below represent success.
    if(kind==='rugpull'){
      if(from!==`queued-${firstRug}`)return;
      batch.events?.deaths?.filter(dead=>dead.cause==='rugpull').forEach(dead=>add('destroy',from,dead.uid,'after',0,from));return;
    }
    if((kind.startsWith('damage-')||kind==='heal-treasury')&&from.startsWith('queued-')){
      const result=batch.events?.effectResults?.find(r=>`queued-${r.mempoolUid}`===from&&r.owner===p&&r.kind===kind);
      result?.targets.forEach((target,i)=>{if(target.healthAfter!==target.healthBefore)add(glyph[kind],from,target.uid,'contact',delay+i*.025);});return;
    }
    if(kind==='buff-own'&&from.startsWith('queued-')){
      const result=batch.events?.effectResults?.find(r=>`queued-${r.mempoolUid}`===from&&r.owner===p&&r.kind===kind);
      result?.targets.forEach((target,i)=>{if(target.attackAfter!==target.attackBefore||target.healthAfter!==target.healthBefore)add('buff',from,target.uid,'contact',delay+i*.025);});return;
    }
    if(kind==='heal-own-minions'||kind==='weaken-random-enemy'){
      const result=batch.events?.effectResults?.find(r=>`queued-${r.mempoolUid}`===from&&r.owner===p&&r.kind===kind);
      result?.targets.forEach((target,i)=>{if(kind==='heal-own-minions'&&target.healthAfter>target.healthBefore)add('heal',from,target.uid,'contact',delay+i*.025);if(kind==='weaken-random-enemy'&&target.attackAfter<target.attackBefore)add('weaken',from,target.uid,'contact',delay);});return;
    }
    const destination=kind==='gain-gas'?gas(p):kind==='damage-all-enemy-minions'?`row-${1-p}`:
      kind==='damage-enemy-treasury'?`hero-${1-p}`:kind==='damage-random-enemy'?(multiple?`row-${1-p}`:enemy(p)):
      kind==='buff-own'||kind==='summon'?`row-${p}`:`hero-${p}`;
    add(glyph[kind],from,destination,'contact',delay);
  };
  const played=playedFighter(batch),direct=directEffect(batch);
  if(direct){
    if(direct.targets.length)direct.targets.forEach((target,i)=>add(glyph[direct.kind],direct.source,target.uid,'after',i*.025));
    else if(direct.kind==='gain-gas'&&direct.ordersGain)add('gas',direct.source,gas(owner),'after');
    else if(direct.kind==='draw'&&batch.after.players[owner].deck.length<batch.before.players[owner].deck.length)add('dice',direct.source,direct.source,'after');
    else if(direct.kind==='summon')batch.after.players[owner].board.filter(m=>m.uid!==direct.source&&!batch.before.players[owner].board.some(old=>old.uid===m.uid)).forEach((m,i)=>add('buff',direct.source,m.uid,'after',i*.025));
  }
  const resolved=batch.events?.spellResolved??[];
  resolved.forEach((s,i)=>{const spell=CARDS[s.cardId]?.spell;
    if(s.fizzled)add('counter',`queued-${s.mempoolUid}`,`queued-${s.mempoolUid}`,'after',i*.06);
    else if(spell)effect(spell.kind,s.owner,`queued-${s.mempoolUid}`,resolved.length>1,i*.04);
  });
  const counters=batch.events?.spellCounters??(batch.events?.spellCountered?[batch.events.spellCountered]:[]);
  const castSource=batch.action.type==='cast-spell'&&batch.events?.spellQueued?`queued-${batch.events.spellQueued.mempoolUid}`:undefined;
  const counterSources=resolved.filter(s=>!s.fizzled&&CARDS[s.cardId]?.spell?.kind==='counter-mempool');
  // A direct card is an unambiguous source. With several delayed counters the
  // ledger names victims, not source-victim pairs: keep those outcomes local.
  const counterSource=played?.uid??castSource??(counterSources.length===1?`queued-${counterSources[0].mempoolUid}`:undefined);
  counters.forEach((counter,index)=>{const uid=`queued-${counter.mempoolUid}`;add('counter',counterSource??uid,uid,'after',index*.06);});
  batch.events?.halvings?.forEach(h=>add('buff',h.uid,h.uid,'after',0,'growth'));
  batch.after.players.forEach((p,i)=>{
    const prev=batch.before.players[i];
    if((p.pavilionBonuses??[]).some(f=>!prev.pavilionBonuses?.includes(f)))add('buff',`hero-${i}`,gas(i),'after');
    if(batch.action.type==='end-turn'&&batch.after.turn===i)p.board.filter(m=>m.staked).forEach((m,index)=>add('gas',m.uid,gas(i),'after',index*.045));
  });
  if(batch.action.type==='stake'||batch.action.type==='unstake')add('seal',batch.action.uid,batch.action.uid,'after');
  const investment=validatorPayout(batch);
  if(investment)add('gas',`hero-${investment.owner}`,gas(investment.owner),'after',0,'aftermath');
  if(batch.action.type==='attack'){
    // Healing is observed, including actual lifesteal capped by treasury health.
    if(batch.after.players[owner].treasury>batch.before.players[owner].treasury)add('heal',batch.action.attackerUid,hero,'after');
  }
  const resolvedSources=new Set(resolved.map(s=>`queued-${s.mempoolUid}`));
  return cues.map(cue=>resolvedSources.has(cue.from)?{...cue,wave:cue.from}:cue)
    .filter((cue,index,all)=>all.findIndex(other=>other.kind===cue.kind&&other.from===cue.from&&other.to===cue.to&&other.phase===cue.phase&&other.wave===cue.wave)===index);
}
