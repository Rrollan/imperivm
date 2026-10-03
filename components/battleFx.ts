/**
 * IMPERIVM — legacy UI-FX adapter.
 *
 * The board UI still reads board-level deltas (deaths / floats / new
 * cards) for its inline animations (overlay on individual minions).
 * The structured, action-aware events come from `lib/events.ts` and are
 * consumed directly by `MotionFx` + `emitSfxFromEvents`.
 *
 * IMPORTANT: this file MUST NOT trigger off stale log markers. The new
 * `BattleEvents` payload is computed via the safe suffix-overlap
 * algorithm in `lib/events.ts`, so we forward its `deaths`, `damages`
 * and `attack` fields directly and skip the log-string scanning path
 * that broke once the log cap rolled.
 */
import type { GameState, Minion, PlayerId } from '../lib/engine/types';
import { diffAction, type BattleEvents } from '../lib/events';

export interface UiFloat {
  key: number;
  targetUid: string; // minion uid, or 'hero-0' / 'hero-1'
  amount: number;
  kind: 'damage' | 'heal';
}

export interface DyingMinion {
  uid: string;
  cardId: string;
  name: string;
  owner: PlayerId;
  attack: number;
  health: number;
}

export interface BattleFx {
  floats: Omit<UiFloat, 'key'>[];
  deaths: DyingMinion[];
  resolvedNames: string[];
  countered: boolean;
  rugPull: boolean;
  halving: boolean;
  attack: { attackerUid: string; targetUid: string } | null;
  newBoardUids: string[];
  newHandUids: string[]; // player 0 only (foe hand is hidden)
}

function byUid(list: Minion[], uid: string): Minion | undefined {
  for (const m of list) if (m.uid === uid) return m;
  return undefined;
}

/**
 * Pure diff between two consecutive game states → UI animation events.
 *
 * If `action` is supplied we route through `diffAction` (the safe
 * suffix-overlap scanner). Without action we fall back to a board-only
 * diff (no log-string scanning) so this function is still safe under
 * capped log.
 */
export function diffBattleFx(
  prev: GameState,
  next: GameState,
  action?: import('../lib/engine/types').Action,
): BattleFx {
  const fx: BattleFx = {
    floats: [],
    deaths: [],
    resolvedNames: [],
    countered: false,
    rugPull: false,
    halving: false,
    attack: null,
    newBoardUids: [],
    newHandUids: [],
  };

  // Structured events — only when action context is available.
  let ev: BattleEvents | null = null;
  if (action) {
    try {
      ev = diffAction(prev, next, action);
    } catch {
      ev = null;
    }
  }

  if (ev) {
    fx.rugPull = !!ev.rugPull;
    fx.halving = !!(ev.halvings && ev.halvings.length > 0);
    fx.countered = !!ev.spellCountered;
    if (ev.spellResolved) {
      for (const r of ev.spellResolved) fx.resolvedNames.push(r.name);
    }
    if (ev.attack) {
      fx.attack = {
        attackerUid: ev.attack.attackerUid,
        targetUid:
          ev.attack.targetUid === 'hero'
            ? `hero-${ev.attack.targetOwner}`
            : ev.attack.targetUid,
      };
    }
    if (ev.deaths) {
      for (const d of ev.deaths) {
        // Recover the prev-state minion snapshot for legacy consumers.
        const m = byUid(prev.players[d.owner].board, d.uid);
        if (!m) continue;
        fx.deaths.push({
          uid: d.uid,
          cardId: m.cardId,
          name: m.name,
          owner: d.owner,
          attack: m.attack,
          health: m.health,
        });
      }
    }
    if (ev.damages) {
      for (const d of ev.damages) {
        const owner = d.prevHealth > d.health
          ? (prev.players[0].board.some(m => m.uid === d.uid) ? 0 : 1)
          : (next.players[0].board.some(m => m.uid === d.uid) ? 0 : 1);
        if (d.health < d.prevHealth) {
          fx.floats.push({ targetUid: d.uid, amount: d.prevHealth - d.health, kind: 'damage' });
        } else if (d.health > d.prevHealth) {
          fx.floats.push({ targetUid: d.uid, amount: d.health - d.prevHealth, kind: 'heal' });
        }
        void owner;
      }
    }
    if (ev.gameOver) {
      // Legacy field — surfaced through `rugPull`/`halving` for old
      // consumers. End-game UI now reads `events.gameOver` directly.
    }
  }

  // Board deltas — exact uid lookups (safe under any log cap).
  const pids: PlayerId[] = [0, 1];
  for (const pid of pids) {
    const pb = prev.players[pid].board;
    const nb = next.players[pid].board;
    for (const m of pb) {
      const n = byUid(nb, m.uid);
      if (!n) {
        // Skip duplicates from the structured-events branch above.
        if (!fx.deaths.some(d => d.uid === m.uid && d.owner === pid)) {
          fx.deaths.push({ uid: m.uid, cardId: m.cardId, name: m.name, owner: pid, attack: m.attack, health: m.health });
        }
      } else if (n.health < m.health) {
        if (!fx.floats.some(f => f.targetUid === m.uid && f.kind === 'damage')) {
          fx.floats.push({ targetUid: m.uid, amount: m.health - n.health, kind: 'damage' });
        }
      } else if (n.health > m.health) {
        if (!fx.floats.some(f => f.targetUid === m.uid && f.kind === 'heal')) {
          fx.floats.push({ targetUid: m.uid, amount: n.health - m.health, kind: 'heal' });
        }
      }
    }
    for (const n of nb) {
      if (!byUid(pb, n.uid)) fx.newBoardUids.push(n.uid);
    }
  }

  // Treasuries
  for (const pid of pids) {
    const d = prev.players[pid].treasury - next.players[pid].treasury;
    if (d > 0) fx.floats.push({ targetUid: `hero-${pid}`, amount: d, kind: 'damage' });
    else if (d < 0) fx.floats.push({ targetUid: `hero-${pid}`, amount: -d, kind: 'heal' });
  }

  // Attack lunge fallback — only when structured events are unavailable.
  if (!fx.attack && !action && next.turn === prev.turn) {
    const actor = next.turn;
    const foe: PlayerId = actor === 0 ? 1 : 0;
    const pb = prev.players[actor].board;
    const nb = next.players[actor].board;
    let attacker: string | null = null;
    for (const m of pb) {
      const n = byUid(nb, m.uid);
      if (n && m.canAttack && !n.canAttack && !n.staked) {
        attacker = m.uid;
        break;
      }
    }
    if (attacker) {
      const foePb = prev.players[foe].board;
      const foeNb = next.players[foe].board;
      let target: string | null = null;
      let bestDrop = 0;
      for (const m of foePb) {
        const n = byUid(foeNb, m.uid);
        if (!n) { target = m.uid; break; }
        if (n.health < m.health && m.health - n.health > bestDrop) {
          bestDrop = m.health - n.health;
          target = m.uid;
        }
      }
      const foeTreasuryHit = next.players[foe].treasury < prev.players[foe].treasury;
      if (target !== null || foeTreasuryHit) {
        fx.attack = { attackerUid: attacker, targetUid: target !== null ? target : `hero-${foe}` };
      }
    }
  }

  // Freshly drawn hand cards (player 0).
  const prevHandUids: Record<string, true> = {};
  for (const h of prev.players[0].hand) prevHandUids[h.uid] = true;
  for (const h of next.players[0].hand) {
    if (!prevHandUids[h.uid]) fx.newHandUids.push(h.uid);
  }

  return fx;
}
