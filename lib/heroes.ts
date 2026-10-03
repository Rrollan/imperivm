/**
 * IMPERIVM — hero content v1.
 *
 * Four heroes, one hero power each (2 gas, once per turn).
 * Power kinds are exactly those from lib/engine/types.ts.
 */
import type { HeroDef } from './engine/types';

export const HEROES: Record<string, HeroDef> = {
  whale: {
    id: 'whale',
    name: 'Whale',
    title: 'The Market Mover',
    powerName: 'Market Dump',
    powerText:
      'Deal 2 damage to a random enemy minion — or to the enemy treasury if none stand. The market gives, and the Whale takes.',
    powerCost: 2,
    power: 'damage-random-enemy',
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    title: 'The Shipwright',
    powerName: 'Deploy Patch',
    powerText:
      'Restore 3 to your treasury. Ship fixes, not excuses.',
    powerCost: 2,
    power: 'heal-treasury',
  },
  degen: {
    id: 'degen',
    name: 'Degen',
    title: 'The Aped',
    powerName: 'Aped In',
    powerText:
      'Draw a card and take 2 damage. Due diligence is for cowards.',
    powerCost: 2,
    power: 'draw-burn',
  },
  validator: {
    id: 'validator',
    name: 'Validator',
    title: 'The Block Keeper',
    powerName: 'Validate',
    powerText:
      'Gain 2 gas this turn. The chain remembers the faithful.',
    powerCost: 2,
    power: 'gain-gas',
  },
};
