/**
 * IMPERIVM — greedy AI (lib/ai.ts).
 *
 * chooseAiAction() always returns an action from legalActions(state).
 * The UI calls it repeatedly until it returns { type: 'end-turn' }.
 * Fully deterministic for a given state (stable priority order, no RNG use).
 */

import { CARDS } from './cards';
import { HEROES } from './heroes';
import { effectivePowerCost, legalActions, mempoolOf } from './engine/engine';
import type { Action, CardDef, GameState, HandCard } from './engine/types';

function handCard(state: GameState, uid: string): HandCard | undefined {
  return state.players[state.turn].hand.find(h => h.uid === uid);
}

function cardOf(state: GameState, uid: string): CardDef | undefined {
  const hc = handCard(state, uid);
  return hc === undefined ? undefined : CARDS[hc.cardId];
}

function playCost(state: GameState, a: Action): number {
  if (a.type === 'play-minion' || a.type === 'cast-spell') {
    return cardOf(state, a.uid)?.cost ?? 999;
  }
  return 999;
}

function isPriorityCard(state: GameState, a: Action): boolean {
  return (
    (a.type === 'play-minion' || a.type === 'cast-spell') &&
    cardOf(state, a.uid)?.priority === true
  );
}

export function chooseAiAction(state: GameState): Action {
  const acts = legalActions(state);
  const endTurn: Action = acts.find(a => a.type === 'end-turn') ?? { type: 'end-turn' };
  if (acts.length === 0) return endTurn;

  const me = state.players[state.turn];
  const foe = state.players[state.turn === 0 ? 1 : 0];

  const mulligans = acts.filter((a): a is Extract<Action, { type: 'mulligan' }> => a.type === 'mulligan');
  if (mulligans.length) {
    const expensive = me.hand.filter(h => CARDS[h.cardId].cost >= 4).map(h => h.uid);
    return mulligans.find(a => a.uids.length === expensive.length && a.uids.every(u => expensive.includes(u)))
      ?? mulligans[0];
  }

  // 1. Answer enemy mempool spells with a priority card (cheapest first).
  //    Prefer counter-mempool answers that specifically target a RUG PULL
  //    in the enemy mempool — Audit (or any future priority counter) wins
  //    the priority slot if RUG PULL is queued.
  const foeMem = mempoolOf(state, foe.id);
  if (foeMem.length > 0) {
    const foeHasRug = foeMem.some(e => e.cardId === 'rug-pull');
    const answers = acts
      .filter(a => isPriorityCard(state, a))
      .sort((x, y) => {
        // package 4A: cheapest first; tie-breaker — Audit (specific
        // anti-rug) wins when a RUG PULL is in enemy mempool.
        const d = playCost(state, x) - playCost(state, y);
        if (d !== 0) return d;
        if (foeHasRug) {
          const xUid = x.type === 'play-minion' || x.type === 'cast-spell' ? x.uid : '';
          const yUid = y.type === 'play-minion' || y.type === 'cast-spell' ? y.uid : '';
          const xr = cardOf(state, xUid)?.id === 'audit' ? 0 : 1;
          const yr = cardOf(state, yUid)?.id === 'audit' ? 0 : 1;
          return xr - yr;
        }
        return 0;
      });
    const first = answers[0];
    if (first !== undefined) return first;
  }

  // 2. Spend gas along the curve: play the most expensive playable card.
  //    Ties: minions before spells, then hand order (stable sort).
  const plays = acts
    .filter(a => a.type === 'play-minion' || a.type === 'cast-spell')
    .sort((x, y) => {
      const d = playCost(state, y) - playCost(state, x);
      if (d !== 0) return d;
      const px = x.type === 'play-minion' ? 0 : 1;
      const py = y.type === 'play-minion' ? 0 : 1;
      return px - py;
    });
  const play = plays[0];
  if (play !== undefined) return play;

  // 3. Attacks: favorable trades first — kill an enemy minion while
  //    surviving, or an even (mutual) trade — targeting the most
  //    dangerous enemy minion. Otherwise go face (highest attack first).
  //    package 4A: respect Taunt — if any enemy taunt exists, we MUST
  //    target it; legalActions already excludes non-taunt minion and
  //    hero targets, so a best-trade search automatically obeys Taunt.
  const attacks = acts.filter(a => a.type === 'attack');
  if (attacks.length > 0) {
    let best: Action | undefined;
    let bestScore = -Infinity;
    for (const a of attacks) {
      if (a.type !== 'attack' || a.target === 'hero') continue;
      const atk = me.board.find(m => m.uid === a.attackerUid);
      const tgt = foe.board.find(m => m.uid === a.target);
      if (atk === undefined || tgt === undefined) continue;
      if (tgt.health > atk.attack) continue; // can't kill it
      const survives = atk.health > tgt.attack;
      const evenTrade = atk.health <= tgt.attack; // both die
      if (!survives && !evenTrade) continue;
      const score = tgt.attack * 100 + tgt.health + (survives ? 1000 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (best !== undefined) return best;

    let face: Action | undefined;
    let topAtk = -1;
    for (const a of attacks) {
      if (a.type !== 'attack' || a.target !== 'hero') continue;
      const atk = me.board.find(m => m.uid === a.attackerUid);
      if (atk !== undefined && atk.attack > topAtk) {
        topAtk = atk.attack;
        face = a;
      }
    }
    if (face !== undefined) return face;
  }

  // 4. Hero power when there is nothing left to play. Use the comeback-
  //    discounted cost so we don't attempt a power we can't afford, and
  //    never waste Builder's heal at full treasury / Degen burn on a
  //    suicidal treasury.
  const hp = acts.find(a => a.type === 'hero-power');
  if (hp !== undefined) {
    const power = HEROES[me.heroId]?.power;
    const suicidal = power === 'draw-burn' && me.treasury <= 2;
    const wastedHeal = power === 'heal-treasury' && me.treasury >= 30;
    if (!suicidal && !wastedHeal) return hp;
    // package 4A: if the discounted cost makes the power affordable
    // while the base 2-gas cost blocked it earlier, legalActions
    // already includes it — nothing to do here.
    void effectivePowerCost(state, state.turn);
  }

  // 5. Stake a minion that can no longer attack this turn (already
  //    attacked or summoning-sick; cheapest damage loss first):
  //    +1 gas each at turn start. Never unstake.
  const stakes = acts.filter(a => a.type === 'stake');
  let stakePick: Action | undefined;
  let lowestAtk = Infinity;
  for (const a of stakes) {
    if (a.type !== 'stake') continue;
    const m = me.board.find(mm => mm.uid === a.uid);
    if (m === undefined || m.canAttack) continue;
    if (m.attack < lowestAtk) {
      lowestAtk = m.attack;
      stakePick = a;
    }
  }
  if (stakePick !== undefined) return stakePick;

  return endTurn;
}
