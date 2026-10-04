'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { Minion } from '../lib/engine/types';
import type { UiFloat } from './battleFx';
import { MinionToken } from './CardView';

export type CombatFlight = { minion: Minion; survives: boolean; from: DOMRect; to: DOMRect };

/** One visible token; the board counterpart stays hidden until return. */
export default function AttackFlight({ flight, currentMinion, floats, onContact, onComplete }: {
  flight: CombatFlight | null;
  currentMinion?: Minion;
  floats: UiFloat[];
  onContact: () => void;
  onComplete: () => void;
}) {
  const sprite = useRef<HTMLDivElement>(null);
  const [contact, setContact] = useState(false);
  useEffect(() => {
    const element = sprite.current;
    if (!flight || !element) return;
    let cancelled = false;
    const animations: Animation[] = [];
    setContact(false);
    const dx = flight.to.left + flight.to.width / 2 - flight.from.left - flight.from.width / 2;
    const dy = flight.to.top + flight.to.height / 2 - flight.from.top - flight.from.height / 2;
    const distance = Math.hypot(dx, dy) || 1;
    const contactOffset = Math.min(28, distance * .2);
    const contactX = dx - dx / distance * contactOffset;
    const contactY = dy - dy / distance * contactOffset;
    const windup = `translate(${-dx / distance * 14}px, ${-dy / distance * 14}px) scale(.96)`;
    const hit = `translate(${contactX}px, ${contactY}px) scale(1.08)`;
    const animate = async (frames: Keyframe[], duration: number, easing: string) => {
      const animation = element.animate(frames, { duration, easing, fill: 'forwards' });
      animations.push(animation);
      await animation.finished;
    };
    void (async () => {
      try {
        await animate([{ transform: 'translate(0,0)' }, { transform: windup }], 110, 'ease-out');
        if (cancelled) return;
        await animate([{ transform: windup }, { transform: hit }], 157, 'cubic-bezier(.55,0,1,.45)');
        if (cancelled) return;
        // No parallel timer: this callback runs only once the flight reaches its target.
        flushSync(() => { setContact(true); onContact(); });
        if (flight.survives) {
          await animate([{ transform: hit }, { transform: hit }], 60, 'linear');
          if (cancelled) return;
          await animate([{ transform: hit }, { transform: 'translate(0,0) scale(1)' }], 200, 'cubic-bezier(.2,.8,.2,1)');
        } else {
          await animate([{ transform: hit, opacity: 1 }, { transform: `translate(${contactX}px, ${contactY}px) scale(.78)`, opacity: 0 }], 180, 'ease-out');
        }
        if (!cancelled) onComplete();
      } catch {
        // Cancellation on reset/unmount must never commit an old combat result.
        if (!cancelled) { onContact(); onComplete(); }
      }
    })();
    return () => { cancelled = true; animations.forEach(animation => animation.cancel()); };
  }, [flight, onContact, onComplete]);
  if (!flight || typeof document === 'undefined') return null;
  return createPortal(<>
    <div ref={sprite} aria-hidden className="combat-flight" style={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height }}>
      <MinionToken minion={contact ? currentMinion ?? { ...flight.minion, health: 0, canAttack: false } : flight.minion} floats={contact ? floats : []} visualOnly />
    </div>
    {contact && <div className="combat-contact" aria-hidden style={{ left: flight.to.left + flight.to.width / 2, top: flight.to.top + flight.to.height / 2 }} />}
  </>, document.body);
}
