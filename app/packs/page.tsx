'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CARDS } from '../../lib/cards';
import type { CardDef, Rarity } from '../../lib/engine/types';
import CardView, { CardBack, RARITY_COLORS } from '../../components/CardView';
import WalletBar from '../../components/WalletBar';

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

  const handleOpen = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPack(openPack());
    setRevealed(0);
    setOpened(true);
    timerRef.current = setInterval(() => {
      setRevealed(r => {
        if (r >= 5) {
          if (timerRef.current) clearInterval(timerRef.current);
          return r;
        }
        return r + 1;
      });
    }, 450);
  };

  return (
    <div className="min-h-screen bg-abyss text-parchment">
      <WalletBar />

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
