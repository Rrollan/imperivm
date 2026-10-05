export const MODEL_IDS = ['aquila', 'brazier', 'bust', 'chest', 'column', 'dice', 'end-turn-hourglass', 'gas-crystal-small', 'gas-crystal', 'hero-builder', 'hero-degen', 'hero-frame', 'hero-validator', 'hero-whale', 'laurel-wreath', 'mempool-scroll', 'roman-table', 'scales', 'treasury', 'trophy', 'water-clock'] as const;
export type ModelId = typeof MODEL_IDS[number];
