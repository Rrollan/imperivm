import { HEROES } from './heroes';
import {deckError} from './engine/deckValidation';
export {deckError} from './engine/deckValidation';
export const CUSTOM_DECK_KEY = 'imperivm.custom-decks.v1';
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
