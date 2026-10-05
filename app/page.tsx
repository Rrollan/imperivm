'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HEROES } from '../lib/heroes';
import { startAmbient } from '../lib/audio/sfx';
import { markAmbientStarted, shouldStartAmbient } from '../lib/audio/events';
import { unlockAudio } from '../lib/audio/manager';
import { useLocale } from '../components/LocaleContext';
import HeroModel3D from '../components/HeroModel3D';

export default function LandingPage() {
  const [selected, select] = useState('whale');
  const { t, heroName } = useLocale();

  useEffect(() => {
    if (!shouldStartAmbient()) return;
    const handler = () => {
      void unlockAudio().then(() => { startAmbient(); markAmbientStarted(true); });
      window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true }); window.addEventListener('keydown', handler, { once: true });
    return () => { window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); };
  }, []);

  return (
    <main className="game-menu">
      <header className="menu-wordmark">
        <h1 className="font-display">IMPERIVM</h1>
        <p className="font-display">Veni. Vidi. Rugi.</p>
      </header>

      <div className="menu-controls">
        <Link className="gold-button menu-play font-display" href={`/arena?hero=${selected}`}>
          {t('ИГРАТЬ', 'PLAY')}
        </Link>

        <div className="menu-heroes" role="group" aria-label={t('Выберите героя', 'Choose your hero')}>
          {Object.values(HEROES).map(h => (
            <button
              key={h.id}
              type="button"
              className="menu-hero"
              aria-pressed={h.id === selected}
              onClick={() => select(h.id)}
            >
              <HeroModel3D heroId={h.id as 'whale' | 'builder' | 'degen' | 'validator'} name={heroName(h.id)} className="menu-coin" />
              <span className="font-display">{heroName(h.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .game-menu {
          min-height: 100svh;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(32px, 7vh, 76px) 24px 48px;
          color: #2a1a10;
          background-color: #e8dbc2;
          background-image: radial-gradient(ellipse at 50% 0%, #fff6d9e6 0%, #ffe3a54d 45%, transparent 78%), url('/boards/marble-light.webp');
          background-size: 100% 100%, 512px 512px;
          background-repeat: no-repeat, repeat;
        }
        .menu-wordmark { text-align: center; }
        .menu-wordmark h1 {
          margin: 0;
          font-size: clamp(40px, 8vw, 80px);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: .08em;
          color: #bc8e32;
          text-shadow: 0 2px 1px #fff4c9, 0 -2px 1px #624118, 0 4px 7px #60411d66;
        }
        .menu-wordmark p {
          margin-top: 12px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: .16em;
          color: #2a1a10;
        }
        .menu-controls {
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 48px;
          padding-top: 48px;
          padding-bottom: clamp(0px, 8vh, 90px);
        }
        .game-menu :global(.menu-play) {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 240px;
          height: 68px;
          font-size: 22px;
          letter-spacing: .16em;
          color: #2a1a10;
          text-shadow: 0 1px 1px #fff4c9;
          box-shadow: inset 0 2px 1px #fff4c9, inset 0 -3px 2px #87551b, 0 6px 0 #704819, 0 12px 24px #70481955;
        }
        .menu-heroes { display: grid; grid-template-columns: repeat(4, 136px); gap: 24px; }
        .menu-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          cursor: pointer;
          border-radius: 12px;
        }
        .game-menu :global(.menu-coin) {
          width: 112px;
          height: 112px;
          object-fit: cover;
          border: 4px solid #bd913e;
          border-radius: 50%;
          overflow: hidden;
          background: radial-gradient(circle at 50% 38%, #f7e3a1 0%, #dcb455 58%, #9a6b23 100%);
          box-shadow: 0 4px 0 #77501f, 0 8px 16px #55361255;
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .menu-hero[aria-pressed='true'] :global(.menu-coin) {
          transform: scale(1.12);
          border-color: #f6d578;
          box-shadow: 0 0 0 3px #a87728, 0 0 24px 8px #e7b947aa, 0 8px 16px #55361266;
        }
        .menu-hero span {
          font-size: 20px;
          font-weight: 700;
          color: #ffe19a;
          text-shadow: 0 1px 2px #2a1a10, 0 0 4px #2a1a10, 1px 1px 1px #2a1a10, -1px -1px 1px #2a1a10;
        }
        .menu-hero:focus-visible, .game-menu :global(.menu-play:focus-visible) {
          outline: 3px solid #704819;
          outline-offset: 8px;
        }
        @media (max-width: 639px) {
          .menu-controls { gap: 36px; padding-bottom: 0; }
          .game-menu :global(.menu-play) { width: 100%; max-width: 360px; }
          .menu-heroes { grid-template-columns: repeat(2, 136px); gap: 28px 20px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .game-menu :global(.menu-coin) { transition: none; }
        }
      `}</style>
    </main>
  );
}
