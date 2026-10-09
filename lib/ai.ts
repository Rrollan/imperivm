import {boardCapacity,MAX_BOARD_CAPACITY} from './engine/tactics';
import {retaliationDamage} from './engine/combat';
/**
 * IMPERIVM — greedy AI (lib/ai.ts).
 *
 * chooseAiAction() always returns an action from legalActions(state).
 * The UI calls it repeatedly until it returns { type: 'end-turn' }.
 * Fully deterministic for a given state (stable priority order, no RNG use).
 */

import { CARDS } from './cards';
import { HEROES } from './heroes';
import {isInstantSpell} from './engine/spellTiming';
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

  // Preserve an available lethal before spending gas or trading creatures.
  const faceAttacks = acts.filter((a): a is Extract<Action, { type: 'attack' }> => a.type === 'attack' && a.target === 'hero');
  const faceDamage = faceAttacks.reduce((sum, a) => sum + (me.board.find(m => m.uid === a.attackerUid)?.attack ?? 0), 0);
  if (faceDamage >= foe.treasury && faceAttacks.length) return faceAttacks.sort((a, b) => (me.board.find(m => m.uid === b.attackerUid)?.attack ?? 0) - (me.board.find(m => m.uid === a.attackerUid)?.attack ?? 0))[0];

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
    .filter(a => {
      if (a.type !== 'play-minion' && a.type !== 'cast-spell') return false;
      const card=cardOf(state,a.uid);
      if(card&&isInstantSpell(card)){
        switch(card.spell?.kind){
          case 'expand-board':return boardCapacity(me)<MAX_BOARD_CAPACITY&&me.board.length>=boardCapacity(me)-1;
          case 'heal-own-minions':return me.board.some(m=>m.health<m.maxHealth);
          case 'weaken-random-enemy':return foe.board.some(m=>m.attack>0);
          case 'buff-own':return me.board.length>0;
          case 'damage-all-enemy-minions':return foe.board.length>0;
          case 'draw':{
            const missing=Math.max(0,(card.spell.amount??1)-me.deck.length);
            const fatigueDamage=missing*(2*me.fatigue+missing+1)/2;
            return me.deck.length>0&&me.hand.length<10&&me.treasury>fatigueDamage;
          }
        }
      }
      if (card?.id !== 'rug-pull') return true;
      // A delayed reset should recover a losing board, not erase our winning army.
      const value = (board: typeof me.board) => board.reduce((sum, m) => sum + m.attack + m.health / 2, 0);
      return foe.board.length > 0 && (value(foe.board) > value(me.board) + 3 || foe.board.reduce((sum, m) => sum + (m.staked ? 0 : m.attack), 0) >= me.treasury);
    })
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
      const retaliation = retaliationDamage(tgt.attack);
      const survives = atk.health > retaliation;
      const evenTrade = atk.health <= retaliation; // both die
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
    // Legal face attacks are absent behind Taunt. Chip the guard instead of
    // waiting forever for a one-hit kill; legality also enforces Rush targets.
    const pressure = attacks.filter((a): a is Extract<Action, { type: 'attack' }> => a.type === 'attack' && a.target !== 'hero');
    pressure.sort((x, y) => {
      const score = (a: Extract<Action, { type: 'attack' }>) => {
        const attacker = me.board.find(m => m.uid === a.attackerUid), target = foe.board.find(m => m.uid === a.target);
        if (!attacker || !target) return -Infinity;
        const retaliation = retaliationDamage(target.attack);
        return Math.min(attacker.attack, target.health) * 10 - Math.min(attacker.health, retaliation) + (attacker.health > retaliation ? 20 : 0);
      };
      return score(y) - score(x);
    });
    if (pressure[0]) return pressure[0];
  }

  const reserve = acts.find(a => a.type === 'buy-card');
  if (reserve) return reserve;

  // 4. Hero power when there is nothing left to play. Use the comeback-
  //    discounted cost so we don't attempt a power we can't afford, and
  //    never waste Builder's heal at full treasury / Degen burn on a
  //    suicidal treasury.
  const hp = acts.find(a => a.type === 'hero-power');
  if (hp !== undefined) {
    const power = HEROES[me.heroId]?.power;
    const drawPower=power==='draw-burn'||power==='hermes-relay';
    const burn=power==='hermes-relay'?((me.factionPlaysThisTurn?.DePIN??0)>0?0:3):2;
    const suicidal = drawPower && me.treasury <= burn;
    const wastedHeal = power === 'heal-treasury' && me.treasury >= 30&&!me.board.some(m=>m.health<m.maxHealth);
    const wastedDraw = drawPower && (me.deck.length === 0 || me.hand.length >= 10);
    if (!suicidal && !wastedHeal && !wastedDraw) return hp;
    // package 4A: if the discounted cost makes the power affordable
    // while the base 2-gas cost blocked it earlier, legalActions
    // already includes it — nothing to do here.
    void effectivePowerCost(state, state.turn);
  }

  // 5. A single low-attack income unit can bridge an early expensive hand.
  // Release it once normal gas pays the curve. Never stake/unstake the same
  // minion in a loop: desired count is constant within the action sequence.
  const peakCost = Math.max(0, ...me.hand.map(h => CARDS[h.cardId].cost));
  const desiredStakes = me.maxGas < 8 && peakCost > Math.min(10, me.maxGas + 1) ? 1 : 0;
  const staked = me.board.filter(m => m.staked).length;
  if (staked > desiredStakes) {
    const release = acts.find(a => a.type === 'unstake');
    if (release) return release;
  }
  if (staked < desiredStakes) {
    const stakes = acts.filter((a): a is Extract<Action, { type: 'stake' }> => a.type === 'stake');
    const candidates = stakes.filter(a => { const m = me.board.find(m => m.uid === a.uid); return !!m && !m.canAttack && m.attack <= 1; });
    candidates.sort((a, b) => (me.board.find(m => m.uid === a.uid)?.attack ?? 0) - (me.board.find(m => m.uid === b.uid)?.attack ?? 0));
    if (candidates[0]) return candidates[0];
  }

  return endTurn;
}
