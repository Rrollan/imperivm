import type { PresentationBatch } from './GameSession';
import {HEROES} from '../../lib/heroes';
import {CARDS} from '../../lib/cards';

export const VIDEO_IDS = ['01-impact','02-builder-heal','03-whale-impact','04-degen-draw','05-validator-gas','06-victory','07-spell-impact','08-spell-buff','09-spell-counter'] as const;
export type VideoId = typeof VIDEO_IDS[number];
export type VideoCue = { id: VideoId; anchor: string; width: number };

/** Bind visual effects to the actual action/target, never infer rules from the animation. */
export function videoCues(batch: PresentationBatch): VideoCue[] {
  const owner=batch.before.turn, hero=`hero-${owner}`, action=batch.action;
  if(batch.after.winner!==null&&batch.before.winner===null&&batch.after.winner===0)
    return [{id:'06-victory',anchor:'arena-center',width:26}];
  if(action.type==='attack')return [{id:'01-impact',anchor:action.target==='hero'?`hero-${1-owner}`:action.target,width:4}];
  if(action.type==='hero-power'){
    switch(HEROES[batch.before.players[owner].heroId].power){
      case 'heal-treasury':return [{id:'02-builder-heal',anchor:hero,width:5}];
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
    const hostile=kind.startsWith('damage-');
    const id:VideoId=hostile?'07-spell-impact':kind==='counter-mempool'||kind==='rugpull'?'09-spell-counter':'08-spell-buff';
    const exactRandom=(batch.events?.spellResolved?.length===1)?batch.events.damages?.find(d=>d.health<d.prevHealth&&batch.before.players[1-s.owner].board.some(m=>m.uid===d.uid))?.uid:undefined;
    const anchor=kind==='heal-treasury'?`hero-${s.owner}`:kind==='damage-enemy-treasury'?`hero-${1-s.owner}`:
      kind==='damage-random-enemy'?(exactRandom??(batch.before.players[1-s.owner].board.length?`row-${1-s.owner}`:`hero-${1-s.owner}`)):
      kind==='rugpull'?'arena-center':kind==='counter-mempool'&&batch.events?.spellCountered?`queued-${batch.events.spellCountered.mempoolUid}`:`row-${hostile?1-s.owner:s.owner}`;
    return [{id,anchor,width:kind==='rugpull'?6:4}];
  }).slice(0,2);
}
