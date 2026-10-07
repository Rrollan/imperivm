/**
 * IMPERIVM — sound design from structured game events.
 *
 * Same event adapter that drives the visual FX (lib/events.ts →
 * BattleEvents) also drives the audio. Sounds play exactly once per
 * logical action, never twice from React strict-effects or log replay.
 *
 * Reduced motion does NOT imply mute — independent settings.
 *
 * WIN/LOSE PERSPECTIVE: sounds are emitted from the perspective of the
 * player whose UI we are rendering (ME = 0). A `gameOver.perspective` of
 * 'me' plays the triumph cue; 'foe' plays the defeat cue; 'draw' plays
 * the stalemate cue. We do NOT key on `events.winner` directly — that
 * would fire victory for both sides.
 */
import { play } from './sfx';
import type { SfxName } from './sfx';
import type { BattleEvents } from '../events';
import type { Action, GameState } from '../engine/types';
import { CARDS } from '../cards';
import {combatStyle} from '../../components/presentation/combatStyle';

type SoundContext = { action: Action; before: GameState; after: GameState };

const LS_AMB = 'imperivm.audio.ambient';
let ambientStarted = false;

export function shouldStartAmbient(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LS_AMB) !== '0';
  } catch {
    return false;
  }
}

export function markAmbientStarted(v: boolean): void {
  ambientStarted = v;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_AMB, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isAmbientStarted(): boolean {
  return ambientStarted;
}

/** One cue of each kind per contact, even when an edict hits seven fighters. */
export function soundsForEvents(events: BattleEvents, context?: SoundContext): SfxName[] {
  const sounds = new Set<SfxName>();
  const add = (name: SfxName) => sounds.add(name);
  if (context) {
    if (context.action.type === 'end-turn') add('end-turn');
    if (context.action.type === 'stake') add('stake');
    if (context.action.type === 'unstake') add('unstake');
    if (context.action.type === 'hero-power') add('ui-click');
    if (context.action.type === 'mulligan') add(context.action.uids.length?'card-reveal':'ui-click');
    for (const owner of [0, 1] as const) {
      const before = context.before.players[owner].treasury;
      const after = context.after.players[owner].treasury;
      if (after > before) add('heal');
      if (after < before && !events.attack) add('damage');
    }
  }
  // Plays (cards entering our board)
  if (events.play || events.spellImmediate) add('play');

  // Mempool lifecycle
  if (events.spellQueued) add('mempool-queue');
  if (events.spellResolved && events.spellResolved.length > 0) {
    add('mempool-resolve');
    // Each spell has a distinct sound; for the cast spells we have
    // today, fall back to one cue per resolution (avoid stacking).
  }
  if (events.spellCountered) add('priority');

  // Halving pulse + rug pull
  if (events.halvings && events.halvings.length > 0) add('halving');
  if (events.rugPull) add('rug-pull');

  // Combat: attack lunge + per-minion damage/heal floats
  if (events.attack) {
    const attacker=context?.before.players.flatMap(p=>p.board).find(m=>m.uid===events.attack?.attackerUid);
    add(combatStyle(attacker?.cardId).sound);
  }
  const covered = new Set<string>();
  for (const result of events.effectResults ?? []) {
    for (const target of result.targets) {
      covered.add(target.uid);
      if ((result.kind === 'heal-own-minions' || result.kind === 'heal-treasury') && target.healthAfter > target.healthBefore) add('heal');
      if (result.kind.startsWith('damage-') && target.healthAfter < target.healthBefore) add('damage');
    }
  }
  if (events.damages) {
    for (const d of events.damages) {
      if (covered.has(d.uid) || events.halvings?.some(h => h.uid === d.uid)) continue;
      if (d.health > d.prevHealth && CARDS[events.play?.cardId ?? '']?.battlecry?.kind !== 'buff-own') add('heal');
      else if (d.health < d.prevHealth && !events.attack) add('damage');
    }
  }
  if (events.deaths && events.deaths.length > 0) add('death');

  // End-game: perspective-aware. 'me' = triumph, 'foe' = defeat,
  // 'draw' = stalemate.
  if (events.gameOver) {
    if (events.gameOver.perspective === 'me') add('victory');
    else add('rugged'); // draw reuses the defeat cue
  }
  return Array.from(sounds);
}

/** Called once at the visual contact point of the action. */
export function emitSfxFromEvents(events: BattleEvents, context?: SoundContext): void {
  soundsForEvents(events, context).forEach(name => play(name));
}
