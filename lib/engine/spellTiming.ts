import type {CardDef} from './types';

/** Tactical spells resolve during the cast action. Other spells are edicts;
 * Priority on an edict still counters immediately, before its delayed effect. */
const INSTANT_SPELLS = new Set([
  'senate-censure',
  'restoration-rite',
  'flash-loan',
  'trait-reroll',
  'solar-sapper',
]);

export function isInstantSpell(card:Pick<CardDef,'id'|'type'>):boolean {
  return card.type === 'spell' && INSTANT_SPELLS.has(card.id);
}

export function spellTiming(card:Pick<CardDef,'id'|'type'>):'instant'|'next-turn' {
  return isInstantSpell(card) ? 'instant' : 'next-turn';
}
