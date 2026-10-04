'use client';
import { useEffect, useState } from 'react';
import type { Minion } from '../lib/engine/types';
import { useLocale } from './LocaleContext';

type Target = { uid: string; health: number; attack: number };
type Point = { x: number; y: number };
type Geometry = { start: Point; targets: (Target & Point)[] };

export default function AttackAim({ attacker, targets }: { attacker: Minion | undefined; targets: Target[] }) {
  const { t } = useLocale();
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const targetKey = targets.map(v => `${v.uid}:${v.health}:${v.attack}`).join('|');
  useEffect(() => {
    if (!attacker) { setGeometry(null); return; }
    const locate = (uid: string) => document.querySelector<HTMLElement>(uid === 'hero' ? '#foe-treasury-target' : `[data-minion-uid="${uid}"]`);
    const point = (el: HTMLElement): Point => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    function measure() {
      const from = locate(attacker!.uid); if (!from) { setGeometry(null); return; }
      setGeometry({ start: point(from), targets: targets.flatMap(target => { const el = locate(target.uid); if (!el) return []; const r = el.getBoundingClientRect(); if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return []; return [{ ...target, ...point(el) }]; }) });
    }
    const move = (e: PointerEvent) => { const el = (e.target as HTMLElement).closest?.('[data-minion-uid], #foe-treasury-target'); const uid = el?.id === 'foe-treasury-target' ? 'hero' : (el as HTMLElement | null)?.dataset.minionUid; setHover(uid && targets.some(v => v.uid === uid) ? uid : null); };
    measure(); const observer = new ResizeObserver(measure); const board = document.querySelector('.battlefield'); if (board) observer.observe(board);
    window.addEventListener('resize', measure); document.addEventListener('scroll', measure, true); document.addEventListener('pointermove', move);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); document.removeEventListener('scroll', measure, true); document.removeEventListener('pointermove', move); };
  // Target values are encoded above; avoid remeasuring on unrelated UI renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attacker?.uid, targetKey]);
  if (!attacker || !geometry || !geometry.targets.length) return null;
  const destination = geometry.targets.find(v => v.uid === hover) ?? geometry.targets[0];
  const { start } = geometry;
  const bend = Math.max(40, Math.abs(start.y - destination.y) * .4);
  return <div className="attack-aim" aria-hidden>
    <svg width="100%" height="100%"><defs><marker id="attack-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 L4 6 Z" fill="#f8d478" /></marker></defs>
      <path d={`M${start.x},${start.y - 12} C${start.x},${start.y - bend} ${destination.x},${destination.y + bend} ${destination.x},${destination.y + 12}`} fill="none" stroke="#f8d478" strokeWidth="3" markerEnd="url(#attack-arrow)" />
    </svg>
    {geometry.targets.map(target => <span key={target.uid} className={`damage-preview ${attacker.attack >= target.health ? 'lethal' : ''}`} style={{ left: target.x, top: target.y - 30 }}>
      −{attacker.attack}{attacker.attack >= target.health && ' ☠'}{target.attack > 0 && <small>{t('ответ', 'return')} −{target.attack}</small>}
    </span>)}
  </div>;
}
