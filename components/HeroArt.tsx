'use client';

import { useState } from 'react';
import {heroPortraitPath} from './presentation/heroPortrait';

/** Square portrait viewport: preserve proportions and survive a failed asset. */
export default function HeroArt({ heroId, name, decorative = false, className = '' }: {
  heroId: string;
  name: string;
  decorative?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return <span className={`hero-art ${className}`} data-hero={heroId} aria-hidden={decorative || undefined}>
    {failed ? <span className="hero-art-fallback" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : name}>{name.slice(0, 1)}</span>
      : <img src={['strategist','athena','hermes','hephaestus','poseidon'].includes(heroId)?heroPortraitPath(heroId):`/heroes/${heroId}.webp`} alt={decorative ? '' : name} width={160} height={160} onError={() => setFailed(true)} />}
  </span>;
}
