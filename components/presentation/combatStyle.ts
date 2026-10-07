import {CARDS} from '../../lib/cards';
import {cardIdentity, type CardRole} from './cardIdentity';

export type CombatStyle = {delivery: 'melee' | 'arcane' | 'bolt'; color: string; sound: 'attack' | 'arcane-impact' | 'bolt-impact'; recoil: number};
const styles: Record<CardRole, CombatStyle> = {
  legionary: {delivery: 'melee', color: '#ecd3a1', sound: 'attack', recoil: .84},
  guard: {delivery: 'melee', color: '#bcd9e1', sound: 'attack', recoil: .72},
  commander: {delivery: 'melee', color: '#f2bf70', sound: 'attack', recoil: .84},
  minister: {delivery: 'arcane', color: '#d6a5ee', sound: 'arcane-impact', recoil: -.08},
  priest: {delivery: 'arcane', color: '#99ead3', sound: 'arcane-impact', recoil: -.08},
  engineer: {delivery: 'bolt', color: '#79dce7', sound: 'bolt-impact', recoil: -.12},
  edict: {delivery: 'arcane', color: '#f4d48b', sound: 'arcane-impact', recoil: 0},
};
/** Presentation only: ranged visuals preserve the engine's normal combat and retaliation. */
export function combatStyle(cardId: string | undefined): CombatStyle {
  return cardId && CARDS[cardId] ? styles[cardIdentity(cardId).role] : styles.legionary;
}
