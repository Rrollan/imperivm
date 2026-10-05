/**
 * IMPERIVM — structured event adapter (battle -> FX + audio).
 *
 * Replaces the legacy log-slice approach which silently broke once the
 * engine's `state.log` cap (120 entries) rolled. Algorithm:
 *
 *   1. Find the longest overlap of new-log-tail against old-log-tail by
 *      comparing strings (not indices). Cap-roll safe.
 *   2. Only NEW log lines are scanned for markers — stale lines from
 *      earlier turns never re-trigger anything.
 *   3. Mempool set diff (by uid) via the public `mempoolOf()` helper:
 *        - queued: a new uid appears
 *        - resolved: a uid disappears AND a resolve/fizzle line for the
 *          same owner exists in the same start-of-turn batch
 *        - countered: a uid disappears without a resolve/fizzle line, unless
 *          the game ended before the engine could process the rest of queue
 *      Multiple resolutions per start-of-turn are first-class: emitted
 *      as `spellResolved[]` instead of a singleton.
 *   4. RUG PULL detection scans ONLY the new lines for the exact string
 *      'RUG PULL! All minions destroyed' (logged by `applyEffect` at
 *      resolution time). Queueing the spell never logs that string,
 *      so the vortex waits for the real resolve.
 *   5. Halving detection scans new lines for `'Halving:'` — supports
 *      multiple halving pops in the same start-of-turn batch.
 *   6. Priority counter: any `' counters '` line in `newLog` is
 *      surfaced via `spellCountered` (paired with the disappeared
 *      mempool uid by name+owner).
 *   7. Damage / death numbers are derived from minion diffs (exact
 *      attacker/target from the action context + exact uid board deltas)
 *      — not guessed from log substrings.
 *
 * Action context (when provided) is the source of truth for:
 *   - attack: attackerUid, target, fatal-on-retaliation detection
 *   - play-minion: queue source + cost
 *   - cast-spell: detects priority-counter side effect in same batch
 *   - hero-power / stake / unstake / end-turn: explicit semantics
 *
 * IMPORTANT: This module only touches the PUBLIC GameState surface.
 * The internal mempool lives on the engine's private EngineGame and is
 * exposed via `mempoolOf(state, pid)`. We never read
 * `state.players[pid].mempool` directly — the public `PlayerState` type
 * does not declare it.
 */
import type {
  Action,
  GameState,
  Minion,
  PlayerId,
  SpellEffectResult,
} from './engine/types';
import { mempoolOf, spellEffectsOf } from './engine/engine';
import { CARDS } from './cards';

export interface DeadMinion {
  uid: string;
  name: string;
  owner: PlayerId;
  /** True for destruction by RUG PULL. */
  byRugi: boolean;
}

export interface DamageInstance {
  uid: string;
  name: string;
  /** Health the minion has after the diff (already-applied damage). */
  health: number;
  /** Max health (for computing % float). */
  maxHealth: number;
  /** Health in prev. Derived from current + applied damage. */
  prevHealth: number;
  /** True when this UID disappeared from the board in this diff. */
  died: boolean;
}

export interface CounteredSpell {
  owner: PlayerId;
  cardId: string;
  name: string;
  mempoolUid: string;
}

export interface BattleEvents {
  /** New card played onto our board. */
  play?: { cardId: string; name: string; fromHandUid: string };
  /** Spell cast into a mempool (does not resolve yet). */
  spellQueued?: { owner: PlayerId; cardId: string; name: string; mempoolUid: string };
  /** Spells actually resolved from the mempool at start-of-turn. */
  spellResolved?: Array<{
    owner: PlayerId;
    cardId: string;
    name: string;
    mempoolUid: string;
    fizzled: boolean;
  }>;
  /** Exact targets/deltas from newly resolved healing and weakening spells. */
  effectResults?: SpellEffectResult[];
  /** An enemy mempool spell was removed without resolving (priority). */
  spellCountered?: CounteredSpell;
  /** All countered entries in engine order; singular field stays compatible. */
  spellCounters?: CounteredSpell[];
  /** Minion-to-minion or minion-to-treasury attack we should lunge for. */
  attack?: {
    attackerUid: string;
    attackerName: string;
    attackerOwner: PlayerId;
    targetUid: string | 'hero';
    targetName: string;
    targetOwner: PlayerId;
    /** Damage the target took from this attack (0 if death-preventing). */
    damage: number;
    /** True if the attacker died from retaliation in the same action. */
    attackerFatal: boolean;
  };
  /** Damage floats to render on minions. */
  damages?: DamageInstance[];
  /** Exact stat targets, including debuffs that do not remove health. */
  statChanges?: Array<{uid:string;owner:PlayerId;attackBefore:number;attackAfter:number}>;
  /** Death fade targets. */
  deaths?: DeadMinion[];
  /** Halving pulses to render (+1/+1). One per matching log line. */
  halvings?: Array<{ uid: string; name: string }>;
  /** RUG PULL! resolution. Never fires on cast — only on resolution. */
  rugPull?: true;
  /** Terminal game-over line. perspective = "me" | "foe" | "draw" from ME=0. */
  gameOver?: { winner: PlayerId | 'draw'; perspective: 'me' | 'foe' | 'draw' };
}

