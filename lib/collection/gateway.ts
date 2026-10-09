import { CARDS } from '../cards';
import type { CardDef, Rarity } from '../engine/types';
import { PACK_CARD_IDS, freeCardCounts, withFreeCards, cleanOwned, configuredTitle } from './access';
import {FREE_HERO_IDS,CASE_HERO_IDS} from '../heroes';
export {cleanOwned, configuredTitle} from './access';

export const COLLECTION_KEY = 'imperivm.collection.v1';
export const PACK_COST = 50;
export const RULER_CASE_COST=200;
export {rulerCollectible,cleanHeroes,heroesFromCollectibles} from './heroAccess';
import {cleanHeroes} from './heroAccess';
export const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common', weight: 60 }, { rarity: 'rare', weight: 25 },
  { rarity: 'epic', weight: 11 }, { rarity: 'legendary', weight: 4 },
];
export interface CollectionSnapshot { mode: 'local' | 'idos'; rug: number; owned: Record<string, number>; packsOpened: number; collectionCurrency?: number; heroes?:string[]; }
export interface PackResult { cards: CardDef[]; snapshot: CollectionSnapshot; duplicates?: boolean[]; }
export interface RulerCaseResult {heroId:string;duplicate:boolean;snapshot:CollectionSnapshot}
export interface CollectionGateway { load(): Promise<CollectionSnapshot>; openPack(): Promise<PackResult>; openRulerCase():Promise<RulerCaseResult>; }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; }
function starter(): CollectionSnapshot {
  return { mode: 'local', rug: 500, owned: freeCardCounts(), packsOpened: 0,heroes:[...FREE_HERO_IDS] };
}
export function parseLocalCollection(raw: string | null): CollectionSnapshot {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (![1, 2].includes(data?.version) || !Number.isSafeInteger(data.rug) || data.rug < 0 || data.rug > 1_000_000 || !Number.isSafeInteger(data.packsOpened) || data.packsOpened < 0) return starter();
    const owned = cleanOwned(data.owned);
    // v1's untouched starter granted common Agora cards automatically. Those are not pack drops.
    if (data.version === 1 && data.packsOpened === 0) for (const id of PACK_CARD_IDS) delete owned[id];
    return { mode: 'local', rug: data.rug, packsOpened: data.packsOpened, owned: withFreeCards(owned),heroes:cleanHeroes(data.heroes),collectionCurrency:Number.isSafeInteger(data.collectionCurrency)&&data.collectionCurrency>=0?data.collectionCurrency:0 };
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
        this.memory = {...state, mode: 'local', rug: state.rug - PACK_COST, packsOpened: state.packsOpened + 1, owned };
        try { if (this.persistence) this.storage?.setItem(COLLECTION_KEY, JSON.stringify({ version: 2, ...this.memory })); } catch { this.persistence = false; }
        return { cards, snapshot: structuredClone(this.memory) };
      };
      // Serialize purchases from multiple tabs when Web Locks are available.
      return typeof navigator !== 'undefined' && navigator.locks ? await navigator.locks.request(COLLECTION_KEY, buy) : await buy();
    } finally { this.inFlight = false; }
  }
  async openRulerCase():Promise<RulerCaseResult>{
    if(this.inFlight)throw new Error('A pack is already opening.');this.inFlight=true;
    try{
      const buy=async()=>{
        const state=await this.load();if(state.rug<RULER_CASE_COST)throw new Error('Кейс правителя стоит 200 демо $IMP.');
        const heroId=CASE_HERO_IDS[Math.floor(Math.max(0,Math.min(.999999999,this.random()))*CASE_HERO_IDS.length)];
        const duplicate=state.heroes?.includes(heroId)??false;
        this.memory={...state,rug:state.rug-RULER_CASE_COST,heroes:cleanHeroes([...(state.heroes??[]),heroId]),collectionCurrency:(state.collectionCurrency??0)+(duplicate?100:0)};
        try{if(this.persistence)this.storage?.setItem(COLLECTION_KEY,JSON.stringify({version:2,...this.memory}));}catch{this.persistence=false;}
        return {heroId,duplicate,snapshot:structuredClone(this.memory)};
      };
      return typeof navigator!=='undefined'&&navigator.locks?await navigator.locks.request(COLLECTION_KEY,buy):await buy();
    }finally{this.inFlight=false;}
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
  rulerCasesEnabled:process.env.NEXT_PUBLIC_IDOS_RULER_CASE_ENABLED==='true',
  rulerCase:process.env.NEXT_PUBLIC_IDOS_RULER_CASE_TYPE_ID||'OLYMPUS_RULER_CASE',
};
