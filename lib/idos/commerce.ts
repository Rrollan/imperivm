import type { BlockchainConfigResponse, CurrencyDefinitions, GetStorefrontResponse, IDosGamesClient, StorefrontPriceOptionView, StorePurchaseResponse } from '@idosgames/core';
import type { IDosRuntime } from './client';
import { idosResult } from './auth';
import { IDOS_CONFIG } from '../collection/gateway';

export const COMMERCE_CONFIG = {
  enabled: process.env.NEXT_PUBLIC_IDOS_COMMERCE_ENABLED === 'true',
  store: process.env.NEXT_PUBLIC_IDOS_IMP_STORE_ID || process.env.NEXT_PUBLIC_IDOS_RUG_STORE_ID || 'IMPERIVM_IMP',
  network: process.env.NEXT_PUBLIC_IDOS_COMMERCE_NETWORK_ID || 'SOLANA_MAINNET',
  sol: process.env.NEXT_PUBLIC_IDOS_SOL_CURRENCY_ID || 'SOL',
  usdc: process.env.NEXT_PUBLIC_IDOS_USDC_CURRENCY_ID || 'USDC',
  appUrl: platformAppUrl(process.env.NEXT_PUBLIC_IDOS_APP_URL),
};
export function platformAppUrl(value?: string): string | null {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && url.hostname === 'idosgames.com' && !url.username && !url.password && !url.port && /^\/app\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) && !url.search && !url.hash ? url.href : null; } catch { return null; }
}
export const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export interface RugOffer {
  key: string; offerId: string; optionId: string; rug: number; amount: string; currencyId: string;
  symbol: 'SOL' | 'USDC'; balance: string; purchasedTotal: number; soldOut: boolean;
  slot: {storeID: string; sectionID: string; slotID: string};
}
export function validateCommerceCurrencies(currency: CurrencyDefinitions, blockchain: BlockchainConfigResponse): void {
  const network = blockchain.Blockchain?.Networks?.[COMMERCE_CONFIG.network];
  if (network?.Type !== 'Solana' || network.RpcUrl?.replace(/\/$/, '') !== 'https://api.mainnet-beta.solana.com') throw new Error('Configure Solana mainnet for the IMP shop. Test balances cannot pay real offers.');
  for (const [id, mint, decimals] of [[COMMERCE_CONFIG.sol, '', 9], [COMMERCE_CONFIG.usdc, SOLANA_USDC_MINT, 6]] as const) {
    const def = currency.CryptoCurrencies?.[id], bindings = def?.Networks;
    const binding = bindings?.find(item => item.NetworkID === COMMERCE_CONFIG.network);
    if (!def || (def.Status != null && def.Status !== 'Active') || def.Permissions?.SpendableInGame !== true || bindings?.length !== 1 || !binding || (binding.ContractAddress ?? '') !== mint || binding.Decimals !== decimals) throw new Error('The IMP shop requires native SOL and Circle USDC on Solana mainnet only.');
  }
}
function price(option: StorefrontPriceOptionView): {currencyId: string; amount: string; symbol: 'SOL' | 'USDC'} | null {
  const cost = option.Cost, entries = cost?.Standard?.Entries;
  if (option.IsFree || option.IsAdPaid || option.IsStorePaid || !entries || entries.length !== 1 || cost?.Standard?.EventTokens?.length || cost?.PremiumTiers?.length || cost?.PremiumDiscounts?.length) return null;
  const entry = entries[0];
  const symbol = entry.CurrencyID === COMMERCE_CONFIG.sol ? 'SOL' : entry.CurrencyID === COMMERCE_CONFIG.usdc ? 'USDC' : null;
  if (!symbol || entry.Type !== 'CryptoCurrency' || typeof entry.Amount !== 'number' || !Number.isFinite(entry.Amount) || entry.Amount <= 0 || entry.AmountUsd != null || entry.ProductID != null || entry.CatalogID != null || entry.ItemID != null) return null;
  // SDK storefront prices are numbers. Reject values that need more precision than the asset has.
  const decimals = symbol === 'SOL' ? 9 : 6;
  const amount = entry.Amount.toFixed(decimals).replace(/\.?0+$/, '');
  if (Number(amount) !== entry.Amount || !/^\d+(?:\.\d+)?$/.test(amount) || amount === '0') return null;
  return {currencyId: entry.CurrencyID!, amount, symbol};
}
export function rugOffers(front: GetStorefrontResponse, balance: (id: string) => string): RugOffer[] {
  const offers: RugOffer[] = [];
  for (const store of front.Stores ?? []) {
    if (store.StoreID !== COMMERCE_CONFIG.store) continue;
    for (const section of store.Sections ?? []) for (const slot of section.Slots ?? []) {
      const offer = slot.Offer, grant = offer?.Rewards, entries = grant?.Standard?.Entries;
      if (!offer || !entries || entries.length !== 1 || entries[0].Type !== 'VirtualCurrency' || entries[0].CurrencyID !== IDOS_CONFIG.currency || !Number.isSafeInteger(entries[0].Amount) || entries[0].Amount! <= 0 || grant?.Standard?.EventTokens?.length || grant?.PremiumBonuses?.length || grant?.PremiumTiers?.length) continue;
      if (!offer.State || !Number.isSafeInteger(offer.State.PurchasedTotal) || offer.State.PurchasedTotal < 0) continue;
      for (const option of offer.PriceOptions ?? []) {
        const payment = price(option); if (!payment) continue;
        const value = balance(payment.currencyId);
        if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('iDos returned an invalid crypto balance.');
        offers.push({key: [store.StoreID, section.SectionID, slot.SlotID, offer.OfferID, option.OptionID].join(':'),
          offerId: offer.OfferID, optionId: option.OptionID, rug: entries[0].Amount!, ...payment, balance: value,
          purchasedTotal: offer.State.PurchasedTotal,
          soldOut: offer.State.SoldOut || offer.State.RemainingTotal === 0 || offer.State.RemainingToday === 0 || slot.RemainingThisRotation === 0 || !!offer.State.AvailableAtUtc,
          slot: {storeID: store.StoreID, sectionID: section.SectionID, slotID: slot.SlotID}});
      }
    }
  }
  return offers;
}
/** Compare decimal strings without rounding a balance through a JS float. */
export function cryptoAffordable(balance: string, amount: string): boolean {
  if (![balance, amount].every(value => /^\d+(?:\.\d+)?$/.test(value))) return false;
  const split = (value: string) => {const [whole, fraction = ''] = value.split('.'); return [whole.replace(/^0+(?=\d)/, ''), fraction] as const;};
  const [a, af] = split(balance), [b, bf] = split(amount);
  if (a.length !== b.length) return a.length > b.length;
  if (a !== b) return a > b;
  const digits = Math.max(af.length, bf.length); return af.padEnd(digits, '0') >= bf.padEnd(digits, '0');
}
export class RugCommerce {
  private locked = false;
  private readonly account: string | null;
  constructor(private runtime: Pick<IDosRuntime, 'withAccount' | 'getSnapshot'>, private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {this.account = runtime.getSnapshot().userId;}
  private pendingKey(userId: string): string { return `imperivm.rug-purchase.v1.${IDOS_CONFIG.title}.${userId}`; }
  pending(): RugOffer | null {
    const id = this.runtime.getSnapshot().userId; if (!id) return null;
    try { const raw: unknown = JSON.parse(this.storage.getItem(this.pendingKey(id)) || 'null');
      if (raw && typeof raw === 'object' && 'offerId' in raw && 'purchasedTotal' in raw && typeof raw.offerId === 'string' && Number.isSafeInteger(raw.purchasedTotal)) return raw as RugOffer;
      if (raw !== null) throw new Error('Invalid pending purchase.');
    } catch { throw new Error('Purchase recovery storage is unavailable.'); }
    return null;
  }
  private async read(client: IDosGamesClient): Promise<RugOffer[]> {
    if (!this.account || this.runtime.getSnapshot().userId !== this.account) throw new Error('The account changed. Please open the IMP shop again.');
    const currency = idosResult(await client.title.getCurrencyDefinitions());
    const blockchain = idosResult(await client.blockchain.getDefinitions());
    validateCommerceCurrencies(currency, blockchain);
    idosResult(await client.blockchain.getUserState());
    return rugOffers(idosResult(await client.store.getStorefront({forceRefresh: true})), id => client.data.user.getCryptoCurrencyAmount(id));
  }
  load(): Promise<RugOffer[]> { return this.runtime.withAccount(async client => {
    const offers = await this.read(client), pending = this.pending(), id = this.runtime.getSnapshot().userId;
    if (pending && id && offers.some(offer => offer.offerId === pending.offerId && offer.purchasedTotal > pending.purchasedTotal)) this.storage.removeItem(this.pendingKey(id));
    return offers;
  }); }
  async buy(selected: RugOffer): Promise<StorePurchaseResponse> {
    if (!COMMERCE_CONFIG.enabled) throw new Error('IMP purchases are not enabled yet.');
    if (this.locked) throw new Error('An IMP purchase is already processing.');
    this.locked = true;
    try {
      const purchase = () => this.runtime.withAccount(async client => {
        if (this.runtime.getSnapshot().status !== 'wallet') throw new Error('Sign in to iDos with your wallet before buying IMP.');
        if (this.pending()) throw new Error('A previous IMP purchase is awaiting confirmation. Refresh its status; do not pay again.');
        const current = (await this.read(client)).find(item => item.key === selected.key);
        if (!current || current.soldOut || current.rug !== selected.rug || current.amount !== selected.amount || current.currencyId !== selected.currencyId || current.purchasedTotal !== selected.purchasedTotal) throw new Error('The offer changed. Refresh the shop and confirm the new price.');
        if (!cryptoAffordable(current.balance, current.amount)) throw new Error('Top up SOL or USDC in the iDos wallet first, then refresh the shop.');
        const user = this.runtime.getSnapshot().userId;
        if (!user) throw new Error('Sign in to iDos with your wallet before buying IMP.');
        const key = this.pendingKey(user);
        // Persist BEFORE spending, and refuse to spend if recovery cannot be saved.
        this.storage.setItem(key, JSON.stringify(current));
        // The backend charges crypto and grants virtual IMP in one transaction. No local credit.
        const result = await client.store.purchase(current.offerId, 1, {selectedOptionID: current.optionId, slot: current.slot});
        if (result.ok) {
          const reward = result.data.Resources?.Grant?.Standard?.Entries, charge = result.data.Resources?.Consume?.Standard?.Entries;
          if (result.data.OfferID !== current.offerId || result.data.Count !== 1 || reward?.length !== 1 || reward[0].Type !== 'VirtualCurrency' || reward[0].CurrencyID !== IDOS_CONFIG.currency || reward[0].Amount !== current.rug || charge?.length !== 1 || charge[0].Type !== 'CryptoCurrency' || charge[0].CurrencyID !== current.currencyId || charge[0].Amount !== Number(current.amount)) throw new Error('The purchase was processed, but its receipt could not be confirmed. Refresh its status; do not pay again.');
        }
        // A generic server failure can also mean a malformed response AFTER a charge.
        // Only errors known to precede execution may unlock a new purchase automatically.
        if (result.ok || ['client', 'unauthorized', 'throttled'].includes(result.reason)) this.storage.removeItem(key);
        return idosResult(result);
      });
      const key = this.pendingKey(this.runtime.getSnapshot().userId || 'guest');
      return typeof navigator !== 'undefined' && navigator.locks ? await navigator.locks.request(key, purchase) : await purchase();
    } finally { this.locked = false; }
  }
}
