import { useEffect, useState } from 'react';

const ANIMATION_KEY = 'imperivm.animations';
const ANIMATION_EVENT = 'imperivm:animations';
let sessionAnimationPreference: boolean | null = null;
function syncMotionAttribute() { if (typeof document !== 'undefined') document.documentElement.dataset.imperivmMotion = prefersReducedMotion() ? 'off' : 'on'; }
/** Motion is independent of both sound preferences. */
export function animationsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  if (sessionAnimationPreference !== null) return sessionAnimationPreference;
  try { return localStorage.getItem(ANIMATION_KEY) !== 'false'; } catch { return true; }
}
export function setAnimationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  sessionAnimationPreference = enabled;
  try { localStorage.setItem(ANIMATION_KEY, String(enabled)); } catch {}
  syncMotionAttribute();
  window.dispatchEvent(new CustomEvent(ANIMATION_EVENT, { detail: enabled }));
}
/** Honor the operating system preference as well as the arena setting. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return !animationsEnabled() || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
export function useAnimationPreference() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const sync = () => { setEnabled(animationsEnabled()); syncMotionAttribute(); };
    const storageSync = () => { sessionAnimationPreference = null; sync(); };
    const changed = (event: Event) => setEnabled((event as CustomEvent<boolean>).detail);
    sync(); window.addEventListener('storage', storageSync); window.addEventListener(ANIMATION_EVENT, changed);
    return () => { window.removeEventListener('storage', storageSync); window.removeEventListener(ANIMATION_EVENT, changed); };
  }, []);
  return [enabled, setAnimationsEnabled] as const;
}
/** SSR safe and subscribed to device and persisted app preference changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(prefersReducedMotion()); syncMotionAttribute(); };
    const storageUpdate = () => { sessionAnimationPreference = null; update(); };
    update();
    if (typeof mq?.addEventListener === 'function') mq.addEventListener('change', update);
    else mq?.addListener(update);
    window.addEventListener('storage', storageUpdate); window.addEventListener(ANIMATION_EVENT, update);
    return () => {
      if (typeof mq?.removeEventListener === 'function') mq.removeEventListener('change', update);
      else mq?.removeListener(update);
      window.removeEventListener('storage', storageUpdate); window.removeEventListener(ANIMATION_EVENT, update);
    };
  }, []);
  return reduced;
}
