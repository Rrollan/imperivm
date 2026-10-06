import {CARDS} from '../cards';
export function deckError(ids: readonly string[], owned?: Record<string, number>): string | null {
  if (ids.length !== 30) return `Choose exactly 30 cards (${ids.length}/30).`;
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const card = Object.hasOwn(CARDS, id) ? CARDS[id] : null;
    if (!card) return 'The deck contains an unknown card.';
    counts[id] = (counts[id] ?? 0) + 1;
    if (counts[id] > (card.rarity === 'legendary' ? 1 : 2)) return `Too many copies of ${card.name}.`;
    if (owned && counts[id] > (owned[id] ?? 0)) return `You need another copy of ${card.name}.`;
  }
  return null;
}
