import type { ReactNode } from 'react';

/**
 * IMPERIVM — single AudioContext + master gain + limiter.
 *
 * Owns: AudioContext lifecycle, mute persistence, gesture unlock, ambient
 * loop suspension on hidden tab. Audio is INDEPENDENT of reduced-motion:
 * the OS-level motion preference has no bearing on sound output.
 *
 * This file is the only place that touches the Web Audio API. Higher
 * layers (`sfx.ts`) ask for sounds by name and the engine routes them
 * through the manager.
 */

const LS_MUTE = 'imperivm.audio.muted';

type AudioCtor = typeof AudioContext;
type WindowLike = { webkitAudioContext?: AudioCtor } & Window;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let ambient: { stop: () => void; resume: () => void } | null = null;
/**
 * Mutable mute flag. Starts as `false` (audio on) until `initMute()`
 * is called once on client mount; that call reads localStorage and
 * MAY run before any AudioContext is created (e.g. when a child effect
 * races the first gesture handler).
 */
let muted = false;
/**
 * Tracks whether `initMute()` has run yet. Independent of AudioContext
 * creation — the two are intentionally orthogonal.
 */
let muteInitialized = false;
let listeners: ((muted: boolean) => void)[] = [];
let visibilityListenerAttached = false;

function readMute(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LS_MUTE) === '1';
  } catch {
    return false;
  }
}

function writeMute(v: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_MUTE, v ? '1' : '0');
  } catch {
    /* ignore quota / private-mode failures — the toggle still works in-memory */
  }
}

/** Returns the AudioContext, creating it lazily on first gesture. */
export function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // A gesture that reaches `getContext` before `MuteButton` mounts
  // would otherwise start with `muted=false` and ignore the persisted
  // preference. Re-read storage right here.
  if (!muteInitialized) initMute();
  if (ctx !== null) return ctx;
  const w = window as WindowLike;
  const Ctor: AudioCtor | undefined =
    (w as unknown as { AudioContext?: AudioCtor }).AudioContext ??
    w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    // Compressor acts as a limiter (brickwall-ish ceiling).
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    masterGain.connect(limiter);
    limiter.connect(ctx.destination);
    attachVisibilityOnce();
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

/** Must be called from a user-gesture handler (pointerdown / keydown). */
export async function unlockAudio(): Promise<void> {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      /* denied resume — we still serve SFX in-memory silently */
    }
  }
}

/** Public mute query. SSR-safe. */
export function isMuted(): boolean {
  return muted;
}

/** Subscribe to mute changes. Returns an unsubscribe. */
export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(x => x !== fn);
  };
}

/** Toggle mute and persist. SSR-safe; no-op before unlock. */
export function setMuted(v: boolean): void {
  muted = v;
  writeMute(v);
  if (masterGain) {
    const target = v ? 0 : 1;
    const now = ctx?.currentTime ?? 0;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(target, now + 0.05);
  }
  for (const fn of listeners) fn(v);
}

/**
 * Read the persisted mute preference into memory. MUST be callable
 * BEFORE any AudioContext is created — a child effect's render may
 * mount the mute UI before the first user gesture that triggers
 * `getContext()`. Calling this multiple times is harmless; the read
 * runs exactly once.
 */
export function initMute(): void {
  if (muteInitialized) return;
  muted = readMute();
  muteInitialized = true;
  // Apply the loaded value to an already-created gain, in case the
  // AudioContext was created in a previous session (HMR, SPA nav).
  if (masterGain) {
    masterGain.gain.cancelScheduledValues(ctx?.currentTime ?? 0);
    masterGain.gain.setValueAtTime(muted ? 0 : 1, ctx?.currentTime ?? 0);
  }
}

/** Internal — get the master gain. Returns null if no context. */
export function masterOut(): GainNode | null {
  if (!masterGain) {
    getContext();
  }
  return masterGain;
}

/** Internal — current AudioContext time, or 0 if none. */
export function now(): number {
  return ctx?.currentTime ?? 0;
}

/** Hidden-tab handling: suspend ambient, do not stop SFX mid-play. */
export function setAmbientController(c: { stop: () => void; resume: () => void } | null): void {
  ambient = c;
}

/**
 * Attach the document.visibilitychange listener once. On hide: stop the
 * ambient loop. On show: resume ONLY if the user is unmuted AND the
 * ambient controller has marked itself as "should be playing". This
 * has nothing to do with `prefers-reduced-motion` — audio and motion
 * are independent OS-level preferences.
 */
function attachVisibilityOnce(): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (!ambient) return;
    if (document.hidden) {
      ambient.stop();
    } else if (!muted) {
      ambient.resume();
    }
  });
}

