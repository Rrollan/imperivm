import type { PresentationBatch } from './GameSession';
import {HEROES} from '../../lib/heroes';
import {CARDS} from '../../lib/cards';
import {cardIdentity} from './cardIdentity';
import {directEffect,playedFighter} from './directPlay';

export const VIDEO_IDS = ['01-impact','02-builder-heal','03-whale-impact','04-degen-draw','05-validator-gas','06-victory','07-spell-impact','08-spell-buff','09-spell-counter','10-deploy-legionary','11-deploy-guard','12-deploy-commander','13-deploy-minister','14-deploy-priest','15-deploy-engineer','16-edict-weaken','17-edict-heal'] as const;
export type VideoId = typeof VIDEO_IDS[number];
export type VideoCue = { id: VideoId; anchor: string; width: number;wave?:string };

/** Bind visual effects to the actual action/target, never infer rules from the animation. */
export function videoCues(batch: PresentationBatch): VideoCue[] {
  const owner=batch.before.turn, hero=`hero-${owner}`, action=batch.action;
  const cues:VideoCue[]=[],played=playedFighter(batch),direct=directEffect(batch);
  const counters=batch.events?.spellCounters??(batch.events?.spellCountered?[batch.events.spellCountered]:[]);
  const cancellations:VideoCue[]=counters.map(c=>({id:'09-spell-counter',anchor:`queued-${c.mempoolUid}`,width:2}));
  // Victory is displayed by the result dialog. It must not swallow the final hit.
  if(played){const role=cardIdentity(played.cardId).role;const id={legionary:'10-deploy-legionary',guard:'11-deploy-guard',commander:'12-deploy-commander',minister:'13-deploy-minister',priest:'14-deploy-priest',engineer:'15-deploy-engineer',edict:'10-deploy-legionary'}[role] as VideoId;cues.push({id,anchor:played.uid,width:4});}
  // Direct Priority gets the second sprite slot: damage already has its exact
  // number and native contact glyph, while a removed edict has no stat number.
  if(played||action.type==='cast-spell')cues.push(...cancellations);
  if(action.type==='attack')return [{id:'01-impact',anchor:action.target==='hero'?`hero-${1-owner}`:action.target,width:4}];
  if(action.type==='hero-power'){
    switch(HEROES[batch.before.players[owner].heroId].power){
      case 'heal-treasury':return batch.after.players[owner].treasury>batch.before.players[owner].treasury?[{id:'02-builder-heal',anchor:hero,width:5}]:[];
      case 'gain-gas':return [{id:'05-validator-gas',anchor:owner===0?'gas-counter':hero,width:5}];
      case 'draw-burn':return [{id:'04-degen-draw',anchor:hero,width:4}];
      case 'damage-random-enemy':{
        const target=batch.events?.damages?.find(d=>batch.before.players[1-owner].board.some(m=>m.uid===d.uid))?.uid ?? `hero-${1-owner}`;
        return [{id:'03-whale-impact',anchor:target,width:4}];
      }
    }
  }
  if(direct){
    const id:VideoId|undefined=direct.kind.startsWith('damage-')?'07-spell-impact':direct.kind==='buff-own'||direct.kind==='heal-treasury'?'08-spell-buff':direct.kind==='heal-own-minions'?'17-edict-heal':direct.kind==='weaken-random-enemy'?'16-edict-weaken':undefined;
    if(id)direct.targets.forEach(target=>cues.push({id,anchor:target.uid,width:4}));
    if(direct.ordersGain)cues.push({id:'05-validator-gas',anchor:owner===0?'gas-counter':hero,width:4});
    if(direct.kind==='draw'&&batch.after.players[owner].deck.length<batch.before.players[owner].deck.length)cues.push({id:'04-degen-draw',anchor:played!.uid,width:4});
    if(direct.kind==='summon')batch.after.players[owner].board.filter(m=>m.uid!==played!.uid&&!batch.before.players[owner].board.some(old=>old.uid===m.uid)).forEach(m=>cues.push({id:'08-spell-buff',anchor:m.uid,width:4}));
  }
  cues.push(...(batch.events?.spellResolved??[]).filter(s=>!s.fizzled).flatMap(s=>{
    const tag=(items:VideoCue[])=>items.map(c=>({...c,wave:`queued-${s.mempoolUid}`}));
    const kind=CARDS[s.cardId]?.spell?.kind;
    if(!kind||kind==='draw'||kind==='gain-gas')return [];
    const result=batch.events?.effectResults?.find(r=>r.mempoolUid===s.mempoolUid);
    if(kind.startsWith('damage-')||kind==='heal-treasury')return tag((result?.targets??[]).filter(c=>c.healthAfter!==c.healthBefore).map(c=>({id:kind==='heal-treasury'?'08-spell-buff' as VideoId:'07-spell-impact' as VideoId,anchor:c.uid,width:4})));
    if(kind==='buff-own')return tag((result?.targets??[]).filter(c=>c.attackAfter!==c.attackBefore||c.healthAfter!==c.healthBefore).map(c=>({id:'08-spell-buff' as VideoId,anchor:c.uid,width:4})));
    if(kind==='weaken-random-enemy')return tag((result?.targets??[]).filter(c=>c.attackAfter<c.attackBefore).map(c=>({id:'16-edict-weaken' as VideoId,anchor:c.uid,width:4})));
    if(kind==='heal-own-minions')return tag((result?.targets??[]).filter(c=>c.healthAfter>c.healthBefore).map(c=>({id:'17-edict-heal' as VideoId,anchor:c.uid,width:4})));
    if(kind==='counter-mempool')return []; // Exact victims are shared below; empty fizzles show no success.
    // Destruction is a native fracture at its actual victims. The cancellation
    // atlas depicts a different rule and must never stand in for RUG PULL.
    if(kind==='rugpull')return [];
    if(kind==='summon')return batch.after.players[s.owner].board.filter(m=>!batch.before.players[s.owner].board.some(old=>old.uid===m.uid)).map(m=>({id:'08-spell-buff' as VideoId,anchor:m.uid,width:4}));
    return [];
  }));
  if(!played&&action.type!=='cast-spell')cues.push(...cancellations);
  // Two simultaneous sprite layers are enough. Reuse them for each source
  // window instead of spending the whole action's budget on its first edict.
  const unique=cues.filter((cue,index,all)=>all.findIndex(other=>other.id===cue.id&&other.anchor===cue.anchor&&other.wave===cue.wave)===index);
  const slots=new Map<string,number>();
  return unique.filter(cue=>{const key=cue.wave??'contact',count=slots.get(key)??0;slots.set(key,count+1);return count<2;});
}
