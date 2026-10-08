import type { IDosGamesClient, CollectionDefinitions, OpenPackResponse } from '@idosgames/core';
import type { IDosRuntime } from '../idos/client';
import { idosResult as unwrap } from '../idos/auth';
import { CARDS } from '../cards';
import { PACK_CARD_IDS, withFreeCards } from './access';
import { cleanOwned, IDOS_CONFIG, PACK_COST, RARITY_WEIGHTS, type CollectionGateway, type CollectionSnapshot, type PackResult } from './gateway';
export const IDOS_RARITIES = {common: 1, rare: 2, epic: 3, legendary: 4} as const;
/** GrantedCollectibles is the FULL roll list; DuplicateCollectibles is a subset, not extra rolls. */
export function idosPackDrops(result: OpenPackResponse) {
  return result.Packs?.flatMap(pack => pack.GrantedCollectibles ?? pack.DuplicateCollectibles ?? []) ?? result.GrantedCollectibles ?? result.DuplicateCollectibles ?? [];
}
export function validateIDosDefinitions(defs: CollectionDefinitions) {
  const pack = defs.PackTypes?.[IDOS_CONFIG.pack];
  if (!defs.Collections?.[IDOS_CONFIG.collection] || !pack) throw new Error('Configure the IMPERIVM collection and pack type in this iDos title.');
  const cost = pack.PriceOptions?.[IDOS_CONFIG.payment]?.Cost;
  const entries = cost?.Standard?.Entries;
  if (pack.CollectibleCount !== 5 || !entries || entries.length !== 1 || entries[0].Type !== 'VirtualCurrency' || entries[0].CurrencyID !== IDOS_CONFIG.currency || entries[0].Amount !== PACK_COST || cost?.Standard?.EventTokens?.length || cost?.PremiumTiers?.length || cost?.PremiumDiscounts?.length) throw new Error('The pack must grant 5 cards and cost exactly 50 virtual IMP. Crypto payments are disabled.');
  const ids = defs.Collections[IDOS_CONFIG.collection].Sets?.flatMap(set => set.Collectibles?.map(card => card.CollectibleID) ?? []) ?? [];
  if (ids.length !== PACK_CARD_IDS.length || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !PACK_CARD_IDS.includes(id))) throw new Error('The Agora pack collection must contain exactly the 50 pack-exclusive cards. Free cards must not drop from paid packs.');
  const collectibles = defs.Collections[IDOS_CONFIG.collection].Sets?.flatMap(set => set.Collectibles ?? []) ?? [];
  if (collectibles.some(card => card.HasSpecialVersion || card.Rarity !== IDOS_RARITIES[CARDS[card.CollectibleID!].rarity]) ||
      RARITY_WEIGHTS.some(({rarity, weight}) => pack.RarityWeights?.[IDOS_RARITIES[rarity]] !== weight) ||
      Object.entries(pack.RarityWeights ?? {}).some(([rarity, weight]) => !['1', '2', '3', '4'].includes(rarity) && weight !== 0) ||
      (pack.GuaranteedMinRarity ?? 1) !== 1 || pack.GuaranteeMaxRarity || pack.BonusRewardSlots?.length || pack.PityRules?.length || pack.Presets?.BonusRewardSlots || pack.Presets?.PityRules) throw new Error('Agora rarity settings must match the displayed 60/25/11/4 odds, without bonus slots or special versions.');
  if ([1, 2, 3, 4].some(rarity => !defs.DuplicateConversions?.some(entry => entry.Rarity === rarity && Number.isSafeInteger(entry.CollectionCurrencyGranted) && entry.CollectionCurrencyGranted! > 0))) throw new Error('Configure collection-currency compensation for duplicate Agora cards of every rarity.');
}
/** Uses the app's authenticated client; it never logs in or creates an SDK client. */
export class IDosCollectionGateway implements CollectionGateway {
  private inFlight = false;
  constructor(private readonly runtime: IDosRuntime) {}
  private async read(client: IDosGamesClient): Promise<CollectionSnapshot> {
    validateIDosDefinitions(unwrap(await client.collection.getDefinitions()));
    unwrap(await client.cache.ensureState(['VirtualCurrencies'], { force: true }));
    const state = unwrap(await client.collection.getUserState());
    if (state.CollectionID !== IDOS_CONFIG.collection) throw new Error('The active iDos collection must be IMPERIVM Agora.');
    const rug = client.data.user.getVirtualCurrencyAmount(IDOS_CONFIG.currency);
    if (!Number.isSafeInteger(rug) || rug < 0) throw new Error('iDos returned an invalid IMP balance.');
    const collectionCurrency = state.CollectionCurrencyBalance ?? 0;
    if (!Number.isSafeInteger(collectionCurrency) || collectionCurrency < 0) throw new Error('iDos returned an invalid collection-currency balance.');
    return { mode: 'idos', rug, owned: withFreeCards(cleanOwned(state.OwnedCollectibles)), packsOpened: 0, collectionCurrency };
  }
  load(): Promise<CollectionSnapshot> { return this.runtime.withAccount(client => this.read(client)); }
  async openPack(): Promise<PackResult> {
    if (this.inFlight) throw new Error('A pack is already opening.');
    this.inFlight = true;
    try {
      return await this.runtime.withAccount(async client => {
        validateIDosDefinitions(unwrap(await client.collection.getDefinitions()));
        // The backend charges the configured virtual-currency price and grants cards atomically.
        const result = unwrap(await client.collection.openPack(IDOS_CONFIG.collection, IDOS_CONFIG.pack, 1, { selectedOptionID: IDOS_CONFIG.payment }));
        const drops = idosPackDrops(result);
        const cards = drops.map(drop => CARDS[drop.CollectibleID]).filter(Boolean);
        const snapshot = await this.read(client);
        if (cards.length !== 5 || cards.some(card => !PACK_CARD_IDS.includes(card.id))) throw new Error('The pack was processed by iDos, but its card IDs do not match IMPERIVM. Refresh the collection; do not repurchase automatically.');
        return { cards, snapshot, duplicates: drops.map(drop => drop.IsDuplicate === true) };
      });
    } finally { this.inFlight = false; }
  }
}
