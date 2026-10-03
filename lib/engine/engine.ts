/**
 * IMPERIVM — game engine (lib/engine/engine.ts).
 *
 * Pure TypeScript, no dependencies besides ./types and card/hero data.
 * Every transition is immutable: applyAction() structuredClones the input
 * and returns a brand-new GameState. Throws Error on illegal actions.
 *
 * Implements the "Rules summary" in lib/engine/types.ts exactly.
 * types.ts is the source of truth and is NOT modified here.
 */

import { CARDS } from '../cards';
import { HEROES } from '../heroes';
import type {
  Action,
  CardDef,
  EffectDef,
  GameState,
  HeroDef,
  MempoolEntry,
  Minion,
  PlayerId,
  PlayerState,
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
}

/** Read a player's mempool (cast spells waiting to resolve next turn). */
export function mempoolOf(state: GameState, pid: PlayerId): MempoolEntry[] {
  const p = state.players[pid] as EnginePlayer | undefined;
  return p !== undefined && Array.isArray(p.mempool) ? p.mempool : [];
}

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

function makeMinion(s: EngineGame, def: CardDef): Minion {
  return {
    uid: nextUid(s),
    cardId: def.id,
    name: def.name,
    attack: def.attack ?? 0,
    health: def.health ?? 1,
    maxHealth: def.health ?? 1,
    canAttack: false,
    staked: false,
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

function applyEffect(s: EngineGame, caster: PlayerId, eff: EffectDef): void {
  const me = s.players[caster];
  const foe = s.players[other(caster)];
  switch (eff.kind) {
    case 'damage-all-enemy-minions': {
      const amt = eff.amount ?? 0;
      pushLog(s, `${amt} damage to all enemy minions`);
      for (const m of [...foe.board]) damageMinion(s, foe.id, m.uid, amt);
      break;
    }
    case 'damage-random-enemy': {
      const amt = eff.amount ?? 0;
      if (foe.board.length > 0) {
        const t = foe.board[Math.floor(rand(s) * foe.board.length)] as Minion;
        pushLog(s, `${amt} damage to random enemy ${t.name}`);
        damageMinion(s, foe.id, t.uid, amt);
      } else {
        foe.treasury -= amt;
        pushLog(s, `${amt} damage to enemy treasury`);
      }
      break;
    }
    case 'damage-enemy-treasury': {
      const amt = eff.amount ?? 0;
      foe.treasury -= amt;
      pushLog(s, `${amt} damage to enemy treasury`);
      break;
    }
    case 'heal-treasury': {
      const amt = eff.amount ?? 0;
      me.treasury = Math.min(30, me.treasury + amt);
      pushLog(s, `P${caster} restores ${amt} treasury`);
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
}

/** Runs the start-of-turn sequence for the new active player. */
function startTurn(s: EngineGame): void {
  s.block += 1;
  s.turn = other(s.turn);
  const me = s.players[s.turn];
  pushLog(s, `Block ${s.block} — P${s.turn} turn`);

  // 1. Resolve the new active player's mempool entries in cast order.
  const entries = me.mempool;
  me.mempool = [];
  for (const e of entries) {
    const def = cardDef(e.cardId);
    if (def.type !== 'spell' || !def.spell) {
      pushLog(s, `${e.name} fizzles`);
      continue;
    }
    pushLog(s, `${e.name} resolves`);
    applyEffect(s, s.turn, def.spell);
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
  me.gas = me.maxGas + me.board.filter(m => m.staked).length;
  me.heroPowerUsed = false;

  // 4. Draw (fatigue / burn handled inside).
  drawCards(s, s.turn, 1);
  if (s.winner !== null) return;

  // 5. Ready unstaked minions.
  for (const m of me.board) {
    if (!m.staked) m.canAttack = true;
  }
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
  }
  return 'unknown';
}

export function createGame(
  heroA: string,
  deckA: string[],
  heroB: string,
  deckB: string[],
  seed?: number,
): GameState {
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
    };
  };

  const s: EngineGame = {
    block: 1,
    turn: 0,
    players: [mkPlayer(0, heroA, deckA), mkPlayer(1, heroB, deckB)],
    winner: null,
    log: [],
    rng: seed === undefined ? (Math.random() * 0x7fffffff) | 0 : seed | 0,
  };

  shuffleDeck(s, s.players[0].deck);
  shuffleDeck(s, s.players[1].deck);

  s.players[0].maxGas = 1;
  s.players[0].gas = 1;
  drawCards(s, 0, 3);
  drawCards(s, 1, 4);

  pushLog(s, `Game start: ${heroDef(heroA).name} (P0) vs ${heroDef(heroB).name} (P1)`);
  return s;
}

export function legalActions(state: GameState): Action[] {
  if (state.winner !== null) return [];
  const me = state.players[state.turn];
  const foe = state.players[other(state.turn)];
  const acts: Action[] = [];

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
    acts.push({ type: 'attack', attackerUid: m.uid, target: 'hero' });
    for (const t of foe.board) {
      acts.push({ type: 'attack', attackerUid: m.uid, target: t.uid });
    }
  }

  if (me.gas >= 2 && !me.heroPowerUsed) acts.push({ type: 'hero-power' });

  for (const m of me.board) {
    acts.push({ type: m.staked ? 'unstake' : 'stake', uid: m.uid });
  }

  acts.push({ type: 'end-turn' });
  return acts;
}

export function applyAction(state: GameState, action: Action): GameState {
  if (isGameOver(state)) throw new Error('cannot act: game is over');
  const key = actionKey(action);
  const ok = legalActions(state).some(a => actionKey(a) === key);
  if (!ok) throw new Error(`illegal action: ${key}`);

  const s = structuredClone(state) as EngineGame;
  for (const p of s.players) {
    if (!Array.isArray(p.mempool)) p.mempool = [];
  }
  const me = s.players[s.turn];
  const foe = s.players[other(s.turn)];

  switch (action.type) {
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
      if (def.priority) counterMempool(s, s.turn);
      checkWinner(s);
      return s;
    }

    case 'attack': {
      const atk = me.board.find(m => m.uid === action.attackerUid);
      if (!atk) throw new Error(`attacker not found: ${action.attackerUid}`);
      atk.canAttack = false;
      if (action.target === 'hero') {
        foe.treasury -= atk.attack;
        pushLog(s, `P${s.turn} ${atk.name} hits treasury for ${atk.attack}`);
      } else {
        const tgt = foe.board.find(m => m.uid === action.target);
        if (!tgt) throw new Error(`attack target not found: ${action.target}`);
        const atkName = atk.name;
        const tgtName = tgt.name;
        const atkDmg = atk.attack;
        const tgtDmg = tgt.attack;
        tgt.health -= atkDmg;
        atk.health -= tgtDmg;
        pushLog(s, `${atkName} trades with ${tgtName}`);
        if (tgt.health <= 0) {
          foe.board = foe.board.filter(m => m.uid !== tgt.uid);
          pushLog(s, `${tgtName} dies`);
        }
        if (atk.health <= 0) {
          me.board = me.board.filter(m => m.uid !== atk.uid);
          pushLog(s, `${atkName} dies`);
        }
      }
      checkWinner(s);
      return s;
    }

    case 'hero-power': {
      me.gas -= 2;
      me.heroPowerUsed = true;
      const hero = heroDef(me.heroId);
      pushLog(s, `P${s.turn} hero power: ${hero.powerName}`);
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
      m.canAttack = false;
      pushLog(s, `P${s.turn} unstakes ${m.name}`);
      return s;
    }

    case 'end-turn': {
      startTurn(s);
      return s;
    }
  }
}

export function isGameOver(state: GameState): boolean {
  return state.winner !== null;
}
