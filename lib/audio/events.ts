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
import type { BattleEvents } from '../events';

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

/** Map a single BattleEvents payload to SFX. Best-effort, dedupe-safe. */
export function emitSfxFromEvents(events: BattleEvents): void {
  // Plays (cards entering our board)
  if (events.play) play('play');

  // Mempool lifecycle
  if (events.spellQueued) play('mempool-queue');
  if (events.spellResolved && events.spellResolved.length > 0) {
    play('mempool-resolve');
    // Each spell has a distinct sound; for the cast spells we have
    // today, fall back to one cue per resolution (avoid stacking).
  }
  if (events.spellCountered) play('priority');

  // Halving pulse + rug pull
  if (events.halvings && events.halvings.length > 0) play('halving');
  if (events.rugPull) play('rug-pull');

  // Combat: attack lunge + per-minion damage/heal floats
  if (events.attack) play('attack');
  if (events.damages) {
    for (const d of events.damages) {
      if (events.halvings?.some(h => h.uid === d.uid)) continue;
      if (d.health > d.prevHealth) play('heal');
      else play('damage');
    }
  }
  if (events.deaths && events.deaths.length > 0) play('death');

  // End-game: perspective-aware. 'me' = triumph, 'foe' = defeat,
  // 'draw' = stalemate.
  if (events.gameOver) {
    if (events.gameOver.perspective === 'me') play('victory');
    else if (events.gameOver.perspective === 'foe') play('rugged');
    else play('rugged'); // draw reuses rugged cue for the cliff-drop tone
  }
}
