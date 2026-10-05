/**
 * IMPERIVM — game engine (lib/engine/engine.ts).
 *
 * Pure TypeScript, no dependencies besides ./types and card/hero data.
 * Every transition is immutable: applyAction() structuredClones the input
 * and returns a brand-new GameState. Throws Error on illegal actions.
 *
 * Implements the "Rules summary" in lib/engine/types.ts exactly.
 * types.ts remains the shared, additive public contract.
 */

import { CARDS } from '../cards';
import { HEROES } from '../heroes';
import type {
  Action,
  CardDef,
  CreateGameOptions,
  EffectDef,
  Faction,
  GameState,
  HandCard,
  HeroDef,
  MempoolEntry,
  Minion,
  PlayerId,
  PlayerState,
  SpellEffectResult,
} from './types';

/* ------------------------------------------------------------------ */
/* Internal runtime view                                               */
/*                                                                     */
/* types.ts cannot be modified, so each player's mempool (spells that  */
/* were cast and wait to resolve at the start of their owner's next    */
/* turn) lives on the player object as an engine-internal extension.   */
/* It is created in createGame(), carried through structuredClone(),   */
/* and readable via mempoolOf().                                       */
/* ------------------------------------------------------------------ */

interface EnginePlayer extends PlayerState {
  mempool: MempoolEntry[];
}

interface EngineGame extends GameState {
  players: [EnginePlayer, EnginePlayer];
  /* --- package 4A: opt-in mulligan window (additive, defaults false/closed) --- */
  enableMulligan: boolean;
  mulliganCount: [number, number]; // P0, P1
  mulliganPhase: [boolean, boolean]; // true while that player may still mulligan
  /** Per-action ledger for targeted delayed effects. */
  spellEffects?: SpellEffectResult[];
}

/** Read a player's mempool (cast spells waiting to resolve next turn). */
export function mempoolOf(state: GameState, pid: PlayerId): MempoolEntry[] {
  const p = state.players[pid] as EnginePlayer | undefined;
  return p !== undefined && Array.isArray(p.mempool) ? p.mempool : [];
}

/** Read the exact targeted-effect ledger produced by the latest action. */
export function spellEffectsOf(state: GameState): SpellEffectResult[] {
  const ledger = (state as EngineGame).spellEffects;
  return Array.isArray(ledger)
    ? ledger.map(effect => ({ ...effect, targets: effect.targets.map(target => ({ ...target })) }))
    : [];
}

/* ------------------------------------------------------------------ */
/* Constants (package 4A balance knobs)                                */
/* ------------------------------------------------------------------ */

/** Comeback valve: hero power discounts to 1 gas when both hold. */
const COMEBACK_HP_THRESHOLD = 12; // own treasury must be <= this
const COMEBACK_GAP = 12; // enemy treasury must be >= this much higher

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function other(pid: PlayerId): PlayerId {
  return pid === 0 ? 1 : 0;
}

function cardDef(id: string): CardDef {
  const d = CARDS[id];
  if (!d) throw new Error(`unknown card id: ${id}`);
  return d;
}

function heroDef(id: string): HeroDef {
  const h = HEROES[id];
  if (!h) throw new Error(`unknown hero id: ${id}`);
  return h;
}

/** mulberry32 — advances s.rng, returns a float in [0, 1). */
function rand(s: EngineGame): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function nextUid(s: EngineGame): string {
  return `u${((rand(s) * 0x100000000) >>> 0).toString(36)}`;
}

function pushLog(s: EngineGame, msg: string): void {
  s.log.push(msg);
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
}

