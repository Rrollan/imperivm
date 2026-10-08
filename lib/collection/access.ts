import { CARDS } from '../cards';
import { deckError } from '../engine/deckValidation';
import { FREE_DECKS } from './starterDecks';

/** Explicit permanent grant: adding a card to the catalog never grants it for free. */
export const FREE_CARD_IDS = [
  'senate-censure', 'restoration-rite', 'agora-expansion', 'diamond-aegis', 'hermes-relayer',
  'athena-diamond-guard', 'zeus-liquidator', 'hades-rugkeeper', 'lending-legionnaire',
  'amm-centurion', 'liquidation-officer', 'frontrun-bot', 'priority-fee', 'yield-farmer',
  'staking-pool', 'flash-loan', 'impermanent-guard', 'imperator-liquidus', 'pixel-squire',
  'whitelist-scout', 'profile-pic-phalanx', 'trait-reroll', 'floor-sweeper', 'ape-praetorian',
  'minting-press', 'reveal-ceremony', 'blue-chip-basilisk', 'genesis-pfp', 'antenna-auxilia',
  'mesh-messenger', 'relay-runner', 'node-sentinel', 'bandwidth-barbarian', 'hotspot-hoplite',
  'gps-gladiator', 'solar-sapper', 'firmware-phalanx', 'the-grand-cartographer', 'jeet-legion',
  'gm-greeter', 'dogen', 'sandwich-attacker', 'pepito', 'pump-chaser', 'diamond-hoarder',
  'fud-hydra', 'to-the-moon-militia', 'rug-pull', 'audit',
] as const;
const free = new Set<string>(FREE_CARD_IDS);
export const isFreeCard = (id: string): boolean => free.has(id);
export const PACK_CARD_IDS = Object.keys(CARDS).filter(id => !isFreeCard(id));
export const freeCardCounts = (): Record<string, number> => Object.fromEntries(FREE_CARD_IDS.map(id => [id, CARDS[id].rarity === 'legendary' ? 1 : 2]));
export function withFreeCards(owned: Record<string, number>): Record<string, number> {
  const result = { ...owned };
  for (const [id, count] of Object.entries(freeCardCounts())) result[id] = Math.max(count, result[id] ?? 0);
  return result;
}
/** iDos collectibles unlock a card, rather than stacking two paid copies (duplicates convert). */
export function deckCardCounts(owned: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.keys(CARDS).filter(id => isFreeCard(id) || (owned[id] ?? 0) > 0).map(id => [id, CARDS[id].rarity === 'legendary' ? 1 : 2]));
}
export function cleanOwned(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, count]) => Object.hasOwn(CARDS, id) && typeof count === 'number' && Number.isSafeInteger(count) && count > 0 && count <= 1_000_000));
}
export function configuredTitle(value: string | undefined): string | null {
  const title = value?.trim();
  return title && !/^(your|replace|placeholder|todo|insert|<)/i.test(title) ? title : null;
}
export const needsCollection = (deck: readonly string[]): boolean => deck.some(id => !isFreeCard(id));
export function playableDeck(hero: string, owned: Record<string, number>, saved?: string[] | null): string[] {
  return [...(saved && !deckError(saved, deckCardCounts(owned)) ? saved : FREE_DECKS[hero] ?? FREE_DECKS.whale)];
}

/** Sent transiently to our WS authority, never written to browser storage or shared with opponents. */
export interface CollectionAuth { userId: string; sessionTicket: string }
export function parseCollectionAuth(value: unknown): CollectionAuth | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const auth = value as Record<string, unknown>;
  if (typeof auth.userId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(auth.userId) ||
      typeof auth.sessionTicket !== 'string' || auth.sessionTicket.length < 16 || auth.sessionTicket.length > 8192 || /[\u0000-\u0020\u007f]/.test(auth.sessionTicket)) return null;
  return {userId: auth.userId, sessionTicket: auth.sessionTicket};
}
