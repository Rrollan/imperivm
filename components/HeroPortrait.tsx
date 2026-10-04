'use client';

import type { HeroDef } from '../lib/engine/types';
import { CoinPreview, type ModelKey } from './3d/CoinPreview';
import { useLocale } from './LocaleContext';
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
  const { t, heroName, heroTitle } = useLocale();
  const name = heroName(hero.id);
  const hits = floats.filter(f => f.kind === 'damage');
  const damaged = shaking || hits.length > 0;
  return <div className="hero-profile">
    <div className="hero-caption"><strong>{name}</strong><small>{heroTitle(hero.id)}</small></div>
    <div className={`hero-coin ${highlight ? 'valid-hero-target' : ''}`}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} onKeyDown={onKeyDown}
      aria-label={`${name} · ${t('Казна', 'Treasury')} ${treasury}`}>
      <div
        aria-label={`${name} · ${t('Казна', 'Treasury')} ${treasury}`}
        title={foe ? t('Опустошите вражескую казну для победы', 'Empty the rival Treasury to win') : name}
        className={`hero-medallion ${onClick ? 'cursor-pointer' : ''}`}>
        <CoinPreview model={`hero-${hero.id}` as ModelKey} size="100%" autoRotate={false} label={name} />
      </div>
      <div key={hits[hits.length - 1]?.key ?? 'treasury'} className={`hero-treasury ${damaged ? 'target-shake' : ''}`}
        title={t('Казна: прочность империи', 'Treasury: the strength of your empire')}>
        <img src="/ornaments/chest.svg" alt="" /><strong>{treasury}</strong>
        <small>{t('КАЗНА', 'TREASURY')}</small>
        <span className="treasury-reserve" aria-hidden>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < Math.ceil(Math.max(0, treasury) / maxTreasury * 5) ? 'filled' : ''} />)}</span>
      </div>
      {hits.map(hit => <span key={hit.key} className="treasury-spill" aria-hidden>{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--coin-x': `${(i - 2.5) * 17}px`, '--coin-y': `${-32 - (i % 3) * 18}px` } as React.CSSProperties}>$</i>)}</span>)}
    </div>
    <span className="sr-only">{t('Колода', 'Deck')} {deckCount} · {t('Рука', 'Hand')} {handCount}{showHandBacks ? t(' · Противник', ' · Rival') : ''}</span>
    {floats.map(f => <span key={f.key} className={`damage-float hero-float ${f.kind === 'damage' ? 'text-blood' : 'text-mint'}`}>
      {f.kind === 'damage' ? `−${f.amount}` : `+${f.amount}`}
    </span>)}
  </div>;
}