function shuffleDeck(s: EngineGame, deck: string[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
}

/** Sets s.winner when a treasury hits 0. Returns true if the game is over. */
function checkWinner(s: EngineGame): boolean {
  if (s.winner !== null) return true;
  const t0 = s.players[0].treasury;
  const t1 = s.players[1].treasury;
  if (t0 <= 0 && t1 <= 0) {
    s.winner = 'draw';
    pushLog(s, 'Game over: draw');
  } else if (t0 <= 0) {
    s.winner = 1;
    pushLog(s, 'Game over: P1 wins');
  } else if (t1 <= 0) {
    s.winner = 0;
    pushLog(s, 'Game over: P0 wins');
  }
  return s.winner !== null;
}

function drawCards(s: EngineGame, pid: PlayerId, n: number): void {
  const p = s.players[pid];
  for (let i = 0; i < n; i++) {
    if (s.winner !== null) return;
    if (p.deck.length === 0) {
      p.fatigue += 1;
      p.treasury -= p.fatigue;
      pushLog(s, `P${pid} fatigue ${p.fatigue}`);
      checkWinner(s);
    } else {
      const cardId = p.deck.shift() as string;
      const def = cardDef(cardId);
      if (p.hand.length >= 10) {
        pushLog(s, `P${pid} burns ${def.name}`);
      } else {
        p.hand.push({ uid: nextUid(s), cardId });
      }
    }
  }
}

function damageMinion(s: EngineGame, pid: PlayerId, uid: string, amount: number): void {
  const p = s.players[pid];
  const m = p.board.find(mm => mm.uid === uid);
  if (!m) return;
  m.health -= amount;
  if (m.health <= 0) {
    p.board = p.board.filter(mm => mm.uid !== uid);
    pushLog(s, `${m.name} dies`);
  }
}

/** Remove dead minions in-place. Returns names that died (logging done by caller). */
function reapDead(s: EngineGame, pid: PlayerId): string[] {
  const p = s.players[pid];
  const dead: string[] = [];
  p.board = p.board.filter(m => {
    if (m.health <= 0) {
      dead.push(m.name);
      return false;
    }
    return true;
  });
  return dead;
}

/**
 * Lifesteal: heal the dealer-owner by the actual health removed from
 * the target, capped at 30 treasury. No overheal, no overkill.
 */
function tryLifesteal(
  s: EngineGame,
  dealer: Minion | null | undefined,
  dealerOwner: PlayerId,
  actualRemoved: number,
): void {
  if (!dealer || !dealer.lifesteal || actualRemoved <= 0) return;
  const p = s.players[dealerOwner];
  if (!p) return;
  const room = Math.max(0, 30 - p.treasury);
  const heal = Math.min(room, actualRemoved);
  if (heal <= 0) return;
  p.treasury += heal;
  pushLog(s, `P${dealerOwner} lifesteals ${heal}`);
}

function makeMinion(s: EngineGame, def: CardDef): Minion {
  return {
    uid: nextUid(s),
    cardId: def.id,
    name: def.name,
    attack: def.attack ?? 0,
    health: def.health ?? 1,
    maxHealth: def.health ?? 1,
    canAttack: def.rush === true, // package 4A: Rush minions ready immediately
    staked: false,
    taunt: def.taunt === true,
    rush: def.rush === true,
    lifesteal: def.lifesteal === true,
    fresh: true, // package 4A: gate for "first turn" rules
  };
}

/** priority / counter-mempool: remove the highest-cost enemy mempool spell (ties -> earliest). */
function counterMempool(s: EngineGame, pid: PlayerId): void {
  const foeMem = s.players[other(pid)].mempool;
  if (foeMem.length === 0) {
    pushLog(s, `P${pid} counter fizzles (enemy mempool empty)`);
    return;
  }
  let best = 0;
  for (let i = 1; i < foeMem.length; i++) {
    if (cardDef(foeMem[i].cardId).cost > cardDef(foeMem[best].cardId).cost) best = i;
  }
  const removed = foeMem.splice(best, 1)[0] as MempoolEntry;
  pushLog(s, `P${pid} counters ${removed.name}`);
}

function applyEffect(s: EngineGame, caster: PlayerId, eff: EffectDef): string[] | undefined {
  const me = s.players[caster];
  const foe = s.players[other(caster)];
  let targets:string[]|undefined;
  switch (eff.kind) {
    case 'damage-all-enemy-minions': {
      const amt = eff.amount ?? 0;
      pushLog(s, `${amt} damage to all enemy minions`);
      targets=foe.board.map(minion=>minion.uid);
      for (const m of [...foe.board]) damageMinion(s, foe.id, m.uid, amt);
      break;
    }
    case 'damage-random-enemy': {
      const amt = eff.amount ?? 0;
      if (foe.board.length > 0) {
        const t = foe.board[Math.floor(rand(s) * foe.board.length)] as Minion;
        pushLog(s, `${amt} damage to random enemy ${t.name}`);
        targets=[t.uid];
        damageMinion(s, foe.id, t.uid, amt);
      } else {
        targets=[`hero-${foe.id}`];
        foe.treasury -= amt;
        pushLog(s, `${amt} damage to enemy treasury`);
      }
      break;
    }
    case 'damage-enemy-treasury': {
      const amt = eff.amount ?? 0;
      targets=[`hero-${foe.id}`];
      foe.treasury -= amt;
      pushLog(s, `${amt} damage to enemy treasury`);
      break;
    }
    case 'heal-treasury': {
      const amt = eff.amount ?? 0;
      const before=me.treasury;
      me.treasury = Math.min(30, me.treasury + amt);
      targets=me.treasury>before?[`hero-${me.id}`]:[];
      pushLog(s, `P${caster} restores ${amt} treasury`);
      break;
    }
    case 'heal-own-minions': {
      const amount=eff.amount??0;
      const healed:string[]=[];
      for(const minion of me.board){
        const before=minion.health;
        minion.health=Math.min(minion.maxHealth,minion.health+amount);
        if(minion.health>before)healed.push(minion.uid);
      }
      pushLog(s,`P${caster} restores ${amount} to own minions`);
      targets=healed;break;
    }
    case 'weaken-random-enemy': {
      if(foe.board.length){
        const target=foe.board[Math.floor(rand(s)*foe.board.length)];
        target.attack=Math.max(0,target.attack-(eff.amount??1));
        pushLog(s,`P${caster} weakens ${target.name} to ${target.attack} attack`);
        targets=[target.uid];
      }else{
        pushLog(s,`P${caster} weakening fizzles (no enemy minions)`);
        targets=[];
      }
      break;
    }
    case 'draw': {
      drawCards(s, caster, eff.amount ?? 1);
      pushLog(s, `P${caster} draws ${eff.amount ?? 1}`);
      break;
    }
    case 'buff-own': {
      const a = eff.attack ?? 0;
      const h = eff.health ?? 0;
      for (const m of me.board) {
        m.attack += a;
        m.health += h;
        m.maxHealth += h;
      }
      pushLog(s, `P${caster} minions +${a}/+${h}`);
      targets=a!==0||h!==0?me.board.map(minion=>minion.uid):[];
      break;
    }
    case 'gain-gas': {
      const amt = eff.amount ?? 1;
      me.gas += amt;
      pushLog(s, `P${caster} gains ${amt} gas`);
      break;
    }
    case 'counter-mempool': {
      counterMempool(s, caster);
      break;
    }
    case 'rugpull': {
      s.players[0].board = [];
      s.players[1].board = [];
      pushLog(s, 'RUG PULL! All minions destroyed');
      break;
    }
    case 'summon': {
      if (!eff.cardId) {
        pushLog(s, 'Summon fizzles (no cardId)');
        break;
      }
      const def = cardDef(eff.cardId);
      if (def.type !== 'minion') {
        pushLog(s, 'Summon fizzles (not a minion)');
        break;
      }
      if (me.board.length >= 7) {
        pushLog(s, 'Board full — summon fizzles');
        break;
      }
      me.board.push(makeMinion(s, def));
      pushLog(s, `P${caster} summons ${def.name}`);
      break;
    }
  }
  checkWinner(s);
  return targets;
}

/**
 * Pavilion (faction synergy) bookkeeping. Called on play-minion / cast-spell.
 * When a player has just played their 2nd card of the same faction this turn,
 * grant a one-time +1 gas rebate. Subsequent plays (3rd, 4th, 5th) and
 * mempool spell resolutions do NOT re-trigger.
 */
function noteFactionPlay(s: EngineGame, faction: Faction): void {
  const me = s.players[s.turn];
  if (!me.factionPlaysThisTurn) me.factionPlaysThisTurn = {};
  if (!me.pavilionBonuses) me.pavilionBonuses = [];
  me.factionPlaysThisTurn[faction] = (me.factionPlaysThisTurn[faction] ?? 0) + 1;
  const count = me.factionPlaysThisTurn[faction] ?? 0;
  if (count >= 2 && !me.pavilionBonuses.includes(faction)) {
    me.gas += 1;
    me.pavilionBonuses.push(faction);
    pushLog(s, `P${s.turn} pavilion bonus: ${faction} (+1 gas)`);
  }
}

function resetPavilion(p: PlayerState): void {
  p.factionPlaysThisTurn = {};
  p.pavilionBonuses = [];
}

/** Runs the start-of-turn sequence for the new active player. */
function startTurn(s: EngineGame): void {
  s.block += 1;
  s.turn = other(s.turn);
  const me = s.players[s.turn];

  // P1 chooses from four opening cards before the normal first-turn draw.
  // Complete this same block after the choice; do not skip or add a turn.
  if (mulliganAvailable(s)) {
    pushLog(s, `Block ${s.block} — P${s.turn} mulligan window open`);
    return;
  }
  completeTurnStart(s);
}

function completeTurnStart(s: EngineGame): void {
  const me = s.players[s.turn];
  pushLog(s, `Block ${s.block} — P${s.turn} turn`);

  // 1. Resolve the new active player's mempool entries in cast order.
  let queuedOrders = 0;
  const entries = me.mempool;
  me.mempool = [];
  for (const e of entries) {
    const def = cardDef(e.cardId);
    if (def.type !== 'spell' || !def.spell) {
      pushLog(s, `${e.name} fizzles`);
      continue;
    }
    pushLog(s, `${e.name} resolves`);
    const effectKind = def.spell.kind;
    const shouldTrack = effectKind.startsWith('damage-') || effectKind === 'heal-treasury' || effectKind === 'heal-own-minions' || effectKind === 'weaken-random-enemy' || effectKind === 'buff-own';
    const beforeByUid = shouldTrack
      ? new Map(s.players.flatMap(player => player.board).map(minion => [minion.uid, {
          attack: minion.attack,
          health: minion.health,
          maxHealth:minion.maxHealth,
        }] as const))
      : undefined;
    if(beforeByUid)for(const player of s.players)beforeByUid.set(`hero-${player.id}`,{attack:0,health:player.treasury,maxHealth:30});
    const ordersBefore = me.gas;
    const targetUids = applyEffect(s, s.turn, def.spell);
    // Delayed order rewards belong to this new turn. Preserve them when the
    // base stock refills below; do not change the established resolve order.
    if (effectKind === 'gain-gas') queuedOrders += me.gas - ordersBefore;
    if (shouldTrack) {
      const targets = (targetUids ?? []).flatMap(uid => {
        const before = beforeByUid?.get(uid);
        const after = s.players.flatMap(player => player.board).find(minion => minion.uid === uid);
        if (!before) return [];
        const ruler=uid==='hero-0'?s.players[0]:uid==='hero-1'?s.players[1]:undefined;
        return [{
          uid,
          attackBefore: before.attack,
          attackAfter: after?.attack??before.attack,
          healthBefore: before.health,
          healthAfter:Math.max(0,ruler?.treasury??after?.health??0),
          maxHealth:after?.maxHealth??before.maxHealth,
        }];
      });
      (s.spellEffects ??= []).push({
        owner: s.turn,
        cardId: e.cardId,
        mempoolUid: e.uid,
        kind: effectKind,
        targets,
      });
    }
    if (s.winner !== null) return;
  }

  // 2. Halving tick: every minion with halvingPeriod h where block % h === 0 gets +1/+1.
  for (const p of s.players) {
    for (const m of p.board) {
      const h = cardDef(m.cardId).halvingPeriod ?? 0;
      if (h > 0 && s.block % h === 0) {
        m.attack += 1;
        m.health += 1;
        m.maxHealth += 1;
        pushLog(s, `Halving: ${m.name} +1/+1`);
      }
    }
  }

  // 3. Gas refill: maxGas grows, staked minions add +1 gas each.
  me.maxGas = Math.min(10, me.maxGas + 1);
  me.gas = me.maxGas + me.board.filter(m => m.staked).length + queuedOrders;
  me.heroPowerUsed = false;

  // 3b. Pavilion reset for the new active player; additive stats above persist.
  resetPavilion(me);

  // 4. Draw (fatigue / burn handled inside).
  drawCards(s, s.turn, 1);
  if (s.winner !== null) return;

  // 5. Ready unstaked minions and clear "fresh" (first-turn) flag.
  for (const m of me.board) {
    if (!m.staked) m.canAttack = true;
    m.fresh = false;
  }
}

function closeMulligan(s: EngineGame): void {
  const pid = s.turn;
  s.players[pid].mulliganUsed = true;
  s.mulliganPhase[pid] = false;
  if (pid === 1 && s.block === 2 && s.winner === null) completeTurnStart(s);
}

/* ------------------------------------------------------------------ */
/* Public UI helpers (package 4A)                                      */
/* ------------------------------------------------------------------ */

/**
 * Effective hero power cost for `pid` after comeback discount.
 * Base cost is heroDef.powerCost (always 2 today). Discount of -1 gas
 * when the player's treasury is materially lower than the enemy's.
 */
export function effectivePowerCost(state: GameState, pid: PlayerId): number {
  const p = state.players[pid];
  const f = state.players[other(pid)];
  if (!p || !f) return 2;
  const base = HEROES[p.heroId]?.powerCost ?? 2;
  const discount =
    p.treasury <= COMEBACK_HP_THRESHOLD && f.treasury - p.treasury >= COMEBACK_GAP ? 1 : 0;
  return Math.max(0, base - discount);
}

/** Return the package 4A keywords carried by a card. */
export function cardKeywords(cardId: string): { taunt: boolean; rush: boolean; lifesteal: boolean } {
  const c = CARDS[cardId];
  return {
    taunt: c?.taunt === true,
    rush: c?.rush === true,
    lifesteal: c?.lifesteal === true,
  };
}

/**
 * How many cards the player may discard in a single mulligan, given
 * the createGame options that opened this match. UI uses this to render
 * the starting-hand "mulligan" buttons and to validate its picks.
 */
export function mulliganDrawSize(state: GameState, pid: PlayerId): number {
  const s = state as EngineGame;
  if (!s.enableMulligan) return 0;
  if (s.players[pid].mulliganUsed) return 0;
  return s.mulliganCount[pid] ?? (pid === 0 ? 3 : 4);
}

/** Cheap UI check: is the hand card playable right now? */
export function canPlay(state: GameState, pid: PlayerId, uid: string): boolean {
  const me = state.players[pid];
  const hc = me.hand.find(h => h.uid === uid);
  if (!hc || state.winner !== null || state.turn !== pid || mulliganAvailable(state)) return false;
  const def = cardDef(hc.cardId);
  if (def.cost > me.gas) return false;
  if (def.type === 'minion') return me.board.length < 7;
  return true; // spell
}

/** Whether the active enemy board has any Taunt minion (UI highlight). */
export function enemyHasTaunt(state: GameState): boolean {
  const foe = state.players[other(state.turn)];
  return foe.board.some(m => m.taunt);
}

/** Whether the active player may legally mulligan this very moment. */
export function mulliganAvailable(state: GameState): boolean {
  const s = state as EngineGame;
  if (!s.enableMulligan) return false;
  if (s.winner !== null) return false;
  if (!s.mulliganPhase[s.turn]) return false;
  if (s.players[s.turn].mulliganUsed) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function actionKey(a: Action): string {
  switch (a.type) {
    case 'play-minion':
      return `play-minion:${a.uid}`;
    case 'cast-spell':
      return `cast-spell:${a.uid}`;
    case 'attack':
      return `attack:${a.attackerUid}:${a.target}`;
    case 'hero-power':
      return 'hero-power';
    case 'stake':
      return `stake:${a.uid}`;
    case 'unstake':
      return `unstake:${a.uid}`;
    case 'end-turn':
      return 'end-turn';
    case 'mulligan':
      return `mulligan:${[...a.uids].sort().join(',')}`;
  }
  return 'unknown';
}

export function createGame(
  heroA: string,
  deckA: string[],
  heroB: string,
  deckB: string[],
  arg5?: number | CreateGameOptions,
  arg6?: number,
): GameState {
  let seed: number | undefined;
  let opts: CreateGameOptions | undefined;
  if (typeof arg5 === 'number') {
    seed = arg5;
  } else if (arg5 && typeof arg5 === 'object') {
    opts = arg5;
    if (typeof arg6 === 'number') seed = arg6;
  }

  heroDef(heroA);
  heroDef(heroB);

  const mkPlayer = (id: PlayerId, heroId: string, deck: string[]): EnginePlayer => {
    for (const cid of deck) cardDef(cid); // validate ids, throws on unknown
    return {
      id,
      heroId,
      treasury: 30,
      deck: [...deck],
      hand: [],
      board: [],
      gas: 0,
      maxGas: 0,
      heroPowerUsed: false,
      fatigue: 0,
      mempool: [],
      // package 4A additions (defaults; preserved on legacy callers):
      mulliganUsed: false,
      factionPlaysThisTurn: {},
      pavilionBonuses: [],
    };
  };

  const enableMulligan = opts?.enableMulligan === true;
  if (opts?.mulliganCount !== undefined &&
      (!Number.isInteger(opts.mulliganCount) || opts.mulliganCount < 0 || opts.mulliganCount > 4)) {
    throw new Error('mulliganCount must be an integer from 0 to 4');
  }
  const mulliganCount: [number, number] = [opts?.mulliganCount ?? 3, opts?.mulliganCount ?? 4];

  const s: EngineGame = {
    block: 1,
    turn: 0,
    players: [mkPlayer(0, heroA, deckA), mkPlayer(1, heroB, deckB)],
    winner: null,
    log: [],
    rng: seed === undefined ? (Math.random() * 0x7fffffff) | 0 : seed | 0,
    enableMulligan,
    mulliganCount,
    mulliganPhase: enableMulligan ? [true, true] : [false, false],
  };

  shuffleDeck(s, s.players[0].deck);
  shuffleDeck(s, s.players[1].deck);

  s.players[0].maxGas = 1;
  s.players[0].gas = 1;
  drawCards(s, 0, 3);
  drawCards(s, 1, 4);

  pushLog(s, `Game start: ${heroDef(heroA).name} (P0) vs ${heroDef(heroB).name} (P1)`);
  if (enableMulligan) pushLog(s, 'Mulligan phase open for both players');
  return s;
}

export function legalActions(state: GameState): Action[] {
  if (state.winner !== null) return [];
  const s = state as EngineGame;
  const me = s.players[s.turn];
  const foe = s.players[other(s.turn)];
  const acts: Action[] = [];

  if (mulliganAvailable(s)) {
    const limit = Math.min(mulliganDrawSize(s, s.turn), me.hand.length);
    // Opening hands have at most four cards: enumerate every legal subset,
    // including keep. AI and UI share the same complete action contract.
    for (let mask = 0; mask < 2 ** me.hand.length; mask++) {
      const uids = me.hand.filter((_, i) => (mask & (1 << i)) !== 0).map(h => h.uid);
      if (uids.length <= limit) acts.push({ type: 'mulligan', uids });
    }
    return acts;
  }

  // package 4A: any enemy Taunt forces attackers to target it first.
  const enemyTaunts = foe.board.filter(m => m.taunt);
  const tauntActive = enemyTaunts.length > 0;

  for (const hc of me.hand) {
    const def = cardDef(hc.cardId);
    if (def.cost > me.gas) continue;
    if (def.type === 'minion') {
      if (me.board.length < 7) acts.push({ type: 'play-minion', uid: hc.uid });
    } else {
      acts.push({ type: 'cast-spell', uid: hc.uid });
    }
  }

  for (const m of me.board) {
    if (!m.canAttack || m.staked) continue;
    // package 4A: fresh = just played; non-Rush fresh can't attack;
    // Rush fresh can attack enemy minions but never the hero.
    const canTargetMinions = !m.fresh || m.rush;
    const canTargetHero = !m.fresh;
    if (canTargetHero && !tauntActive) {
      acts.push({ type: 'attack', attackerUid: m.uid, target: 'hero' });
    }
    for (const t of foe.board) {
      if (tauntActive && !t.taunt) continue; // must attack a Taunt
      if (!canTargetMinions) continue;
      acts.push({ type: 'attack', attackerUid: m.uid, target: t.uid });
    }
  }

  // package 4A: hero power uses comeback-discounted cost.
  const pc = effectivePowerCost(s, s.turn);
  if (me.gas >= pc && !me.heroPowerUsed) acts.push({ type: 'hero-power' });

  for (const m of me.board) {
    acts.push({ type: m.staked ? 'unstake' : 'stake', uid: m.uid });
  }

  acts.push({ type: 'end-turn' });
  return acts;
}

export function applyAction(state: GameState, action: Action): GameState {
  if (isGameOver(state)) throw new Error('cannot act: game is over');

  // package 4A: mulligan is validated by its own case (subset selection,
  // including an empty "keep" pass) — we exempt it from the strict
  // legalActions key match because legalActions only needs to surface
  // the mulligan as a possible action type.
  if (action.type !== 'mulligan') {
    const key = actionKey(action);
    const ok = legalActions(state).some(a => actionKey(a) === key);
    if (!ok) throw new Error(`illegal action: ${key}`);
  }

  const s = structuredClone(state) as EngineGame;
  s.spellEffects = [];
  for (const p of s.players) {
    if (!Array.isArray(p.mempool)) p.mempool = [];
    if (!p.factionPlaysThisTurn) p.factionPlaysThisTurn = {};
    if (!Array.isArray(p.pavilionBonuses)) p.pavilionBonuses = [];
    if (typeof p.mulliganUsed !== 'boolean') p.mulliganUsed = false;
    for (const m of p.board) {
      if (m.taunt === undefined) m.taunt = false;
      if (m.rush === undefined) m.rush = false;
      if (m.lifesteal === undefined) m.lifesteal = false;
      if (m.fresh === undefined) m.fresh = false;
    }
  }
  if (typeof s.enableMulligan !== 'boolean') s.enableMulligan = false;
  if (!Array.isArray(s.mulliganPhase)) s.mulliganPhase = [false, false];
  if (!Array.isArray(s.mulliganCount)) s.mulliganCount = [3, 4];

  const me = s.players[s.turn];
  const foe = s.players[other(s.turn)];

  switch (action.type) {
    case 'mulligan': {
      if (!s.enableMulligan || !s.mulliganPhase[s.turn] || me.mulliganUsed) {
        throw new Error('mulligan not allowed');
      }
      const chosen = action.uids;
      if (!Array.isArray(chosen)) {
        throw new Error('mulligan uids must be an array');
      }
      // Empty subset (keep) is legal and simply closes the window.
      if (chosen.length === 0) {
        closeMulligan(s);
        pushLog(s, `P${s.turn} keeps opening hand`);
        return s;
      }
      const seen = new Set<string>();
      for (const u of chosen) {
        if (typeof u !== 'string') throw new Error('mulligan uids must be strings');
        if (seen.has(u)) throw new Error(`duplicate mulligan uid: ${u}`);
        seen.add(u);
        if (!me.hand.some(h => h.uid === u)) throw new Error(`uid not in hand: ${u}`);
      }
      if (chosen.length > s.mulliganCount[s.turn]) {
        throw new Error(`mulligan picks > ${s.mulliganCount[s.turn]}`);
      }
      const beforeDeck = me.deck.length;
      const beforeHand = me.hand.length;
      const rejected: HandCard[] = [];
      me.hand = me.hand.filter(h => {
        if (chosen.includes(h.uid)) {
          rejected.push(h);
          return false;
        }
        return true;
      });
      for (let i = 0; i < chosen.length; i++) {
        if (s.winner !== null) break;
        if (me.deck.length === 0) {
          me.fatigue += 1;
          me.treasury -= me.fatigue;
          pushLog(s, `P${s.turn} fatigue ${me.fatigue}`);
          checkWinner(s);
          if (s.winner !== null) break;
        } else {
          const cardId = me.deck.shift() as string;
          const def = cardDef(cardId);
          if (me.hand.length >= 10) {
            pushLog(s, `P${s.turn} burns ${def.name}`);
          } else {
            me.hand.push({ uid: nextUid(s), cardId });
          }
        }
      }
      for (const r of rejected) me.deck.push(r.cardId);
      shuffleDeck(s, me.deck);
      const afterDeck = me.deck.length;
      const afterHand = me.hand.length;
      if (afterDeck + afterHand !== beforeDeck + beforeHand) {
        throw new Error(
          `mulligan conservation violated: deck+hand ${beforeDeck}+${beforeHand} -> ${afterDeck}+${afterHand}`,
        );
      }
      pushLog(s, `P${s.turn} mulligans ${chosen.length} card(s)`);
      closeMulligan(s);
      checkWinner(s);
      return s;
    }

    case 'play-minion': {
      const idx = me.hand.findIndex(h => h.uid === action.uid);
      if (idx < 0) throw new Error(`card not in hand: ${action.uid}`);
      const hc = me.hand[idx];
      const def = cardDef(hc.cardId);
      me.hand.splice(idx, 1);
      me.gas -= def.cost;
      const m = makeMinion(s, def);
      me.board.push(m);
      pushLog(s, `P${s.turn} plays ${def.name}`);
      if (s.mulliganPhase[s.turn]) s.mulliganPhase[s.turn] = false;
      // package 4A: pavilion (faction synergy) tracks plays; battlecry resolves separately.
      noteFactionPlay(s, def.faction);
      if (def.battlecry) applyEffect(s, s.turn, def.battlecry);
      if (def.priority) counterMempool(s, s.turn);
      checkWinner(s);
      return s;
    }

    case 'cast-spell': {
      const idx = me.hand.findIndex(h => h.uid === action.uid);
      if (idx < 0) throw new Error(`card not in hand: ${action.uid}`);
      const hc = me.hand[idx];
      const def = cardDef(hc.cardId);
      me.hand.splice(idx, 1);
      me.gas -= def.cost;
      me.mempool.push({ uid: nextUid(s), cardId: def.id, name: def.name, owner: s.turn });
      pushLog(s, `P${s.turn} casts ${def.name} -> mempool`);
      if (s.mulliganPhase[s.turn]) s.mulliganPhase[s.turn] = false;
      noteFactionPlay(s, def.faction);
      if (def.priority) counterMempool(s, s.turn);
      checkWinner(s);
      return s;
    }

    case 'attack': {
      const atk = me.board.find(m => m.uid === action.attackerUid);
      if (!atk) throw new Error(`attacker not found: ${action.attackerUid}`);
      // package 4A: summoning sickness gate + taunt re-check.
      if (atk.fresh && !atk.rush) throw new Error('summoning sickness');
      if (atk.staked) throw new Error('staked cannot attack');
      atk.canAttack = false;
      const enemyTaunts = foe.board.filter(m => m.taunt);
      const tauntActive = enemyTaunts.length > 0;
      if (action.target === 'hero') {
        if (atk.fresh) throw new Error('rush cannot attack hero on summon turn');
        if (tauntActive) throw new Error('hero protected by Taunt');
        const dmg = atk.attack;
        // package 4A: lifesteal caps at the pre-damage treasury — never
        // overheal, never treat post-death negative HP as healing.
        const heroActualRemoved = Math.max(0, Math.min(foe.treasury, dmg));
        foe.treasury -= dmg;
        pushLog(s, `P${s.turn} ${atk.name} hits treasury for ${dmg}`);
        tryLifesteal(s, atk, s.turn, heroActualRemoved);
      } else {
        const tgt = foe.board.find(m => m.uid === action.target);
        if (!tgt) throw new Error(`attack target not found: ${action.target}`);
        if (tauntActive && !tgt.taunt) throw new Error('must attack a Taunt');
        const atkName = atk.name;
        const tgtName = tgt.name;
        const atkDmg = atk.attack;
        const tgtDmg = tgt.attack;
        // package 4A: capture actual hp removed BEFORE simultaneous damage
        // for accurate lifesteal computation.
        const tgtActualRemoved = Math.max(0, Math.min(tgt.health, atkDmg));
        const atkActualRemoved = Math.max(0, Math.min(atk.health, tgtDmg));
        tgt.health -= atkDmg;
        atk.health -= tgtDmg;
        pushLog(s, `${atkName} trades with ${tgtName}`);
        const deadFoe = reapDead(s, foe.id);
        const deadMe = reapDead(s, me.id);
        for (const n of deadFoe) pushLog(s, `${n} dies`);
        for (const n of deadMe) pushLog(s, `${n} dies`);
        // package 4A: defender retaliation also heals if defender has lifesteal.
        tryLifesteal(s, atk, s.turn, tgtActualRemoved);
        tryLifesteal(s, tgt, other(s.turn), atkActualRemoved);
      }
      checkWinner(s);
      return s;
    }

    case 'hero-power': {
      // package 4A: comeback discount applies; base cost is still 2.
      const pc = effectivePowerCost(s, s.turn);
      if (me.gas < pc) throw new Error(`hero power costs ${pc}, have ${me.gas}`);
      me.gas -= pc;
      me.heroPowerUsed = true;
      if (s.mulliganPhase[s.turn]) s.mulliganPhase[s.turn] = false;
      const hero = heroDef(me.heroId);
      pushLog(s, `P${s.turn} hero power: ${hero.powerName}${pc === 1 ? ' (comeback)' : ''}`);
      switch (hero.power) {
        case 'damage-random-enemy':
          applyEffect(s, s.turn, { kind: 'damage-random-enemy', amount: 2 });
          break;
        case 'heal-treasury':
          applyEffect(s, s.turn, { kind: 'heal-treasury', amount: 3 });
          break;
        case 'draw-burn':
          drawCards(s, s.turn, 1);
          me.treasury -= 2;
          pushLog(s, `P${s.turn} takes 2 damage`);
          checkWinner(s);
          break;
        case 'gain-gas':
          me.gas += 2;
          pushLog(s, `P${s.turn} gains 2 gas`);
          break;
      }
      return s;
    }

    case 'stake': {
      const m = me.board.find(mm => mm.uid === action.uid);
      if (!m) throw new Error(`minion not found: ${action.uid}`);
      m.staked = true;
      m.canAttack = false;
      pushLog(s, `P${s.turn} stakes ${m.name}`);
      return s;
    }

    case 'unstake': {
      const m = me.board.find(mm => mm.uid === action.uid);
      if (!m) throw new Error(`minion not found: ${action.uid}`);
      m.staked = false;
      m.canAttack = false; // unstaked this turn can't attack until next turn
      m.fresh = false;
      pushLog(s, `P${s.turn} unstakes ${m.name}`);
      return s;
    }

    case 'end-turn': {
      if (s.mulliganPhase[s.turn]) s.mulliganPhase[s.turn] = false;
      startTurn(s);
      return s;
    }
  }
}

export function isGameOver(state: GameState): boolean {
  return state.winner !== null;
}
