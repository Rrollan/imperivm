'use client';

import { CoinPreview } from './3d/CoinPreview';
import type { ModelKey } from './3d/modelManifest';
import styles from './HeroModel3D.module.css';

export type LandingHeroId = 'whale' | 'builder' | 'degen' | 'validator';

const MODEL_KEYS: Record<LandingHeroId, ModelKey> = {
  whale: 'hero-whale',
  builder: 'hero-builder',
  degen: 'hero-degen',
  validator: 'hero-validator',
};

interface HeroModel3DProps {
  heroId: LandingHeroId;
  name: string;
  className?: string;
  /** Rotation speed in radians per second. */
  speed?: number;
}

/**
 * Rotating 3D hero showcase for the landing page.
 * Shows the gold hero coin (GLB) with slow auto-rotation; the underlying
 * CoinPreview handles lazy loading, reduced motion, WebGL failures and
 * webp fallback automatically.
 */
export default function HeroModel3D({ heroId, name, className = '', speed = 0.25 }: HeroModel3DProps) {
  return (
    <div className={`${styles.frame} ${className}`} aria-hidden="true">
      <CoinPreview
        model={MODEL_KEYS[heroId]}
        size="100%"
        speed={speed}
        autoRotate
        label={`${name} — 3D-модель героя`}
      />
    </div>
  );
}