/**
 * Compute the longest k ≥ 0 such that
 *   prev[prev.length-k … prev.length]  ===  next[0 … k]
 *
 * (the trailing k of `prev` match the leading k of `next`). The newly
 * appended lines are `next.slice(k)`. This is the ONLY correct way to
 * compute the appended suffix when `state.log` is capped: comparing by
 * value, not by index, and not by tail-to-tail which produces wrong
 * results when the new lines are purely additional.
 *
 * Examples:
 *   [a,b]       → [a,b,c]   : k=2 → newLog = [c]
 *   [a,b,c] (cap-roll) → [b,c,d] : k=2 → newLog = [d]
 *   [a,b]       → [a,b]     : k=2 → newLog = []
 *   [a,b]       → [c,d]     : k=0 → newLog = [c,d]
 *   [a,b,c]     → [c,d,e,f] : k=1 → newLog = [d,e,f]
 */
function computeLogAppendedSuffix(prev: string[], next: string[]): number {
  const max = Math.min(prev.length, next.length);
  for (let k = max; k >= 0; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (prev[prev.length - k + i] !== next[i]) { ok = false; break; }
    }
    if (ok) return k;
  }
  return 0;
}

const SPELL_RESOLVE_RE = /^(.+) resolves$/;
const SPELL_FIZZLE_RE = /^(.+) fizzles$/;
const HALVING_RE = /^Halving: (.+) \+1\/\+1$/;
const COUNTERS_RE = /^P\d (counter fizzles|counters .+)$/;
const START_TURN_RE = /^Block \d+ — P([01]) turn$/;
const RUG_PULL_LINE = 'RUG PULL! All minions destroyed';

function parseStartTurnOwner(line: string): PlayerId | null {
  const m = START_TURN_RE.exec(line);
  return m ? (Number(m[1]) as PlayerId) : null;
}

/** Find the index of the most recent start-of-turn line in `lines`, or -1. */
function findStartTurnIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (parseStartTurnOwner(lines[i]) !== null) return i;
  }
  return -1;
}

/** Resolve a minion uid to its (owner, Minion) pair, or null. */
function findMinion(
  state: GameState,
  uid: string,
): { owner: PlayerId; minion: Minion } | null {
  for (const owner of [0, 1] as const) {
    const m = state.players[owner].board.find(x => x.uid === uid);
    if (m) return { owner, minion: m };
  }
  return null;
}

/** Treasury or minion health diff between prev and next. */
function hpDelta(prev: GameState, next: GameState, owner: PlayerId, uid: string): {
  prevHp: number;
  nextHp: number;
  targetName: string;
} {
  if (uid === 'hero') {
    return {
      prevHp: prev.players[owner].treasury,
      nextHp: next.players[owner].treasury,
      targetName: 'Treasury',
    };
  }
  const p = prev.players[owner].board.find(m => m.uid === uid);
  const n = next.players[owner].board.find(m => m.uid === uid);
  return {
    prevHp: p?.health ?? 0,
    nextHp: n?.health ?? p?.health ?? 0,
    targetName: p?.name ?? n?.name ?? 'minion',
  };
}

