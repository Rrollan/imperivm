import { createIDosGamesClient, type IDosGamesClient, type OperationResult, type CollectionDefinitions } from '@idosgames/core';
import { BrowserPlatformAdapter } from '@idosgames/core/platform';
import { CARDS } from '../cards';
import { cleanOwned, IDOS_CONFIG, PACK_COST, type CollectionGateway, type CollectionSnapshot, type PackResult } from './gateway';
export function validateIDosDefinitions(defs: CollectionDefinitions) {
  const pack = defs.PackTypes?.[IDOS_CONFIG.pack];
  if (!defs.Collections?.[IDOS_CONFIG.collection] || !pack) throw new Error('Configure the IMPERIVM collection and pack type in this iDos title.');
  const cost = pack.PriceOptions?.[IDOS_CONFIG.payment]?.Cost;
  const entries = cost?.Standard?.Entries;
  if (pack.CollectibleCount !== 5 || !entries || entries.length !== 1 || entries[0].Type !== 'VirtualCurrency' || entries[0].CurrencyID !== IDOS_CONFIG.currency || entries[0].Amount !== PACK_COST || cost?.Standard?.EventTokens?.length || cost?.PremiumTiers?.length || cost?.PremiumDiscounts?.length) throw new Error('The pack must grant 5 cards and cost exactly 50 virtual RUG. Crypto payments are disabled.');
}
function unwrap<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(`iDos ${result.reason}: ${result.error}`);
  return result.data;
}
/** Real SDK calls, loaded only when a genuine Title ID is configured. */
export class IDosCollectionGateway implements CollectionGateway {
  private client: IDosGamesClient;
  private initialized: Promise<void> | null = null;
  private inFlight = false;
  constructor() {
    if (!IDOS_CONFIG.title) throw new Error('iDos Title ID is not configured.');
    this.client = createIDosGamesClient({ titleID: IDOS_CONFIG.title, platform: new BrowserPlatformAdapter(), debugLogging: false });
  }
  private async init() {
    if (!this.initialized) this.initialized = (async () => {
      unwrap(await this.client.auth.loginWithDeviceID());
      const defs = unwrap(await this.client.collection.getDefinitions());
      validateIDosDefinitions(defs);
    })().catch(error => { this.initialized = null; throw error; });
    await this.initialized;
  }
  async load(): Promise<CollectionSnapshot> {
    await this.init();
    const state = unwrap(await this.client.collection.getUserState());
    const rug = this.client.data.user.getVirtualCurrencyAmount(IDOS_CONFIG.currency);
    if (!Number.isFinite(rug) || rug < 0) throw new Error('iDos returned an invalid RUG balance.');
    return { mode: 'idos', rug, owned: cleanOwned(state.OwnedCollectibles), packsOpened: 0 };
  }
  async openPack(): Promise<PackResult> {
    if (this.inFlight) throw new Error('A pack is already opening.');
    this.inFlight = true;
    try {
      await this.init();
      validateIDosDefinitions(unwrap(await this.client.collection.getDefinitions()));
      // The backend charges the configured virtual-currency price and grants cards atomically.
      const result = unwrap(await this.client.collection.openPack(IDOS_CONFIG.collection, IDOS_CONFIG.pack, 1, { selectedOptionID: IDOS_CONFIG.payment }));
      const drops = result.Packs?.flatMap(pack => [...(pack.GrantedCollectibles ?? []), ...(pack.DuplicateCollectibles ?? [])]) ?? [...(result.GrantedCollectibles ?? []), ...(result.DuplicateCollectibles ?? [])];
      const cards = drops.map(drop => CARDS[drop.CollectibleID]).filter(Boolean);
      const snapshot = await this.load();
      if (!cards.length) throw new Error('The pack was processed by iDos, but its card IDs do not match IMPERIVM. Refresh the collection; do not repurchase automatically.');
      return { cards, snapshot };
    } finally { this.inFlight = false; }
  }
  async submitLeaderboardScore(score: number) {
    if (!IDOS_CONFIG.leaderboard) throw new Error('iDos leaderboard is not configured.');
    await this.init();
    return unwrap(await this.client.leaderboard.submitScore(IDOS_CONFIG.leaderboard, score));
  }
}
