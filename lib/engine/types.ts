/**
 * IMPERIVM — engine contract v1.
 *
 * This file is the source of truth shared by engine, content, AI and UI.
 * DO NOT modify it — implement against it.
 */

export type Faction = 'DeFi' | 'NFT' | 'DePIN' | 'Meme';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PlayerId = 0 | 1;

export type EffectKind =
  | 'damage-all-enemy-minions'
  | 'damage-random-enemy' // random enemy minion; if none, enemy treasury
  | 'damage-enemy-treasury'
  | 'heal-treasury'
  | 'draw'
  | 'buff-own' // all own minions
  | 'gain-gas'
  | 'counter-mempool' // remove highest-cost enemy mempool spell
  | 'rugpull' // destroy ALL minions on both boards
  | 'summon'; // summon minion by cardId (owner's board)

export interface EffectDef {
  kind: EffectKind;
  amount?: number; // damage / heal / draw / gas
  attack?: number; // buff-own
  health?: number; // buff-own
  cardId?: string; // summon
}

export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  cost: number; // gas, 0..10
  type: 'minion' | 'spell';
  attack?: number; // minions only
  health?: number; // minions only
  text: string; // English rules text
  halvingPeriod?: number; // minion: every N blocks gets +1/+1
  battlecry?: EffectDef; // minion: on play
  spell?: EffectDef; // spell: on resolve from mempool
  priority?: boolean; // on play/cast: immediately counter highest-cost enemy mempool spell
}

export type HeroPowerKind =
  | 'damage-random-enemy' // Whale: 2 dmg random enemy minion else treasury
  | 'heal-treasury' // Builder: restore 3 treasury
  | 'draw-burn' // Degen: draw 1, take 2 damage
  | 'gain-gas'; // Validator: +2 gas this turn

export interface HeroDef {
  id: string;
  name: string; // 'Whale'
  title: string; // 'The Market Mover'
  powerName: string;
  powerText: string;
  powerCost: 2;
  power: HeroPowerKind;
}

export interface HandCard {
  uid: string;
  cardId: string;
}

export interface Minion {
  uid: string;
  cardId: string;
  name: string;
  attack: number;
  health: number;
  maxHealth: number;
  canAttack: boolean;
  staked: boolean;
}

export interface MempoolEntry {
  uid: string;
  cardId: string;
  name: string;
  owner: PlayerId;
}

export interface PlayerState {
  id: PlayerId;
  heroId: string;
  treasury: number; // 30 at start
  deck: string[]; // card ids, top of deck = index 0
  hand: HandCard[];
  board: Minion[];
  gas: number;
  maxGas: number;
  heroPowerUsed: boolean;
  fatigue: number; // increments each empty draw
}

export interface GameState {
  block: number; // block height; starts at 1, +1 every turn
  turn: PlayerId; // player to act
  players: [PlayerState, PlayerState];
  winner: PlayerId | 'draw' | null;
  log: string[]; // newest last
  rng: number; // internal rng state, do not touch directly
}

/** target: minion uid, or 'hero' for the enemy treasury */
export type Action =
  | { type: 'play-minion'; uid: string }
  | { type: 'cast-spell'; uid: string }
  | { type: 'attack'; attackerUid: string; target: string }
  | { type: 'hero-power' }
  | { type: 'stake'; uid: string }
  | { type: 'unstake'; uid: string }
  | { type: 'end-turn' };

/**
 * Engine module (lib/engine/engine.ts) MUST export:
 *
 *   createGame(heroA: string, deckA: string[], heroB: string, deckB: string[], seed?: number): GameState
 *   applyAction(state: GameState, action: Action): GameState   // returns NEW state; throws on illegal action
 *   legalActions(state: GameState): Action[]                    // all legal actions for state.turn
 *   isGameOver(state: GameState): boolean
 *
 * Engine imports card data as:
 *   import { CARDS } from '../cards';    // Record<string, CardDef>
 *   import { HEROES } from '../heroes';  // Record<string, HeroDef>
 *
 * Rules summary (implement exactly):
 * - 30-card decks, 30 treasury each. P0 draws 3, P1 draws 4 to start. Mulligan: none.
 * - Turn start (after end-turn): block += 1; active player switches; FIRST resolve
 *   the new active player's mempool entries (in cast order), THEN halving tick
 *   (every minion on both boards with halvingPeriod h where block % h === 0 gets +1/+1),
 *   THEN maxGas = min(10, maxGas+1); gas = maxGas + (# own staked minions);
 *   heroPowerUsed = false; draw 1 (fatigue: treasury -= ++fatigue if deck empty;
 *   burn drawn card with log if hand already 10); own unstaked minions get canAttack = true.
 * - Casting a spell: pay cost, move card from hand to YOUR mempool (visible to both).
 *   It resolves at the START of YOUR next turn (before you act).
 * - priority: when a card with priority:true is played/cast, immediately remove the
 *   highest-cost enemy mempool entry (ties -> earliest). Log it. (A priority spell
 *   still enters your mempool and resolves next turn.)
 * - Minions: max 7 per board. Just played -> canAttack = false.
 * - stake: minion.staked = true, canAttack = false. unstake: staked = false,
 *   canAttack = false (can't attack the same turn). Staked minions give +1 gas
 *   each at turn start (see above). Staked minions can still be attacked / die.
 * - attack: attacker must be own, canAttack, not staked. Target 'hero' -> enemy
 *   treasury -= attack. Target enemy minion -> both deal damage simultaneously,
 *   remove dead (health <= 0). Attacker canAttack = false afterwards.
 * - Battlecries apply on play-minion (owner context). Spell effects apply on
 *   mempool resolution (caster context).
 * - Hero powers cost 2 gas, once per turn (heroPowerUsed flag):
 *     damage-random-enemy: 2 to random enemy minion, else enemy treasury
 *     heal-treasury: +3 own treasury (cap 30)
 *     draw-burn: draw 1, own treasury -= 2
 *     gain-gas: gas += 2 (may exceed maxGas)
 * - Winner: treasury <= 0 -> other player wins; both <= 0 -> 'draw'. Check after
 *   every damage/heal action, battlecry, spell resolution and turn start.
 * - Log every meaningful event as a short English string. Cap log at 120 entries.
 */

/**
 * Content module MUST export:
 *   lib/cards.ts:  export const CARDS: Record<string, CardDef>;   // ~40 cards
 *   lib/heroes.ts: export const HEROES: Record<string, HeroDef>;  // 4 heroes
 *   lib/decks.ts:  export const DECKS: Record<string, string[]>;  // heroId -> 30 card ids
 * Constraints: ids are kebab-case unique; cost 0..10; minions have attack/health;
 * spells have spell effect; max 2 copies per deck (legendary: 1); each deck exactly 30.
 * Only use EffectKind values listed above. RUG PULL: legendary spell, cost 8,
 * effect { kind: 'rugpull' }.
 */

/**
 * AI module (lib/ai.ts) MUST export:
 *   export function chooseAiAction(state: GameState): Action;
 * Must return an action from legalActions(state) (import it from './engine/engine').
 * The UI calls it repeatedly until it returns { type: 'end-turn' }.
 */
