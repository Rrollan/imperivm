import type { PresentationBatch } from './GameSession';
import {HEROES} from '../../lib/heroes';
import {CARDS} from '../../lib/cards';
import {cardIdentity} from './cardIdentity';
import {directEffect,playedFighter} from './directPlay';
import {rulesetOf} from '../../lib/engine/ruleset';
import {validatorPayout} from './validatorInvestment';
import {combatStyle} from './combatStyle';
import {ultimateReady} from '../../lib/engine/tactics';
import registry from '../../public/ui/arena-lab/fx/manifest.json';

export const VIDEO_IDS = ['01-impact','02-builder-heal','03-whale-impact','04-degen-draw','05-validator-gas','06-victory','07-spell-impact','08-spell-buff','09-spell-counter','10-deploy-legionary','11-deploy-guard','12-deploy-commander','13-deploy-minister','14-deploy-priest','15-deploy-engineer','16-edict-weaken','17-edict-heal','18-olympian-lightning','19-diamond-phalanx','20-underworld-rift','21-legendary-descent','22-titan-cleave','23-zeus-apparition','24-athena-apparition','25-hades-apparition','26-firmware-landing','27-hoplite-landing','28-priest-landing','29-commander-landing','30-mosaic-landing','31-meme-landing','32-colossus-landing','33-poseidon-apparition','34-hephaestus-apparition','35-dionysus-apparition','36-relay-impact','37-oracle-impact'] as const;
export type VideoId = typeof VIDEO_IDS[number];
const installed=(id:VideoId,fallback:VideoId):VideoId=>Object.prototype.hasOwnProperty.call(registry.clips,id)?id:fallback;
export type VideoCue = { id: VideoId; anchor: string; width: number;wave?:string };

/** Select presentation by printed identity; arrival never changes card rules. */
export function deploymentVideo(cardId:string):VideoId {
  const card=CARDS[cardId],role=cardIdentity(cardId).role;
  const fallback:VideoId={legionary:'10-deploy-legionary',guard:'11-deploy-guard',commander:'12-deploy-commander',minister:'13-deploy-minister',priest:'14-deploy-priest',engineer:'15-deploy-engineer',edict:'10-deploy-legionary'}[role] as VideoId;
  const apparition:Partial<Record<string,VideoId>>={'zeus-liquidator':'23-zeus-apparition','athena-diamond-guard':'24-athena-apparition','hades-rugkeeper':'25-hades-apparition'};
  if(apparition[cardId])return installed(apparition[cardId]!,fallback);
  const preferred:VideoId=cardId==='firmware-phalanx'?'26-firmware-landing'
    :role==='commander'?'29-commander-landing'
    :card.cost>=7||card.rarity==='legendary'?'32-colossus-landing'
    :role==='priest'?'28-priest-landing'
    :role==='engineer'?'26-firmware-landing':role==='minister'?'30-mosaic-landing'
    :card.faction==='Meme'?'31-meme-landing':card.faction==='NFT'?'30-mosaic-landing':'27-hoplite-landing';
  return installed(preferred,fallback);
}

