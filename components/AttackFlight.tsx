'use client';
import { useEffect, useState } from 'react';
import type { BattleEvents } from '../lib/events';
export type CombatFlight = { uid: string; cardId: string; from: DOMRect; to: DOMRect };
/** The fixed sprite can cross both scrollable ranks without being clipped. */
export default function AttackFlight({ flight, events, reduced }: { flight: CombatFlight | null; events: BattleEvents | null; reduced: boolean }) {
  const [shown, setShown] = useState<(CombatFlight & { key: number }) | null>(null);
  useEffect(() => {
    if (!flight || !events?.attack || events.attack.attackerUid !== flight.uid || reduced) { setShown(null); return; }
    setShown({ ...flight, key: Date.now() });
    const timer = setTimeout(() => setShown(null), 650);
    return () => clearTimeout(timer);
  }, [flight, events, reduced]);
  if (!shown) return null;
  return <div aria-hidden className="combat-flight" style={{
    left: shown.from.left, top: shown.from.top, width: shown.from.width, height: shown.from.height,
    ['--combat-dx' as string]: `${(shown.to.left + shown.to.width / 2 - shown.from.left - shown.from.width / 2) * .9}px`,
    ['--combat-dy' as string]: `${(shown.to.top + shown.to.height / 2 - shown.from.top - shown.from.height / 2) * .9}px`,
  }} key={shown.key}><img src={`/cards/${shown.cardId}.webp`} alt="" /></div>;
}
