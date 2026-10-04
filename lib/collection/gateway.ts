import { CARDS } from '../cards';
import type { CardDef, Rarity } from '../engine/types';

export const COLLECTION_KEY = 'imperivm.collection.v1';
export const PACK_COST = 50;
export const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common', weight: 60 }, { rarity: 'rare', weight: 25 },
  { rarity: 'epic', weight: 11 }, { rarity: 'legendary', weight: 4 },
];
export interface CollectionSnapshot { mode: 'local' | 'idos'; rug: number; owned: Record<string, number>; packsOpened: number; }
export interface PackResult { cards: CardDef[]; snapshot: CollectionSnapshot; }
export interface CollectionGateway { load(): Promise<CollectionSnapshot>; openPack(): Promise<PackResult>; }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function configuredTitle(value: string | undefined): string | null {
  const title = value?.trim();
  return title && !/^(your|replace|placeholder|todo|insert|<)/i.test(title) ? title : null;
}
function starter(): CollectionSnapshot {
  return { mode: 'local', rug: 500, owned: Object.fromEntries(Object.values(CARDS).filter(c => c.rarity === 'common').map(c => [c.id, 2])), packsOpened: 0 };
}
export function cleanOwned(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, count]) => Object.hasOwn(CARDS, id) && typeof count === 'number' && Number.isSafeInteger(count) && count > 0 && count <= 1_000_000));
}
export function parseLocalCollection(raw: string | null): CollectionSnapshot {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (data?.version !== 1 || !Number.isSafeInteger(data.rug) || data.rug < 0 || data.rug > 1_000_000 || !Number.isSafeInteger(data.packsOpened) || data.packsOpened < 0) return starter();
    return { mode: 'local', rug: data.rug, packsOpened: data.packsOpened, owned: cleanOwned(data.owned) };
  } catch { return starter(); }
}
function rollCard(random: () => number): CardDef {
  let roll = Math.max(0, Math.min(0.999999999, random())) * 100;
  let rarity: Rarity = 'common';
  for (const bucket of RARITY_WEIGHTS) { roll -= bucket.weight; if (roll < 0) { rarity = bucket.rarity; break; } }
  const pool = Object.values(CARDS).filter(c => c.rarity === rarity);
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
        if (state.rug < PACK_COST) throw new Error('Not enough demo $RUG. A pack costs 50 $RUG.');
        const cards = Array.from({ length: 5 }, () => rollCard(this.random));
        const owned = { ...state.owned };
        cards.forEach(card => { owned[card.id] = (owned[card.id] ?? 0) + 1; });
        this.memory = { mode: 'local', rug: state.rug - PACK_COST, packsOpened: state.packsOpened + 1, owned };
        try { if (this.persistence) this.storage?.setItem(COLLECTION_KEY, JSON.stringify({ version: 1, ...this.memory })); } catch { this.persistence = false; }
        return { cards, snapshot: structuredClone(this.memory) };
      };
      // Serialize purchases from multiple tabs when Web Locks are available.
      return typeof navigator !== 'undefined' && navigator.locks ? await navigator.locks.request(COLLECTION_KEY, buy) : await buy();
    } finally { this.inFlight = false; }
  }
}
export const IDOS_CONFIG = {
  title: configuredTitle(process.env.NEXT_PUBLIC_IDOS_TITLE_ID),
  collection: process.env.NEXT_PUBLIC_IDOS_COLLECTION_ID || 'IMPERIVM_GENESIS',
  pack: process.env.NEXT_PUBLIC_IDOS_PACK_TYPE_ID || 'GENESIS_PACK',
  currency: process.env.NEXT_PUBLIC_IDOS_CURRENCY_ID || 'RUG',
  payment: process.env.NEXT_PUBLIC_IDOS_PRICE_OPTION_ID || 'RUG',
  leaderboard: process.env.NEXT_PUBLIC_IDOS_LEADERBOARD_ID || '',
};
