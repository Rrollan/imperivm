'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HEROES } from '../lib/heroes';
import { CARDS } from '../lib/cards';
import WalletBar from '../components/WalletBar';
import { startAmbient } from '../lib/audio/sfx';
import { markAmbientStarted, shouldStartAmbient } from '../lib/audio/events';

const STYLES: Record<string, string> = {
  whale: 'Control the market. Clear the board. Make the last move.',
  builder: 'Hold the line. Heal your Treasury. Build an army that lasts.',
  degen: 'Go wide. Strike early. Every draw is another chance.',
  validator: 'Grow your gas. Stake your ranks. Counter the coming storm.',
};
export default function LandingPage() {
  const [selected, select] = useState('whale'); const hero = HEROES[selected];
  useEffect(() => {
    if (!shouldStartAmbient()) return;
    const handler = () => { startAmbient(); markAmbientStarted(true); window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); };
    window.addEventListener('pointerdown', handler, { once: true }); window.addEventListener('keydown', handler, { once: true });
    return () => { window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); };
  }, []);
  return <div className="landing-shell"><WalletBar /><main className="landing-main">
    <section className="landing-hero">
      <div className="landing-copy"><p className="eyebrow">A ROMAN CARD BATTLER · SOLANA DEVNET</p>
        <h1>Veni.<br />Vidi.<br /><em>Rugi.</em></h1>
        <p className="hero-description">Raise a legion. Read the mempool.<br />Rug an empire.</p>
        <p className="hero-subcopy">A tactical duel against AI where gas, staking and front-running become your weapons. Your wallet is optional. Your next move matters.</p>
        <a className="gold-button hero-cta" href="#heroes">Choose your Imperator <span>↗</span></a>
        <div className="hero-facts"><span><b>{Object.keys(CARDS).length}</b> cards</span><span><b>4</b> factions</span><span><b>30</b> Treasury HP</span></div>
      </div>
      <div className="imperator-art" aria-label="Imperial Roman card illustrations">
        <img className="imperator-main" src="/cards/imperator-liquidus.webp" alt="Imperator Liquidus in gold armor beneath imperial columns" />
        <div className="art-caption"><span>IMPERATOR LIQUIDUS</span><small>DeFi · Legendary</small></div>
        <img className="hero-card hero-card-left" src="/cards/fud-hydra.webp" alt="FUD Hydra card illustration" />
        <img className="hero-card hero-card-right" src="/cards/genesis-pfp.webp" alt="Genesis PFP card illustration" />
        <span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" />
      </div>
    </section>
    <section id="heroes" className="hero-select-section">
      <div className="section-heading"><div><p className="eyebrow">FOUR WALLETS. FOUR WAYS TO RULE.</p><h2>Choose your Imperator</h2></div><span className="demo-label">Free demo · no wallet needed</span></div>
      <div className="hero-select-grid">{Object.values(HEROES).map(h => <button key={h.id} className={`hero-select ${h.id === selected ? 'active' : ''}`} onClick={() => select(h.id)} aria-pressed={h.id === selected}>
        <img src={`/heroes/${h.id}.webp`} alt="" /><div><b>{h.name}</b><span>{h.title}</span></div><i>{h.id === selected ? '✓' : '↗'}</i>
      </button>)}</div>
      <div className="hero-brief"><div><h3>{hero.powerName} <span>2 GAS</span></h3><p>{hero.powerText}</p><small>{STYLES[selected]}</small></div>
        <Link className="gold-button" href={`/game?hero=${selected}`}>Play as {hero.name} →</Link>
      </div>
    </section>
    <section className="strategy-triptych"><article><span>I</span><h3>Commit your spells</h3><p>Your spell waits in a public mempool. Your rival sees it coming and has a turn to answer.</p></article>
      <article><span>II</span><h3>Choose your economy</h3><p>Attack now, or stake a minion for extra gas. A staked legion is still vulnerable.</p></article>
      <article><span>III</span><h3>Never trust the rug</h3><p>Halving grows your ranks. RUG PULL erases them. Hold a Priority counter for the moment that matters.</p></article></section>
    <footer className="landing-footer"><Link href="/packs">✦ Open packs →</Link><Link href="/collection">Collection & decks</Link><Link href="/leaderboard">Hall of victories</Link><span>Crypto World’s Fair · Off-chain AI gameplay</span><a href="https://github.com/Rrollan/imperivm" target="_blank" rel="noreferrer">Source ↗</a></footer>
  </main></div>;
}
