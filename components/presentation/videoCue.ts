import type { PresentationBatch } from './GameSession';
import {HEROES} from '../../lib/heroes';
import {CARDS} from '../../lib/cards';
import {cardIdentity} from './cardIdentity';

export const VIDEO_IDS = ['01-impact','02-builder-heal','03-whale-impact','04-degen-draw','05-validator-gas','06-victory','07-spell-impact','08-spell-buff','09-spell-counter','10-deploy-legionary','11-deploy-guard','12-deploy-commander','13-deploy-minister','14-deploy-priest','15-deploy-engineer','16-edict-weaken','17-edict-heal'] as const;
export type VideoId = typeof VIDEO_IDS[number];
export type VideoCue = { id: VideoId; anchor: string; width: number };

/** Bind visual effects to the actual action/target, never infer rules from the animation. */
export function videoCues(batch: PresentationBatch): VideoCue[] {
  const owner=batch.before.turn, hero=`hero-${owner}`, action=batch.action;
  if(batch.after.winner!==null&&batch.before.winner===null&&batch.after.winner===0)
    return [{id:'06-victory',anchor:'arena-center',width:26}];
  if(batch.events?.play){const role=cardIdentity(batch.events.play.cardId).role;const id={legionary:'10-deploy-legionary',guard:'11-deploy-guard',commander:'12-deploy-commander',minister:'13-deploy-minister',priest:'14-deploy-priest',engineer:'15-deploy-engineer',edict:'10-deploy-legionary'}[role] as VideoId;const target=batch.after.players[owner].board.find(m=>!batch.before.players[owner].board.some(p=>p.uid===m.uid)&&m.cardId===batch.events?.play?.cardId);return target?[{id,anchor:target.uid,width:4}]:[];}
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
  return (batch.events?.spellResolved??[]).filter(s=>!s.fizzled).flatMap(s=>{
    const kind=CARDS[s.cardId]?.spell?.kind;
    if(!kind||kind==='draw'||kind==='gain-gas')return [];
    const result=batch.events?.effectResults?.find(r=>r.mempoolUid===s.mempoolUid);
    if(kind.startsWith('damage-')||kind==='heal-treasury')return (result?.targets??[]).filter(c=>c.healthAfter!==c.healthBefore).map(c=>({id:kind==='heal-treasury'?'08-spell-buff' as VideoId:'07-spell-impact' as VideoId,anchor:c.uid,width:4}));
    if(kind==='buff-own')return (result?.targets??[]).filter(c=>c.attackAfter!==c.attackBefore||c.healthAfter!==c.healthBefore).map(c=>({id:'08-spell-buff' as VideoId,anchor:c.uid,width:4}));
    if(kind==='weaken-random-enemy')return (result?.targets??[]).filter(c=>c.attackAfter<c.attackBefore).map(c=>({id:'16-edict-weaken' as VideoId,anchor:c.uid,width:4}));
    if(kind==='heal-own-minions')return (result?.targets??[]).filter(c=>c.healthAfter>c.healthBefore).map(c=>({id:'17-edict-heal' as VideoId,anchor:c.uid,width:4}));
    const id:VideoId=kind==='counter-mempool'||kind==='rugpull'?'09-spell-counter':'08-spell-buff';
    const anchor=kind==='rugpull'?'arena-center':kind==='counter-mempool'&&batch.events?.spellCountered?`queued-${batch.events.spellCountered.mempoolUid}`:`row-${s.owner}`;
    return [{id,anchor,width:kind==='rugpull'?6:4}];
  }).filter((cue,index,all)=>all.findIndex(other=>other.id===cue.id&&other.anchor===cue.anchor)===index).slice(0,2);
}
