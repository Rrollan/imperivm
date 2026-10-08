import { CARDS } from '../cards';
import type { CardDef, Rarity } from '../engine/types';
import { PACK_CARD_IDS, freeCardCounts, withFreeCards, cleanOwned, configuredTitle } from './access';
export {cleanOwned, configuredTitle} from './access';

export const COLLECTION_KEY = 'imperivm.collection.v1';
export const PACK_COST = 50;
export const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common', weight: 60 }, { rarity: 'rare', weight: 25 },
  { rarity: 'epic', weight: 11 }, { rarity: 'legendary', weight: 4 },
];
export interface CollectionSnapshot { mode: 'local' | 'idos'; rug: number; owned: Record<string, number>; packsOpened: number; collectionCurrency?: number; }
export interface PackResult { cards: CardDef[]; snapshot: CollectionSnapshot; duplicates?: boolean[]; }
export interface CollectionGateway { load(): Promise<CollectionSnapshot>; openPack(): Promise<PackResult>; }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; }
function starter(): CollectionSnapshot {
  return { mode: 'local', rug: 500, owned: freeCardCounts(), packsOpened: 0 };
}
export function parseLocalCollection(raw: string | null): CollectionSnapshot {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (![1, 2].includes(data?.version) || !Number.isSafeInteger(data.rug) || data.rug < 0 || data.rug > 1_000_000 || !Number.isSafeInteger(data.packsOpened) || data.packsOpened < 0) return starter();
    const owned = cleanOwned(data.owned);
    // v1's untouched starter granted common Agora cards automatically. Those are not pack drops.
    if (data.version === 1 && data.packsOpened === 0) for (const id of PACK_CARD_IDS) delete owned[id];
    return { mode: 'local', rug: data.rug, packsOpened: data.packsOpened, owned: withFreeCards(owned) };
  } catch { return starter(); }
}
function rollCard(random: () => number): CardDef {
  let roll = Math.max(0, Math.min(0.999999999, random())) * 100;
  let rarity: Rarity = 'common';
  for (const bucket of RARITY_WEIGHTS) { roll -= bucket.weight; if (roll < 0) { rarity = bucket.rarity; break; } }
  const pool = PACK_CARD_IDS.map(id => CARDS[id]).filter(c => c.rarity === rarity);
  return pool[Math.floor(Math.max(0, Math.min(0.999999999, random())) * pool.length)];
}
export class LocalCollectionGateway implements CollectionGateway {
  private memory = starter();
  private inFlight = false;
  private persistence = true;
  constructor(private storage?: StoragePort, private random = Math.random) {}
  async load() {
    try { if (this.storage && this.persistence) this.memory = parseLocalCollection(this.storage.getItem(COLLECTION_KEY)); } catch { this.persistence = false; }
    return structuredClone(this.memory);
  }
  async openPack(): Promise<PackResult> {
    if (this.inFlight) throw new Error('A pack is already opening.');
    this.inFlight = true;
    try {
      const buy = async () => {
        const state = await this.load();
        if (state.rug < PACK_COST) throw new Error('Not enough demo $IMP. A pack costs 50 $IMP.');
        const cards = Array.from({ length: 5 }, () => rollCard(this.random));
        const owned = { ...state.owned };
        cards.forEach(card => { owned[card.id] = (owned[card.id] ?? 0) + 1; });
        this.memory = { mode: 'local', rug: state.rug - PACK_COST, packsOpened: state.packsOpened + 1, owned };
        try { if (this.persistence) this.storage?.setItem(COLLECTION_KEY, JSON.stringify({ version: 2, ...this.memory })); } catch { this.persistence = false; }
        return { cards, snapshot: structuredClone(this.memory) };
      };
      // Serialize purchases from multiple tabs when Web Locks are available.
      return typeof navigator !== 'undefined' && navigator.locks ? await navigator.locks.request(COLLECTION_KEY, buy) : await buy();
    } finally { this.inFlight = false; }
  }
}
export const IDOS_CONFIG = {
  title: configuredTitle(process.env.NEXT_PUBLIC_IDOS_TITLE_ID),
  collection: process.env.NEXT_PUBLIC_IDOS_COLLECTION_ID || 'IMPERIVM_AGORA',
  pack: process.env.NEXT_PUBLIC_IDOS_PACK_TYPE_ID || 'AGORA_PACK',
  currency: process.env.NEXT_PUBLIC_IDOS_CURRENCY_ID || 'IMP',
  payment: process.env.NEXT_PUBLIC_IDOS_PRICE_OPTION_ID || 'IMP',
  leaderboard: process.env.NEXT_PUBLIC_IDOS_LEADERBOARD_ID || '',
  network: process.env.NEXT_PUBLIC_IDOS_SOLANA_NETWORK_ID || 'SOLANA_DEVNET',
};
