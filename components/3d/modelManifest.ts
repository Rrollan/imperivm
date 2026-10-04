/** Names are stable; /api/models discovers supplied GLBs and posters at runtime. */
export const MODEL_MANIFEST = {
  'hero-whale': {
    path: '/models/hero-whale.glb',
    fallback: '/models/hero-whale.webp',
    rotation: [0, -Math.PI / 2, 0] as [number, number, number],
  },
  'hero-builder': {
    path: '/models/hero-builder.glb',
    fallback: '/heroes/builder.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  'hero-degen': {
    path: '/models/hero-degen.glb',
    fallback: '/heroes/degen.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  'hero-validator': {
    path: '/models/hero-validator.glb',
    fallback: '/heroes/validator.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  'coin-rug': {
    path: '/models/coin-rug.glb',
    fallback: '/ornaments/coin-rug.png', rotation: [0, 0, 0] as [number, number, number],
  },
  trophy: {
    path: '/models/trophy.glb',
    fallback: '/ornaments/trophy.png', rotation: [0, 0, 0] as [number, number, number],
  },
  chest: {
    path: '/models/chest.glb',
    fallback: '/ornaments/chest.png', rotation: [0, 0, 0] as [number, number, number],
  },
  column: { path: '/models/column.glb', fallback: '/ornaments/column.png', rotation: [0, 0, 0] as [number, number, number] },
  bust: { path: '/models/bust.glb', fallback: '/ornaments/bust.png', rotation: [0, 0, 0] as [number, number, number] },
  brazier: { path: '/models/brazier.glb', fallback: '/ornaments/ornament-brazier.png', rotation: [0, 0, 0] as [number, number, number] },
  'gas-crystal': { path: '/models/gas-crystal.glb', fallback: '/ornaments/ornament-gas-crystal.png', rotation: [0, 0, 0] as [number, number, number] },
  treasury: { path: '/models/treasury.glb', fallback: '/ornaments/ornament-treasury.png', rotation: [0, 0, 0] as [number, number, number] },
  scales: { path: '/models/scales.glb', fallback: '/ornaments/ornament-scales.png', rotation: [0, 0, 0] as [number, number, number] },
  aquila: { path: '/models/aquila.glb', fallback: '/ornaments/ornament-aquila.png', rotation: [0, 0, 0] as [number, number, number] },
  dice: { path: '/models/dice.glb', fallback: '/ornaments/ornament-dice.png', rotation: [0, 0, 0] as [number, number, number] },
  'laurel-wreath': { path: '/models/laurel-wreath.glb', fallback: '/ornaments/ornament-laurel-wreath.png', rotation: [0, 0, 0] as [number, number, number] },
  'water-clock': { path: '/models/water-clock.glb', fallback: '/ornaments/ornament-water-clock.png', rotation: [0, 0, 0] as [number, number, number] },
} as const;

export type ModelKey = keyof typeof MODEL_MANIFEST;

export interface CoinPreviewProps {
  model?: ModelKey;
  /** CSS pixel size, or a CSS size such as '100%'. */
  size?: number | string;
  /** Rotation speed in radians per second. */
  speed?: number;
  autoRotate?: boolean;
  className?: string;
  label?: string;
  fallbackSrc?: string;
}