/**
 * Compare mempool sets by uid (via the public `mempoolOf` helper) and
 * classify each disappearance as resolved or countered. We cross-check
 * the engine log inside the same start-of-turn batch to disambiguate:
 *
 *   - For each owner, list disappeared uids in cast order
 *     (= `prev.players[owner].mempool` order; `mempoolOf` returns the
 *     live array reference, so iteration order matches engine).
 *   - Parse the new log lines after the most recent start-turn marker.
 *     `P<owner> X resolves` → consumed in order. Same for `fizzles`.
 *   - Pair by order. Unmatched disappears are countered only while the game
 *     remains active; a terminal game state consumes no further queue entries.
 *
 * The `P0 counters X` line tells us a counter happened; we surface it
 * via `spellCountered` keyed to the disappeared enemy uid.
 */
function diffMempool(
  prev: GameState,
  next: GameState,
  newLog: string[],
  startTurnBoundary: number,
  into: BattleEvents,
): void {
  const gameEnded = prev.winner === null && next.winner !== null;
  const prevByUid = new Map<string, { owner: PlayerId; cardId: string; name: string }>();
  const nextByUid = new Map<string, { owner: PlayerId; cardId: string; name: string }>();
  for (const owner of [0, 1] as const) {
    for (const e of mempoolOf(prev, owner)) prevByUid.set(e.uid, e);
    for (const e of mempoolOf(next, owner)) nextByUid.set(e.uid, e);
  }

  // 1. Newly queued entries — spell cast into a mempool.
  nextByUid.forEach((e, uid) => {
    if (!prevByUid.has(uid)) {
      into.spellQueued = { owner: e.owner, cardId: e.cardId, name: e.name, mempoolUid: uid };
    }
  });

  // 2. Disappeared entries — resolved or counter-cancelled.
  const resolved: NonNullable<BattleEvents['spellResolved']> = [];
  const counterCandidates: CounteredSpell[] = [];
  for (const owner of [0, 1] as const) {
    const prevArr = mempoolOf(prev, owner);
    const nextUids = new Set(mempoolOf(next, owner).map(e => e.uid));
    const disappeared = prevArr.filter(e => !nextUids.has(e.uid));
    if (disappeared.length === 0) continue;

    // Resolve/fizzle lines are plain `'${name} resolves'` /
    // `'${name} fizzles'` (no `P0` prefix). They appear immediately
    // after the most recent `'Block N — P${owner} turn'` line in the
    // SAME newLog batch. So we find the latest start-turn marker for
    // THIS owner and slice after it.
    let ownerStartIdx = -1;
    for (let i = startTurnBoundary; i >= 0; i--) {
      const o = parseStartTurnOwner(newLog[i]);
      if (o === owner) { ownerStartIdx = i; break; }
    }
    const batchLines = ownerStartIdx >= 0
      ? newLog.slice(ownerStartIdx + 1)
      : [];
    const ownerResolves: { name: string; fizzled: boolean }[] = [];
    for (const line of batchLines) {
      // Stop at any subsequent start-turn (a different owner's turn).
      if (parseStartTurnOwner(line) !== null) break;
      const r = SPELL_RESOLVE_RE.exec(line);
      if (r) { ownerResolves.push({ name: r[1], fizzled: false }); continue; }
      const f = SPELL_FIZZLE_RE.exec(line);
      if (f) { ownerResolves.push({ name: f[1], fizzled: true }); continue; }
    }

    if (ownerResolves.length > 0) {
      // Pair disappeared entries with resolve/fizzle lines in order.
      for (let i = 0; i < disappeared.length; i++) {
        const e = disappeared[i];
        const r = ownerResolves[i];
        if (r) {
          resolved.push({
            owner: e.owner,
            cardId: e.cardId,
            name: r.name, // authoritative from engine log
            mempoolUid: e.uid,
            fizzled: r.fizzled,
          });
        } else {
          // The engine removes the entire queue before resolving it. If an
          // earlier spell ends the game, later entries disappear without
          // resolving and are not priority-countered.
          if (!gameEnded) {
            counterCandidates.push({
              owner: e.owner,
              cardId: e.cardId,
              name: e.name,
              mempoolUid: e.uid,
            });
          }
        }
      }
    } else if (!gameEnded) {
      // No resolve lines at all — absent a terminal winner, this is a counter.
      counterCandidates.push(...disappeared.map(entry => ({
        owner: entry.owner, cardId: entry.cardId, name: entry.name, mempoolUid: entry.uid,
      })));
    }
  }
  if (resolved.length > 0) into.spellResolved = resolved;

  // 3. Match each counter log to a disappeared defender UID. Duplicate
  //    copies with the same name are claimed once each, in engine order.
  const counters: CounteredSpell[] = [];
  for (const line of newLog) {
    const m = /^P(\d+) counters (.+)$/.exec(line);
    if (!m) continue;
    const counterOwner = Number(m[1]) as PlayerId;
    const victim = counterOwner === 0 ? 1 : 0;
    const victimName = m[2];
    const victimEntry = mempoolOf(prev, victim).find(e => e.name === victimName && !nextByUid.has(e.uid) && !counters.some(c => c.mempoolUid === e.uid));
    if (victimEntry) {
      counters.push({
        owner: victim,
        cardId: victimEntry.cardId,
        name: victimEntry.name,
        mempoolUid: victimEntry.uid,
      });
    }
  }
  for (const entry of counterCandidates) if (!counters.some(c => c.mempoolUid === entry.mempoolUid)) counters.push(entry);
  if (counters.length) {
    into.spellCountered = counters[0];
    into.spellCounters = counters;
  }
}

