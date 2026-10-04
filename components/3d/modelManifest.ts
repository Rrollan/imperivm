/** Only confirmed, local files may be loaded. Enable future models after adding their GLB. */
export const MODEL_MANIFEST = {
  'hero-whale': {
    path: '/models/hero-whale.glb',
    available: true,
    fallback: '/models/hero-whale.webp',
    rotation: [0, -Math.PI / 2, 0] as [number, number, number],
  },
  'hero-builder': {
    path: '/models/hero-builder.glb', available: false,
    fallback: '/heroes/builder.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  'hero-degen': {
    path: '/models/hero-degen.glb', available: false,
    fallback: '/heroes/degen.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  'hero-validator': {
    path: '/models/hero-validator.glb', available: false,
    fallback: '/heroes/validator.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  'coin-rug': {
    path: '/models/coin-rug.glb', available: false,
    fallback: '/cards/rug-pull.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  trophy: {
    path: '/models/trophy.glb', available: false,
    fallback: '/heroes/whale.webp', rotation: [0, 0, 0] as [number, number, number],
  },
  chest: {
    path: '/models/chest.glb', available: false,
    fallback: '/cards/card-back.webp', rotation: [0, 0, 0] as [number, number, number],
  },
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
