import type { GameState, MempoolEntry, Minion, PlayerId } from '../lib/engine/types';
import { mempoolOf } from '../lib/engine/engine';

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

function allMempool(s: GameState): MempoolEntry[] {
  return [...mempoolOf(s, 0), ...mempoolOf(s, 1)];
}

function byUid(list: Minion[], uid: string): Minion | undefined {
  for (const m of list) {
    if (m.uid === uid) return m;
  }
  return undefined;
}

/**
 * Pure diff between two consecutive game states → UI animation events.
 * The engine itself is never touched; everything is derived from
 * board/treasury/mempool deltas and new log lines.
 */
export function diffBattleFx(prev: GameState, next: GameState): BattleFx {
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

  const newLog = next.log.slice(prev.log.length);
  const hasLog = (sub: string) => {
    for (const l of newLog) {
      if (l.includes(sub)) return true;
    }
    return false;
  };
  fx.rugPull = hasLog('RUG PULL');
  fx.halving = hasLog('Halving:');
  fx.countered = hasLog('counters ');

  // mempool entries that vanished
  const nextMpUids: Record<string, true> = {};
  for (const e of allMempool(next)) nextMpUids[e.uid] = true;
  for (const e of allMempool(prev)) {
    if (!nextMpUids[e.uid] && hasLog(`${e.name} resolves`)) {
      fx.resolvedNames.push(e.name);
    }
  }

  // boards: deaths, damage/heal floats, newcomers
  const pids: PlayerId[] = [0, 1];
  for (const pid of pids) {
    const pb = prev.players[pid].board;
    const nb = next.players[pid].board;
    for (const m of pb) {
      const n = byUid(nb, m.uid);
      if (!n) {
        fx.deaths.push({ uid: m.uid, cardId: m.cardId, name: m.name, owner: pid, attack: m.attack, health: m.health });
      } else if (n.health < m.health) {
        fx.floats.push({ targetUid: m.uid, amount: m.health - n.health, kind: 'damage' });
      } else if (n.health > m.health) {
        fx.floats.push({ targetUid: m.uid, amount: n.health - m.health, kind: 'heal' });
      }
    }
    for (const n of nb) {
      if (!byUid(pb, n.uid)) fx.newBoardUids.push(n.uid);
    }
  }

  // treasuries
  for (const pid of pids) {
    const d = prev.players[pid].treasury - next.players[pid].treasury;
    if (d > 0) fx.floats.push({ targetUid: `hero-${pid}`, amount: d, kind: 'damage' });
    else if (d < 0) fx.floats.push({ targetUid: `hero-${pid}`, amount: -d, kind: 'heal' });
  }

  // attack lunge: same player's turn continuing + one of their minions went
  // canAttack true→false (still alive, unstaked) + damage was dealt to the foe.
  if (next.turn === prev.turn) {
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
        if (!n) {
          target = m.uid;
          break;
        }
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

  // freshly drawn hand cards (player 0)
  const prevHandUids: Record<string, true> = {};
  for (const h of prev.players[0].hand) prevHandUids[h.uid] = true;
  for (const h of next.players[0].hand) {
    if (!prevHandUids[h.uid]) fx.newHandUids.push(h.uid);
  }

  return fx;
}
