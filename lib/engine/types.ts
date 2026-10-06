/**
 * IMPERIVM — engine contract v1.
 *
 * This file is the source of truth shared by engine, content, AI and UI.
 * Extend additively; existing required fields and actions remain compatible.
 */

export type Faction = 'DeFi' | 'NFT' | 'DePIN' | 'Meme';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PlayerId = 0 | 1;

export type EffectKind =
  | 'damage-all-enemy-minions'
  | 'damage-random-enemy' // random enemy minion; if none, enemy treasury
  | 'damage-enemy-treasury'
  | 'heal-treasury'
  | 'heal-own-minions'
  | 'weaken-random-enemy'
  | 'draw'
  | 'buff-own' // all own minions
  | 'gain-gas'
  | 'counter-mempool' // remove highest-cost enemy mempool spell
  | 'rugpull' // destroy ALL minions on both boards
  | 'summon'; // summon minion by cardId (owner's board)

/** Exact per-card deltas for delayed effects, including empty-draw fatigue. */
export interface SpellEffectResult {
  owner: PlayerId;
  cardId: string;
  mempoolUid: string;
  kind: EffectKind;
  targets: Array<{
    /** Fighter UID, or hero-0 / hero-1 for a treasury target. */
    uid: string;
    attackBefore: number;
    attackAfter: number;
    healthBefore: number;
    healthAfter: number;
    maxHealth: number;
  }>;
}

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
  spell?: EffectDef; // spellTiming.ts selects direct cast or next-turn edict resolution
  priority?: boolean; // on play/cast: immediately counter highest-cost enemy mempool spell
  /* --- package 4A: additive keywords (all optional, default false) --- */
  taunt?: boolean; // enemy attackers must target this minion before non-taunt minions or hero
  rush?: boolean; // can attack the turn played, but only enemy minions (not hero)
  lifesteal?: boolean; // damage dealt heals damage source owner's treasury by actual hp removed
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
  /* --- package 4A: optional keyword instances; engine normalizes absent -> false / fresh=true --- */
  taunt?: boolean;
  rush?: boolean;
  lifesteal?: boolean;
  /* true until the start of this minion owner's next turn; gate for "first turn" rules */
  fresh?: boolean;
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
  /* --- package 4A: optional additive bookkeeping (engine normalizes absent -> defaults) --- */
  mulliganUsed?: boolean;
  factionPlaysThisTurn?: Partial<Record<Faction, number>>;
  pavilionBonuses?: Faction[];
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
  | { type: 'end-turn' }
  | { type: 'mulligan'; uids: string[] }; // package 4A: opt-in one-shot starting hand rebuild

/**
 * Optional additive options for createGame (package 4A). The 5-argument
 * legacy signature createGame(heroA, deckA, heroB, deckB, seed?) is
 * preserved unchanged; the engine additionally accepts a 6-argument
 * form createGame(heroA, deckA, heroB, deckB, opts, seed?) where opts
 * is this object. When opts.enableMulligan is true the engine opens a
 * pre-game mulligan window for each player (no other rules change).
 */
export interface CreateGameOptions {
  enableMulligan?: boolean;
  mulliganCount?: number; // default 3 for P0, 4 for P1 (matches opening draws)
}

/**
 * Engine module (lib/engine/engine.ts) MUST export:
 *
 *   createGame(heroA, deckA, heroB, deckB, seed?): GameState                // legacy
 *   createGame(heroA, deckA, heroB, deckB, opts: CreateGameOptions, seed?): GameState  // additive
 *   applyAction(state, action): GameState   // returns NEW state; throws on illegal action
 *   legalActions(state): Action[]            // all legal actions for state.turn
 *   isGameOver(state): boolean
 *
 * Additive UI helpers (package 4A):
 *   effectivePowerCost(state, pid): number              // hero power cost incl. comeback discount
 *   cardKeywords(cardId): { taunt; rush; lifesteal }    // static read of card keywords
 *   mulliganDrawSize(state, pid): number                // how many cards pid may discard
 *   canPlay(state, pid, uid): boolean                   // can this hand card be played now
 *   enemyHasTaunt(state): boolean                       // UI highlight
 *   mulliganAvailable(state): boolean                   // may the active player mulligan now
 *
 * Engine imports card data as:
 *   import { CARDS } from '../cards';    // Record<string, CardDef>
 *   import { HEROES } from '../heroes';  // Record<string, HeroDef>
 *
 * Package 4A adds OPTIONAL fields on existing public types. Existing
 * fixtures and external builders continue to type-check; the engine
 * normalizes absent fields on clone/createGame:
 *   Minion: taunt?, rush?, lifesteal?, fresh?    -> defaulted to false / fresh=true at summon
 *   PlayerState: mulliganUsed?, factionPlaysThisTurn?, pavilionBonuses? -> defaulted
 * Existing required fields and action variants retain their meaning.
 * Keywords, faction rebates and comeback costs are deliberate rule additions.
 * Mulligan is opt-in; the original five-argument createGame signature remains.
 */

/**
 * Rules summary (implement exactly):
 * - 30-card decks, 30 treasury each. P0 draws 3, P1 draws 4 to start. Mulligan: optional pre-game selection.
 * - Turn start (after end-turn): block += 1; active player switches; FIRST resolve
 *   the new active player's mempool entries (in cast order), THEN halving tick
 *   (every minion on both boards with halvingPeriod h where block % h === 0 gets +1/+1),
 *   THEN maxGas = min(10, maxGas+1); gas = maxGas + (# own staked minions);
 *   heroPowerUsed = false; draw 1 (fatigue: treasury -= ++fatigue if deck empty;
 *   burn drawn card with log if hand already 10); own unstaked minions get canAttack = true.
 * - Casting a spell: pay cost and remove it from hand. Tactical spells listed in
 *   spellTiming.ts resolve immediately. Other spells enter YOUR mempool (public)
 *   and resolve at the START of YOUR next turn (before you act).
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
