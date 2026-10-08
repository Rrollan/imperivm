import type {SfxName} from '../../lib/audio/sfx';
import {CARDS} from '../../lib/cards';
import {cardIdentity, type CardRole} from './cardIdentity';

export type CombatStyle = {delivery: 'melee' | 'arcane' | 'bolt'; color: string; sound: SfxName; recoil: number; shape?: 'slash'|'shield'|'orb'|'bolt'|'lightning'|'rift'};
const styles: Record<CardRole, CombatStyle> = {
  legionary: {delivery: 'melee', color: '#ffb34c', sound: 'attack', recoil: .84},
  guard: {delivery: 'melee', color: '#49d4ff', sound: 'attack', recoil: .72},
  commander: {delivery: 'melee', color: '#ff9a3c', sound: 'attack', recoil: .84},
  minister: {delivery: 'arcane', color: '#dc63ff', sound: 'arcane-impact', recoil: -.08},
  priest: {delivery: 'arcane', color: '#42ffc3', sound: 'arcane-impact', recoil: -.08},
  engineer: {delivery: 'bolt', color: '#34dfff', sound: 'bolt-impact', recoil: -.12},
  edict: {delivery: 'arcane', color: '#ffc844', sound: 'arcane-impact', recoil: 0},
};
/** Presentation only: ranged visuals preserve the engine's normal combat and retaliation. */
export function combatStyle(cardId: string | undefined): CombatStyle {
  if(cardId==='zeus-liquidator')return {...styles.engineer,shape:'lightning',sound:'lightning-impact',color:'#4addff',recoil:-.1};
  if(cardId==='athena-diamond-guard')return {...styles.guard,shape:'shield',sound:'shield-impact',color:'#45e9ef'};
  if(cardId==='hades-rugkeeper')return {...styles.minister,shape:'rift',sound:'rift-impact',color:'#c45bff'};
  return cardId && CARDS[cardId] ? styles[cardIdentity(cardId).role] : styles.legionary;
}
