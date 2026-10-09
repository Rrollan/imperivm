export type RenderQuality = 'auto' | 'sharp' | 'fast';
export const RENDER_PIXEL_BUDGET={auto:5_500_000,sharp:9_000_000};

// A pixel budget keeps Retina from multiplying the cost of every full-screen draw.
export function pixelRatio(width: number, height: number, dpr: number, quality: RenderQuality) {
  if (quality === 'fast') return 1;
  const ceiling = 2;
  const budget = RENDER_PIXEL_BUDGET[quality];
  return Math.max(1, Math.min(dpr || 1, ceiling, Math.sqrt(budget / Math.max(1, width * height))));
}