/** Diff a single player's board by uid: deaths and damage deltas. */
function diffBoards(
  prev: GameState,
  next: GameState,
  rugPullActive: boolean,
  into: BattleEvents,
): void {
  const damages: DamageInstance[] = [];
  const deaths: DeadMinion[] = [];

  for (const owner of [0, 1] as const) {
    const prevByUid = new Map(prev.players[owner].board.map(m => [m.uid, m] as const));
    const nextByUid = new Map(next.players[owner].board.map(m => [m.uid, m] as const));

    prevByUid.forEach((m, uid) => {
      if (!nextByUid.has(uid)) {
        deaths.push({ uid, name: m.name, owner, byRugi: rugPullActive });
        if (!rugPullActive) damages.push({ uid, name: m.name, health: 0,
          maxHealth: m.maxHealth, prevHealth: m.health, died: true });
      }
    });

    nextByUid.forEach((m, uid) => {
      const p = prevByUid.get(uid);
      if (!p) return; // new summon — handled by `play`
      if(m.attack!==p.attack)(into.statChanges??=[]).push({uid,owner,attackBefore:p.attack,attackAfter:m.attack});
      if (m.health !== p.health) {
        damages.push({
          uid,
          name: m.name,
          health: m.health,
          maxHealth: m.maxHealth,
          prevHealth: p.health,
          died: false,
        });
      }
    });
  }

  if (damages.length > 0) into.damages = damages;
  if (deaths.length > 0) into.deaths = deaths;
}

/**
 * Build a fresh `BattleEvents` object from the (prev, next) state pair,
 * constrained to a single user/AI action when `action` is provided.
 *
 * Returns `null` if nothing observable changed — callers should NOT fire
 * any SFX in that case.
 */
