import { CARDS } from './cards';
import { HEROES } from './heroes';
export const CUSTOM_DECK_KEY = 'imperivm.custom-decks.v1';
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
export function loadCustomDeck(heroId: string): string[] | null {
  try { const data = JSON.parse(localStorage.getItem(CUSTOM_DECK_KEY) || '{}'); const deck = data[heroId]; return Array.isArray(deck) && deck.every(v => typeof v === 'string') && !deckError(deck) ? deck : null; }
  catch { return null; }
}
export function saveCustomDeck(heroId: string, ids: string[]) {
  if (!Object.hasOwn(HEROES, heroId) || deckError(ids)) throw new Error('The custom deck is invalid.');
  let data: Record<string, string[]> = {};
  try { const parsed = JSON.parse(localStorage.getItem(CUSTOM_DECK_KEY) || '{}'); for (const hero of Object.keys(HEROES)) if (Array.isArray(parsed[hero]) && !deckError(parsed[hero])) data[hero] = parsed[hero]; } catch { /* fresh record */ }
  data[heroId] = [...ids]; localStorage.setItem(CUSTOM_DECK_KEY, JSON.stringify(data));
}
