'use client';

import type { HeroDef } from '../lib/engine/types';
import ArtImg from './ArtImg';
import type { UiFloat } from './battleFx';

interface HeroPortraitProps {
  hero: HeroDef;
  treasury: number;
  maxTreasury?: number;
  foe?: boolean;
  deckCount: number;
  handCount: number;
  showHandBacks?: boolean;
  floats?: UiFloat[];
  highlight?: boolean;
  shaking?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/** Coin portrait of a hero + treasury chest with a visual coin pile. */
export default function HeroPortrait({
  hero,
  treasury,
  maxTreasury = 30,
  foe = false,
  deckCount,
  handCount,
  showHandBacks = false,
  floats = [],
  highlight = false,
  shaking = false,
  onClick,
  onKeyDown,
}: HeroPortraitProps) {
  const coinSlots = 10;
  const filled = Math.ceil((Math.max(0, treasury) / maxTreasury) * coinSlots);
  const ring = foe ? 'border-blood' : 'border-gold';
  const glow = foe
    ? 'shadow-[0_0_16px_rgba(255,77,94,0.35)]'
    : 'shadow-[0_0_16px_rgba(212,175,55,0.4)]';

  return (
    <div className="relative flex items-center gap-2.5 md:gap-4 min-w-0">
      {/* coin portrait */}
      <div className="relative shrink-0">
        <div
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={onKeyDown}
          title={foe ? 'Enemy treasury — empty it to win' : hero.name}
          className={`${shaking ? 'target-shake' : 'float-slow'} w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden border-4 ${ring} ${glow} bg-abyss ${
            onClick ? 'cursor-pointer' : ''
          } ${highlight ? 'animate-pulse ring-4 ring-blood/60' : ''}`}
        >
          <ArtImg
            src={`/heroes/${hero.id}.webp`}
            alt={hero.name}
            letter={hero.name.charAt(0)}
            className="w-full h-full text-3xl md:text-4xl"
            imgClassName="w-full h-full object-cover"
          />
        </div>
        {/* laurel tick under the coin */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gold-dark font-bold bg-abyss/80 px-1.5 rounded border border-gold-dark/40">
            {hero.name}
          </span>
        </div>
      </div>

      {/* name + treasury */}
      <div className="min-w-0 pt-1">
        <div className="font-display font-bold text-sm md:text-lg leading-tight truncate">
          {hero.name}
          <span className="text-lavender text-[10px] md:text-xs italic font-normal"> · {hero.title}</span>
        </div>

        <div
          className="mt-1 flex items-center gap-2"
          title={foe ? 'Enemy treasury — empty it to win' : 'Your treasury — if it empties, you lose'}
        >
          {/* treasury glyph */}
          <span className="text-gold text-base md:text-lg leading-none" aria-hidden>
            ◈
          </span>
          <span className="font-mono font-bold text-sm md:text-base text-gold-light">
            {treasury} <span className="text-[10px] text-lavender font-sans font-medium">HP</span>
          </span>
          {/* coin pile: depletes visually */}
          <span className="hidden sm:flex items-center gap-[3px]" aria-hidden>
            {Array.from({ length: coinSlots }, (_, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full border ${
                  i < filled
                    ? 'bg-gradient-to-br from-gold-light to-gold-dark border-[#6b4e12] shadow-[0_0_4px_rgba(212,175,55,0.7)]'
                    : 'bg-transparent border-gold-dark/30'
                }`}
              />
            ))}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-lavender/80">
          <span className="font-mono">Deck {deckCount}</span>
          {showHandBacks ? (
            <span className="flex items-center" aria-label={`${handCount} cards in rival hand`}>
              {Array.from({ length: Math.min(handCount, 10) }, (_, i) => (
                <span
                  key={i}
                  className="-ml-1.5 first:ml-0 w-3.5 h-5 rounded-[3px] border border-gold/50 bg-gradient-to-b from-void to-abyss inline-block"
                />
              ))}
              <span className="ml-1 font-mono">×{handCount}</span>
            </span>
          ) : (
            <span className="font-mono">Hand {handCount}</span>
          )}
        </div>
      </div>

      {/* floating combat numbers */}
      {floats.map(f => (
        <span
          key={f.key}
          className={`damage-float absolute font-mono font-bold text-xl md:text-2xl z-30 ${
            f.kind === 'damage' ? 'text-blood' : 'text-mint'
          }`}
          style={{ left: '2.5rem', top: '0.5rem' }}
        >
          {f.kind === 'damage' ? `-${f.amount}` : `+${f.amount}`}
        </span>
      ))}
    </div>
  );
}
