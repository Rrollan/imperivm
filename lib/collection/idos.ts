import type { IDosGamesClient, CollectionDefinitions } from '@idosgames/core';
import type { IDosRuntime } from '../idos/client';
import { idosResult as unwrap } from '../idos/auth';
import { CARDS } from '../cards';
import { cleanOwned, IDOS_CONFIG, PACK_COST, type CollectionGateway, type CollectionSnapshot, type PackResult } from './gateway';
export function validateIDosDefinitions(defs: CollectionDefinitions) {
  const pack = defs.PackTypes?.[IDOS_CONFIG.pack];
  if (!defs.Collections?.[IDOS_CONFIG.collection] || !pack) throw new Error('Configure the IMPERIVM collection and pack type in this iDos title.');
  const cost = pack.PriceOptions?.[IDOS_CONFIG.payment]?.Cost;
  const entries = cost?.Standard?.Entries;
  if (pack.CollectibleCount !== 5 || !entries || entries.length !== 1 || entries[0].Type !== 'VirtualCurrency' || entries[0].CurrencyID !== IDOS_CONFIG.currency || entries[0].Amount !== PACK_COST || cost?.Standard?.EventTokens?.length || cost?.PremiumTiers?.length || cost?.PremiumDiscounts?.length) throw new Error('The pack must grant 5 cards and cost exactly 50 virtual RUG. Crypto payments are disabled.');
}
/** Uses the app's authenticated client; it never logs in or creates an SDK client. */
export class IDosCollectionGateway implements CollectionGateway {
  private inFlight = false;
  constructor(private readonly runtime: IDosRuntime) {}
  private async read(client: IDosGamesClient): Promise<CollectionSnapshot> {
    validateIDosDefinitions(unwrap(await client.collection.getDefinitions()));
    unwrap(await client.cache.ensureState(['VirtualCurrencies'], { force: true }));
    const state = unwrap(await client.collection.getUserState());
    const rug = client.data.user.getVirtualCurrencyAmount(IDOS_CONFIG.currency);
    if (!Number.isSafeInteger(rug) || rug < 0) throw new Error('iDos returned an invalid RUG balance.');
    return { mode: 'idos', rug, owned: cleanOwned(state.OwnedCollectibles), packsOpened: 0 };
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
        const drops = result.Packs?.flatMap(pack => [...(pack.GrantedCollectibles ?? []), ...(pack.DuplicateCollectibles ?? [])]) ?? [...(result.GrantedCollectibles ?? []), ...(result.DuplicateCollectibles ?? [])];
        const cards = drops.map(drop => CARDS[drop.CollectibleID]).filter(Boolean);
        const snapshot = await this.read(client);
        if (!cards.length) throw new Error('The pack was processed by iDos, but its card IDs do not match IMPERIVM. Refresh the collection; do not repurchase automatically.');
        return { cards, snapshot };
      });
    } finally { this.inFlight = false; }
  }
}
