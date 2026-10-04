'use client';

/**
 * IMPERIVM — motion effects overlay.
 *
 * Renders a portal-free absolute layer above the board for short-lived
 * visual effects: card play-flight (with landing dust), halving +1/+1
 * floating numbers, RUG PULL vortex + screen shake, VICTORIA coin
 * confetti + laurels, RUGGED crack.
 *
 * Effects are driven by the structured BattleEvents payload (see
 * lib/events.ts). prefers-reduced-motion is respected at this layer.
 *
 * Cleanup: every effect removes itself via internal timers.
 * On unmount we sweep everything.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from './LocaleContext';
import { prefersReducedMotion } from '../lib/prefersReducedMotion';
import type { BattleEvents } from '../lib/events';

interface MotionFxProps {
  events: BattleEvents | null;
  /** Rects for the source (hand) and target (board slot) for card play-flight. */
  playRects?: { from: DOMRect; to: DOMRect } | null;
  /** Reduced-motion flag; if undefined we read from the live media query. */
  reduced?: boolean;
}

interface FlightSprite {
  key: number;
  cardId: string;
  from: DOMRect;
  to: DOMRect;
}

interface HalvingSprite {
  key: number;
  uid: string;
  delta: string;
  rect: DOMRect;
}

export default function MotionFx({ events, playRects, reduced: reducedProp }: MotionFxProps) {
  const { t } = useLocale();
  const reduced = reducedProp ?? prefersReducedMotion();
  const [flights, setFlights] = useState<FlightSprite[]>([]);
  const [halvings, setHalvings] = useState<HalvingSprite[]>([]);
  const [rugKey, setRugKey] = useState(0);
  const [endgame, setEndgame] = useState<
    | { key: number; perspective: 'me' | 'foe' | 'draw'; winner: 0 | 1 | 'draw' }
    | null
  >(null);

  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  function schedule(callback: () => void, delay: number) {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
    return timer;
  }
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  // Card play-flight.
  useEffect(() => {
    if (!events?.play || reduced) return;
    if (!playRects) return;
    const sprite: FlightSprite = {
      key: Date.now() + Math.random(),
      cardId: events.play.cardId,
      from: playRects.from,
      to: playRects.to,
    };
    setFlights(curr => [...curr, sprite]);
    schedule(() => {
      setFlights(curr => curr.filter(f => f.key !== sprite.key));
    }, 900);
  }, [events?.play, playRects, reduced]);

  // Halving +1/+1 numbers — one per fresh log line, paired by uid.
  useEffect(() => {
    if (!events?.halvings || events.halvings.length === 0 || reduced) return;
    const next: HalvingSprite[] = [];
    for (const m of events.halvings) {
      const node = document.querySelector<HTMLElement>(`[data-minion-uid="${m.uid}"]`);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      next.push({
        key: Date.now() + Math.random() + Math.random(),
        uid: m.uid,
        delta: '+1/+1',
        rect,
      });
    }
    if (next.length === 0) return;
    setHalvings(curr => [...curr, ...next]);
    schedule(() => {
      const keys = new Set(next.map(n => n.key));
      setHalvings(curr => curr.filter(h => !keys.has(h.key)));
    }, 1300);
  }, [events?.halvings, reduced]);

  // RUG PULL — vortex + screen shake key (body class is applied by page).
  useEffect(() => {
    if (!events?.rugPull) return;
    setRugKey(k => k + 1);
    const t = setTimeout(() => setRugKey(0), 950);
    return () => clearTimeout(t);
  }, [events?.rugPull]);

  // End-game: VICTORIA / RUGGED / STALEMATE — driven by perspective.
  useEffect(() => {
    if (!events?.gameOver) return;
    setEndgame({
      key: Date.now() + Math.random(),
      perspective: events.gameOver.perspective,
      winner: events.gameOver.winner,
    });
    const t = setTimeout(() => setEndgame(null), 6500);
    return () => clearTimeout(t);
  }, [events?.gameOver]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[40]">
      {/* Card play-flight sprites */}
      {flights.map(s => (
        <div
          key={s.key}
          className="play-flight absolute"
          style={
            reduced
              ? { left: s.to.left, top: s.to.top, width: s.to.width, height: s.to.height }
              : ({
                  ['--from-x' as string]: `${s.from.left + s.from.width / 2}px`,
                  ['--from-y' as string]: `${s.from.top + s.from.height / 2}px`,
                  ['--to-x' as string]: `${s.to.left + s.to.width / 2}px`,
                  ['--to-y' as string]: `${s.to.top + s.to.height / 2}px`,
                  width: Math.min(s.from.width, s.to.width),
                  height: Math.min(s.from.height, s.to.height),
                } as React.CSSProperties)
          }
        >
          <img
            src={`/cards/${s.cardId}.webp`}
            alt=""
            className="w-full h-full object-cover rounded-lg border border-gold/40 shadow-[0_8px_22px_rgba(0,0,0,0.6)]"
            draggable={false}
          />
          {!reduced && (
            <span
              className="landing-dust"
              style={
                {
                  ['--dust-x' as string]: `${s.to.left + s.to.width / 2}px`,
                  ['--dust-y' as string]: `${s.to.top + s.to.height}px`,
                } as React.CSSProperties
              }
            />
          )}
        </div>
      ))}

      {/* Halving +1/+1 numbers */}
      {halvings.map(h => (
        <span
          key={h.key}
          className="halving-pop fixed font-display font-bold text-gold-light text-lg md:text-xl"
          style={{ left: h.rect.left + h.rect.width / 2, top: h.rect.top + h.rect.height / 2 }}
        >
          {h.delta}
        </span>
      ))}

      {/* RUG PULL — screen-wide red vortex (body shake applied in page.tsx) */}
      {rugKey > 0 && (
        <div key={rugKey} className="rug-vortex absolute inset-0" aria-hidden />
      )}

      {/* End-game screen — VICTORIA / RUGGED / STALEMATE */}
      {endgame && (
        <div
          key={endgame.key}
          className={`endgame absolute inset-0 flex flex-col items-center justify-center ${
            endgame.perspective === 'draw'
              ? 'endgame-draw'
              : endgame.perspective === 'me'
                ? 'endgame-win'
                : 'endgame-loss'
          }`}
        >
          <div className="laurel-shimmer text-center font-display">
            <div className="text-5xl md:text-7xl font-bold tracking-[0.2em]">
              {endgame.perspective === 'draw'
                ? t('НИЧЬЯ', 'STALEMATE')
                : endgame.perspective === 'me'
                  ? t('ПОБЕДА', 'VICTORIA')
                  : t('РАГПУЛ', 'RUGGED')}
            </div>
            <div className="mt-2 text-base md:text-xl italic text-parchment/80">
              {endgame.perspective === 'draw'
                ? t('Обе казны пали. Сеть помнит.', 'Both treasuries fell. The chain remembers.')
                : endgame.perspective === 'me'
                  ? 'Veni. Vidi. Rugi.'
                  : t('Рынок вынес свой приговор.', 'The market has spoken.')}
            </div>
          </div>
          {endgame.perspective === 'me' && !reduced && <ConfettiRain />}
          {endgame.perspective !== 'me' && <div className="rugged-crack mt-8" />}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Confetti ─────────────────────────── */

interface Coin {
  key: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function ConfettiRain(): JSX.Element {
  const coins = useMemo<Coin[]>(() => Array.from({ length: 48 }, (_, key) => ({
    key, left: Math.random() * 100, delay: Math.random() * 0.6,
    duration: 1.8 + Math.random() * 1.6, size: 6 + Math.random() * 8,
  })), []);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {coins.map(c => (
        <span
          key={c.key}
          className="coin-confetti absolute"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
