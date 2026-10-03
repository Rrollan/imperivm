'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { HEROES } from '../lib/heroes';
import WalletBar from '../components/WalletBar';
import ArtImg from '../components/ArtImg';
import MuteButton from '../components/MuteButton';
import { markAmbientStarted, shouldStartAmbient } from '../lib/audio/events';
import { startAmbient } from '../lib/audio/sfx';

const HOW_TO_PLAY = [
  'Spend gas to play minions and cast spells. Gas refills every block — stake minions to earn even more.',
  'Spells enter the public mempool and resolve at the start of YOUR next turn. Your rival sees them coming — frontrun or be frontrun.',
  'Attack the enemy treasury to win. Unstaked minions strike; staked minions mine gas instead.',
  'Beware the halving, watch the mempool… and never trust a RUG PULL.',
];

export default function LandingPage() {
  const heroes = Object.values(HEROES);

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

  return (
    <div className="min-h-screen bg-abyss text-parchment">
      <WalletBar />
      <div className="absolute right-4 top-3 z-30">
        <MuteButton />
      </div>

      <main className="max-w-5xl mx-auto px-6 pb-16">
        {/* Hero */}
        <section className="text-center pt-14 pb-10">
          <h1 className="font-display text-5xl sm:text-6xl md:text-8xl font-bold tracking-[0.12em] gold-text">
            IMPERIVM
          </h1>
          <p className="mt-4 font-display italic text-2xl text-lavender">«Veni. Vidi. Rugi.»</p>
          <p className="mt-5 max-w-2xl mx-auto text-parchment/80 leading-relaxed">
            A Hearthstone-style card battler where blockchain mechanics <em>are</em> the gameplay —
            mempools, gas, staking, halvings, and the dreaded RUG PULL. Built for the Crypto
            World&apos;s Fair Hackathon.
          </p>
        </section>

        {/* How to play */}
        <section className="mt-6 rounded-2xl border border-gold/25 bg-void/60 p-6 md:p-8">
          <h2 className="font-display text-2xl gold-text font-bold mb-4">How to play</h2>
          <ul className="space-y-3 text-parchment/85">
            {HOW_TO_PLAY.map((tip, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-gold font-display font-bold shrink-0">{['I', 'II', 'III', 'IV'][i]}.</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Hero select */}
        <section className="mt-12">
          <h2 className="font-display text-2xl gold-text font-bold text-center mb-6">
            Choose your wallet-hero
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {heroes.map(hero => (
              <div
                key={hero.id}
                className="rise-in rounded-2xl border border-gold/25 bg-void/60 p-5 flex flex-col hover:border-gold/60 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all"
              >
                <div className="w-20 h-20 rounded-full border-[3px] border-gold overflow-hidden mx-auto shadow-[0_0_18px_rgba(212,175,55,0.35)] bg-abyss">
                  <ArtImg
                    src={`/heroes/${hero.id}.webp`}
                    alt={hero.name}
                    letter={hero.name.charAt(0)}
                    className="w-full h-full text-3xl"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-center">{hero.name}</h3>
                <p className="text-center text-lavender text-sm italic">{hero.title}</p>
                <div className="mt-4 text-sm flex-1">
                  <p className="text-gold-light font-semibold">
                    {hero.powerName} <span className="text-lavender font-normal">(2 gas)</span>
                  </p>
                  <p className="mt-1 text-parchment/70 text-[13px] leading-snug">{hero.powerText}</p>
                </div>
                <Link
                  href={`/game?hero=${hero.id}`}
                  className="mt-5 block text-center px-4 py-2.5 rounded-lg bg-gradient-to-b from-gold-light to-gold-dark text-abyss font-bold tracking-wide hover:brightness-110 transition"
                >
                  Play vs AI
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Packs */}
        <section className="mt-12 text-center">
          <Link
            href="/packs"
            className="inline-block px-8 py-3 rounded-lg border-2 border-gold/60 text-gold-light font-display text-lg tracking-wide hover:bg-gold/10 transition"
          >
            ✦ Open packs
          </Link>
          <p className="mt-3 text-xs text-lavender/70">Mock opening — no real minting in this demo.</p>
        </section>
      </main>
    </div>
  );
}
