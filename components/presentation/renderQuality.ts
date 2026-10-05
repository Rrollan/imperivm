export type RenderQuality = 'auto' | 'sharp' | 'fast';

// A pixel budget keeps Retina from multiplying the cost of every full-screen draw.
export function pixelRatio(width: number, height: number, dpr: number, quality: RenderQuality) {
  if (quality === 'fast') return 1;
  const ceiling = quality === 'sharp' ? 2 : 1.5;
  const budget = quality === 'sharp' ? 4_000_000 : 2_200_000;
  return Math.max(1, Math.min(dpr || 1, ceiling, Math.sqrt(budget / Math.max(1, width * height))));
}
