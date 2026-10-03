'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CARDS } from '../../lib/cards';
import type { CardDef, Rarity } from '../../lib/engine/types';
import CardView, { CardBack, RARITY_COLORS } from '../../components/CardView';
import WalletBar from '../../components/WalletBar';
import MuteButton from '../../components/MuteButton';
import { play } from '../../lib/audio/sfx';
import { markAmbientStarted, shouldStartAmbient } from '../../lib/audio/events';
import { startAmbient } from '../../lib/audio/sfx';
import { unlockAudio } from '../../lib/audio/manager';

const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common', weight: 60 },
  { rarity: 'rare', weight: 25 },
  { rarity: 'epic', weight: 11 },
  { rarity: 'legendary', weight: 4 },
];

function rollRarity(): Rarity {
  const total = RARITY_WEIGHTS.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of RARITY_WEIGHTS) {
    roll -= r.weight;
    if (roll < 0) return r.rarity;
  }
  return 'common';
}

function openPack(): CardDef[] {
  const all = Object.values(CARDS);
  return Array.from({ length: 5 }, () => {
    const rarity = rollRarity();
    const pool = all.filter(c => c.rarity === rarity);
    const src = pool.length > 0 ? pool : all;
    return src[Math.floor(Math.random() * src.length)];
  });
}

export default function PacksPage() {
  const [pack, setPack] = useState<CardDef[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [opened, setOpened] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  // Lazy-start ambient on first gesture.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldStartAmbient()) return;
    const handler = () => {
      startAmbient();
      markAmbientStarted(true);
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const handleOpen = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Unlock audio context inside the user gesture.
    await unlockAudio();
    setPack(openPack());
    setRevealed(0);
    setOpened(true);
    play('pack-open');
    let step = 0;
    timerRef.current = setInterval(() => {
      step += 1;
      if (step >= 5) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRevealed(5);
        return;
      }
      setRevealed(step);
      play('card-reveal');
    }, 450);
  };

  return (
    <div className="min-h-screen bg-abyss text-parchment">
      <WalletBar />
      <div className="absolute right-4 top-3 z-30">
        <MuteButton />
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12 text-center">
        <h1 className="font-display text-5xl font-bold gold-text tracking-widest">PACKS</h1>
        <p className="mt-3 text-lavender italic font-display text-lg">
          Five cards. Weighted by rarity. The chain decides.
        </p>

        <div className="mt-6 flex justify-center gap-4 text-xs">
          {RARITY_WEIGHTS.map(r => (
            <span key={r.rarity} className="flex items-center gap-1.5 text-parchment/70">
              <span
                className="inline-block w-2.5 h-2.5 rotate-45"
                style={{ background: RARITY_COLORS[r.rarity] }}
              />
              {r.rarity} · {r.weight}%
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4 min-h-[14rem]">
          {opened
            ? pack.map((card, i) =>
                i < revealed ? (
                  <div key={`${card.id}-${i}`} className="flip-in">
                    <CardView card={card} size="md" />
                  </div>
                ) : (
                  <div key={`back-${i}`}>
                    <CardBack />
                  </div>
                ),
              )
            : (
              <div className="flex flex-col items-center gap-4 py-8">
                <CardBack />
                <p className="text-lavender/60 text-sm italic">The pack awaits your command, Imperator.</p>
              </div>
            )}
        </div>

        <div className="mt-8">
          <button
            onClick={handleOpen}
            className="px-10 py-3.5 rounded-lg bg-gradient-to-b from-gold-light to-gold-dark text-abyss font-bold text-lg tracking-wide hover:brightness-110 transition shadow-[0_0_24px_rgba(212,175,55,0.35)]"
          >
            {opened ? '✦ Open another' : '✦ Open pack'}
          </button>
        </div>

        <p className="mt-6 text-xs text-lavender/60">Mock — no real minting in demo.</p>

        <div className="mt-4">
          <Link href="/" className="text-sm text-lavender/70 hover:text-lavender">
            ← Back to the forum
          </Link>
        </div>
      </main>
    </div>
  );
}