/** Bind visual effects to the actual action/target, never infer rules from the animation. */
export function videoCues(batch: PresentationBatch): VideoCue[] {
  const owner=batch.before.turn, hero=`hero-${owner}`, action=batch.action;
  const cues:VideoCue[]=[],played=playedFighter(batch),direct=directEffect(batch);
  const counters=batch.events?.spellCounters??(batch.events?.spellCountered?[batch.events.spellCountered]:[]);
  const cancellations:VideoCue[]=counters.map(c=>({id:'09-spell-counter',anchor:`queued-${c.mempoolUid}`,width:2}));
  // Victory is displayed by the result dialog. It must not swallow the final hit.
  if(played)cues.push({id:deploymentVideo(played.cardId),anchor:played.uid,width:CARDS[played.cardId].cost>=6?5.8:4});
  // Direct Priority gets the second sprite slot: damage already has its exact
  // number and native contact glyph, while a removed edict has no stat number.
  if(played||action.type==='cast-spell')cues.push(...cancellations);
  if(action.type==='attack'){
    const fighter=batch.before.players[owner].board.find(m=>m.uid===action.attackerUid);
    const style=combatStyle(fighter?.cardId),fallback:VideoId=style.delivery==='arcane'?'07-spell-impact':'01-impact';
    const accent:VideoId=style.shape==='lightning'?'18-olympian-lightning':style.shape==='rift'?'20-underworld-rift':style.shape==='shield'?'19-diamond-phalanx':style.delivery==='melee'?'22-titan-cleave':style.delivery==='bolt'?'36-relay-impact':'37-oracle-impact';
    return [{id:installed(accent,fallback),anchor:action.target==='hero'?`hero-${1-owner}`:action.target,width:4}];
  }
  if(action.type==='hero-power'){
    switch(HEROES[batch.before.players[owner].heroId].power){
      case 'heal-treasury':{
        const healed=batch.after.players[owner].board.find(m=>m.health>(batch.before.players[owner].board.find(old=>old.uid===m.uid)?.health??m.health));
        return batch.after.players[owner].treasury>batch.before.players[owner].treasury?[{id:'02-builder-heal',anchor:hero,width:5}]:healed?[{id:'02-builder-heal',anchor:healed.uid,width:2.8}]:[];
      }
      case 'gain-gas':return [];
      case 'draw-burn':return [{id:'04-degen-draw',anchor:hero,width:4}];
      case 'hermes-relay':return [{id:'04-degen-draw',anchor:hero,width:4}];
      case 'rally-squire':case 'hephaestus-forge':return batch.after.players[owner].board.filter(m=>!batch.before.players[owner].board.some(old=>old.uid===m.uid)).map(m=>({id:'08-spell-buff' as VideoId,anchor:m.uid,width:2.8}));
      case 'athena-aegis':return batch.after.players[owner].board.filter(m=>m.maxHealth>(batch.before.players[owner].board.find(old=>old.uid===m.uid)?.maxHealth??m.maxHealth)).map(m=>({id:'19-diamond-phalanx' as VideoId,anchor:m.uid,width:3}));
      case 'poseidon-tide':return batch.events?.damages?.filter(d=>batch.before.players[1-owner].board.some(m=>m.uid===d.uid)&&d.prevHealth>d.health).map(d=>({id:'07-spell-impact' as VideoId,anchor:d.uid,width:2.6}))??[];
      case 'damage-random-enemy':{
        const target=batch.events?.damages?.find(d=>batch.before.players[1-owner].board.some(m=>m.uid===d.uid))?.uid ?? `hero-${1-owner}`;
        return [{id:'03-whale-impact',anchor:target,width:4}];
      }
    }
  }
  if(direct){
    const ultimate=played&&ultimateReady(batch.before,owner,CARDS[played.cardId]);
    const ultimateId:VideoId|undefined=ultimate?(played.cardId==='zeus-liquidator'?'18-olympian-lightning':played.cardId==='athena-diamond-guard'?'19-diamond-phalanx':played.cardId==='hades-rugkeeper'?'20-underworld-rift':undefined):undefined;
    const id:VideoId|undefined=direct.kind.startsWith('damage-')?'07-spell-impact':direct.kind==='buff-own'||direct.kind==='heal-treasury'?'08-spell-buff':direct.kind==='heal-own-minions'?'17-edict-heal':direct.kind==='weaken-random-enemy'?'16-edict-weaken':undefined;
    if(id&&ultimateId)cues.push({id:installed(ultimateId,id),anchor:direct.kind==='buff-own'?`row-${owner}`:direct.kind==='damage-all-enemy-minions'?`row-${1-owner}`:`hero-${1-owner}`,width:6});
    else if(id)direct.targets.forEach(target=>cues.push({id,anchor:target.uid,width:4}));
    if(direct.ordersGain)cues.push({id:'05-validator-gas',anchor:owner===0?'gas-counter':hero,width:4});
    if(direct.kind==='draw'&&batch.after.players[owner].deck.length<batch.before.players[owner].deck.length)cues.push({id:'04-degen-draw',anchor:direct.source,width:4});
    if(direct.kind==='summon')batch.after.players[owner].board.filter(m=>m.uid!==direct.source&&!batch.before.players[owner].board.some(old=>old.uid===m.uid)).forEach(m=>cues.push({id:'08-spell-buff',anchor:m.uid,width:4}));
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
  const investment=validatorPayout(batch);
  if(investment)cues.push({id:'05-validator-gas',anchor:investment.owner===0?'gas-counter':`hero-${investment.owner}`,width:5,wave:'aftermath'});
  if(!played&&action.type!=='cast-spell')cues.push(...cancellations);
  // Two simultaneous sprite layers are enough. Reuse them for each source
  // window instead of spending the whole action's budget on its first edict.
  const unique=cues.filter((cue,index,all)=>all.findIndex(other=>other.id===cue.id&&other.anchor===cue.anchor&&other.wave===cue.wave)===index);
  const slots=new Map<string,number>();
  return unique.filter(cue=>{const key=cue.wave??'contact',count=slots.get(key)??0;slots.set(key,count+1);return count<2;});
}
