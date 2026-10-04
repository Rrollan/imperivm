'use client';
import { useEffect, useRef, useState } from 'react';
import type { BattleEvents } from '../lib/events';
import type { UiFloat } from './battleFx';

type Burst = { key: string; kind: string; x: number; y: number };
const SPELL_STYLE: Record<string, string> = {
  'rug-pull': 'lightning', 'priority-fee': 'gas', 'flash-loan': 'draw',
  'trait-reroll': 'ribbons', 'reveal-ceremony': 'reveal', 'solar-sapper': 'solar', audit: 'audit',
};

/** Resolves are events, never inferred from queued art. Healing uses actual HP deltas. */
export default function AbilityFx({ events, floats, reduced }: { events: BattleEvents | null; floats: UiFloat[]; reduced: boolean }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seen = useRef(new Set<string>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  useEffect(() => {
    if (reduced) { setBursts([]); return; }
    const fresh: Burst[] = [];
    const point = (selector: string) => { const el = document.querySelector(selector); if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    for (const spell of events?.spellResolved ?? []) {
      if (spell.fizzled) continue;
      const key = `spell-${spell.mempoolUid}`;
      if (seen.current.has(key)) continue; seen.current.add(key);
      const kind = SPELL_STYLE[spell.cardId]; if (!kind) continue;
      const targetOwn = ['audit', 'trait-reroll', 'priority-fee', 'flash-loan'].includes(spell.cardId);
      const own = targetOwn ? spell.owner === 0 : spell.owner !== 0;
      const target = kind === 'gas' ? '.gas-meter' : kind === 'draw' ? '.hand-zone' : own ? '.own-rank' : '.enemy-rank';
      fresh.push({ key: `${key}-${sequence.current++}`, kind, ...point(target) });
    }
    for (const value of floats) {
      if (value.kind !== 'heal') continue;
      const key = `heal-${value.key}`; if (seen.current.has(key)) continue; seen.current.add(key);
      const selector = value.targetUid.startsWith('hero-') ? value.targetUid === 'hero-0' ? '.combatant.own' : '.combatant.rival' : `[data-minion-uid="${value.targetUid}"]`;
      fresh.push({ key, kind: 'heal', ...point(selector) });
    }
    if (!fresh.length) return;
    // The bounded set is only a visual deduper, unrelated to engine history.
    if (seen.current.size > 250) seen.current = new Set(fresh.map(b => b.key));
    setBursts(old => [...old, ...fresh]);
    const timer = setTimeout(() => { timers.current.delete(timer); const keys = new Set(fresh.map(b => b.key)); setBursts(old => old.filter(b => !keys.has(b.key))); }, 1150);
    timers.current.add(timer);
  }, [events, floats, reduced]);
  return <div className="ability-layer" aria-hidden>{bursts.map(burst => <div key={burst.key} className={`ability-burst ability-${burst.kind}`} style={{ left: burst.x, top: burst.y }}>
    {burst.kind === 'lightning' ? <svg viewBox="0 0 400 260"><path d="M30 0 L170 110 L105 110 L250 260 L210 150 L290 150 L375 40" /><path d="M350 0 L260 75 L315 75 L135 240" /></svg>
      : burst.kind === 'draw' ? <>{[0, 1, 2].map(i => <img key={i} src="/cards/card-back.webp" alt="" style={{ animationDelay: `${i * 90}ms` }} />)}</>
      : burst.kind === 'gas' ? <>{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ left: `${20 + i * 30}px`, animationDelay: `${i * 70}ms` }} />)}</>
      : burst.kind === 'audit' ? <><span className="audit-seal">✓</span><i /><i /></>
      : burst.kind === 'solar' ? <><span /><span /><i /></>
      : burst.kind === 'ribbons' ? <><i /><i /><i /></>
      : burst.kind === 'reveal' ? <svg viewBox="0 0 240 240">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M120 118 L113 20 L128 20 Z" transform={`rotate(${i * 30} 120 120)`} />)}</svg>
      : <><i /><i /><i /></>}
  </div>)}</div>;
}
