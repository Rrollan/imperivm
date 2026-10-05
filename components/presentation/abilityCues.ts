import {CARDS} from '../../lib/cards';
import {HEROES} from '../../lib/heroes';
import type {EffectKind} from '../../lib/engine/types';
import type {PresentationBatch} from './GameSession';

export type AccentKind='steel'|'heal'|'gas'|'dice'|'seal'|'buff'|'counter';
export type AbilityCue={kind:AccentKind;from:string;to:string;phase:'contact'|'after';delay:number};
const glyph:Record<EffectKind,AccentKind>={
  'damage-all-enemy-minions':'steel','damage-random-enemy':'steel','damage-enemy-treasury':'steel',
  'heal-treasury':'heal',draw:'dice','buff-own':'buff','gain-gas':'gas','counter-mempool':'counter',rugpull:'counter',summon:'buff',
};

/** Presentation follows public rule fields and exact UID diffs; it never changes rules. */
export function abilityCues(batch:PresentationBatch):AbilityCue[]{
  const cues:AbilityCue[]=[],owner=batch.before.turn,hero=`hero-${owner}`;
  const gas=(p:number)=>p===0?'gas-counter':`hero-${p}`;
  const enemy=(p:number)=>{
    const uid=batch.events?.damages?.find(d=>d.prevHealth>d.health&&batch.before.players[1-p].board.some(m=>m.uid===d.uid))?.uid;
    return uid??`hero-${1-p}`;
  };
  const add=(kind:AccentKind,from:string,to:string,phase:AbilityCue['phase']='contact',delay=0)=>cues.push({kind,from,to,phase,delay});
  if(batch.action.type==='hero-power'){
    switch(HEROES[batch.before.players[owner].heroId].power){
      case 'heal-treasury':add('heal',owner===0?'hero-power':hero,hero);break;
      case 'gain-gas':add('seal',owner===0?'hero-power':hero,gas(owner));break;
      case 'draw-burn':add('dice',owner===0?'hero-power':hero,hero);break;
      case 'damage-random-enemy':add('steel',hero,enemy(owner));break;
    }
  }
  const effect=(kind:EffectKind,p:number,from:string,multiple=false,delay=0)=>{
    const destination=kind==='gain-gas'?gas(p):kind==='damage-all-enemy-minions'?`row-${1-p}`:
      kind==='damage-enemy-treasury'?`hero-${1-p}`:kind==='damage-random-enemy'?(multiple?`row-${1-p}`:enemy(p)):
      kind==='buff-own'||kind==='summon'?`row-${p}`:kind==='rugpull'?'arena-center':kind==='counter-mempool'?(batch.events?.spellCountered?`queued-${batch.events.spellCountered.mempoolUid}`:`row-${1-p}`):`hero-${p}`;
    add(glyph[kind],from,destination,'contact',delay);
  };
  if(batch.events?.play){const card=CARDS[batch.events.play.cardId];if(card.battlecry)effect(card.battlecry.kind,owner,`hero-${owner}`);}
  const resolved=batch.events?.spellResolved??[];
  resolved.forEach((s,i)=>{const spell=CARDS[s.cardId]?.spell;
    if(s.fizzled)add('counter',`queued-${s.mempoolUid}`,`queued-${s.mempoolUid}`,'after',i*.06);
    else if(spell)effect(spell.kind,s.owner,`queued-${s.mempoolUid}`,resolved.length>1,i*.04);
  });
  if(batch.events?.spellCountered){const uid=`queued-${batch.events.spellCountered.mempoolUid}`;add('counter',uid,uid,'after');}
  batch.events?.halvings?.forEach(h=>add('buff',h.uid,h.uid,'after'));
  batch.after.players.forEach((p,i)=>{
    const prev=batch.before.players[i];
    if((p.pavilionBonuses??[]).some(f=>!prev.pavilionBonuses?.includes(f)))add('buff',`hero-${i}`,gas(i),'after');
    if(batch.action.type==='end-turn'&&batch.after.turn===i)p.board.filter(m=>m.staked).forEach((m,index)=>add('gas',m.uid,gas(i),'after',index*.045));
  });
  if(batch.action.type==='stake'||batch.action.type==='unstake')add('seal',batch.action.uid,batch.action.uid,'after');
  if(batch.action.type==='attack'){
    // Healing is observed, including actual lifesteal capped by treasury health.
    if(batch.after.players[owner].treasury>batch.before.players[owner].treasury)add('heal',batch.action.attackerUid,hero,'after');
  }
  return cues.slice(0,18);
}