export function diffAction(
  prev: GameState,
  next: GameState,
  action?: Action,
): BattleEvents | null {
  const ev: BattleEvents = {};

  // ── 1. Freshly-appended log suffix by value overlap. ──
  const appendedAt = computeLogAppendedSuffix(prev.log, next.log);
  const newLog = next.log.slice(appendedAt);
  if (newLog.length === 0) {
    // No new log lines, but state may still differ (rng-only bump).
    return null;
  }

  const startTurnIdx = findStartTurnIndex(newLog);
  const rugPullActive = newLog.includes(RUG_PULL_LINE);
  if (rugPullActive) ev.rugPull = true;

  // ── 2. Match fresh halving lines in engine board order. Healing, buffs
  //        or weakening can alter the same stats earlier in this action,
  //        so its aggregate delta cannot identify the halving target.
  //        A summoned fighter can also halve on its arrival block. ──
  const halvingBuffs: Array<{ uid: string; name: string; owner: PlayerId }> = [];
  for (const owner of [0, 1] as const) {
    for (const n of next.players[owner].board) {
      const period=CARDS[n.cardId]?.halvingPeriod??0;
      if (next.block>prev.block && period>0 && next.block%period===0) {
        halvingBuffs.push({ uid: n.uid, name: n.name, owner });
      }
    }
  }
  const halvings: NonNullable<BattleEvents['halvings']> = [];
  for (const line of newLog) {
    const m = HALVING_RE.exec(line);
    if (!m) continue;
    const targetName = m[1];
    // Pop the first candidate whose name matches and that hasn't been
    // claimed by an earlier halving line in this batch.
    const idx = halvingBuffs.findIndex(
      h => h.name === targetName && !halvings.some(x => x.uid === h.uid),
    );
    if (idx >= 0) {
      halvings.push({ uid: halvingBuffs[idx].uid, name: halvingBuffs[idx].name });
    }
  }
  if (halvings.length > 0) ev.halvings = halvings;

  // ── 3. Game over. ──
  for (const line of newLog) {
    let winner: PlayerId | 'draw' | null = null;
    if (line === 'Game over: P0 wins') winner = 0;
    else if (line === 'Game over: P1 wins') winner = 1;
    else if (line === 'Game over: draw') winner = 'draw';
    if (winner !== null) {
      const perspective: 'me' | 'foe' | 'draw' =
        winner === 'draw' ? 'draw' : winner === 0 ? 'me' : 'foe';
      ev.gameOver = { winner, perspective };
      break;
    }
  }

  // ── 4. Mempool deltas (public API only). ──
  diffMempool(prev, next, newLog, startTurnIdx, ev);
  const effectResults = spellEffectsOf(next);
  if (effectResults.length > 0) ev.effectResults = effectResults;

  // ── 5. Board deltas. ──
  diffBoards(prev, next, rugPullActive, ev);

  // ── 6. Action-specific overlays (lunge, play, priority counter). ──
  if (action) applyActionContext(prev, next, action, ev);

  // ── 7. Suppress empty envelopes. ──
  if (
    !ev.play && !ev.spellQueued && !ev.spellResolved && !ev.effectResults && !ev.spellCountered &&
    !ev.attack && !ev.damages && !ev.deaths && !ev.halvings &&
    !ev.rugPull && !ev.gameOver
  ) {
    return null;
  }
  return ev;
}

function applyActionContext(
  prev: GameState,
  next: GameState,
  action: Action,
  ev: BattleEvents,
): void {
  switch (action.type) {
    case 'play-minion': {
      const actor = prev.turn;
      const fromHand = prev.players[actor].hand.find(h => h.uid === action.uid);
      if (fromHand) {
        const m = next.players[actor].board.find(x => x.cardId === fromHand.cardId && !prev.players[actor].board.some(p => p.uid === x.uid));
        ev.play = {
          cardId: fromHand.cardId,
          name: m?.name ?? fromHand.cardId,
          fromHandUid: action.uid,
        };
      }
      break;
    }
    case 'cast-spell': {
      // Cast-spell adds to mempool (already captured by diffMempool as
      // `spellQueued`). The priority-counter side effect, if any, is
      // surfaced by diffMempool's `P0 counters X` scan.
      break;
    }
    case 'attack': {
      const attacker = findMinion(prev, action.attackerUid);
      if (!attacker) break;
      const atkOwner = attacker.owner;
      const targetOwner: PlayerId = atkOwner === 0 ? 1 : 0;
      const { prevHp, nextHp, targetName } = hpDelta(prev, next, targetOwner, action.target);
      // If the target vanished from the board it died this attack —
      // damage equals its previous hp (it dropped to 0). Treasury
      // damage is always present in `next` so no special case needed.
      const targetGone = action.target !== 'hero' &&
        !next.players[targetOwner].board.some(m => m.uid === action.target);
      const damage = Math.max(0, prevHp - (targetGone ? 0 : nextHp));
      const attackerFatal = !next.players[atkOwner].board.some(m => m.uid === action.attackerUid);
      ev.attack = {
        attackerUid: action.attackerUid,
        attackerName: attacker.minion.name,
        attackerOwner: atkOwner,
        targetUid: action.target === 'hero' ? 'hero' : action.target,
        targetName,
        targetOwner,
        damage,
        attackerFatal,
      };
      break;
    }
    case 'hero-power':
    case 'end-turn':
    case 'stake':
    case 'unstake':
      // No additional structured overlay; log-driven effects (mempool
      // resolve, halving, rugpull) already land via newLog scanning.
      break;
  }
}
