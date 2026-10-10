import type { IDosGamesClient, CollectionDefinitions, OpenPackResponse } from '@idosgames/core';
import type { IDosRuntime } from '../idos/client';
import { idosResult as unwrap } from '../idos/auth';
import { CARDS } from '../cards';
import { PACK_CARD_IDS, withFreeCards } from './access';
import { cleanOwned, IDOS_CONFIG, REAL_PACK_COST, RARITY_WEIGHTS,REAL_RULER_CASE_COST,rulerCollectible,heroesFromCollectibles,type RulerCaseResult, type CollectionGateway, type CollectionSnapshot, type PackResult } from './gateway';
import {CASE_HERO_IDS} from '../heroes';
import {validateImpToken} from '../idos/token';
import {IMPERIVM_TITLE} from '../idos/title';
import {COMMERCE_CONFIG, cryptoAffordable} from '../idos/commerce';
import {PackPaymentReceipt} from './paymentReceipt';
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
  if (pack.CollectibleCount !== 5 || !entries || entries.length !== 1 || entries[0].Type !== IDOS_CONFIG.currencyType || entries[0].CurrencyID !== IDOS_CONFIG.currency || entries[0].Amount !== REAL_PACK_COST || entries[0].AmountUsd != null || cost?.Standard?.EventTokens?.length || cost?.PremiumTiers?.length || cost?.PremiumDiscounts?.length) throw new Error(`The pack must grant 5 cards and cost exactly ${REAL_PACK_COST} IMP in the configured currency.`);
  const ids = defs.Collections[IDOS_CONFIG.collection].Sets?.flatMap(set => set.Collectibles?.map(card => card.CollectibleID) ?? []) ?? [];
  const rulers=CASE_HERO_IDS.map(rulerCollectible),cardIds=ids.filter(id=>!rulers.includes(id??''));
  if (cardIds.length !== PACK_CARD_IDS.length || new Set(ids).size !== ids.length || cardIds.some(id => typeof id !== 'string' || !PACK_CARD_IDS.includes(id))) throw new Error('The Agora pack collection must contain exactly the 50 pack-exclusive cards. Free cards must not drop from paid packs.');
  const collectibles = defs.Collections[IDOS_CONFIG.collection].Sets?.flatMap(set => set.Collectibles ?? []) ?? [];
  if (collectibles.some(card => card.HasSpecialVersion || card.Rarity !== (rulers.includes(card.CollectibleID??'')?5:IDOS_RARITIES[CARDS[card.CollectibleID!].rarity])) ||
      RARITY_WEIGHTS.some(({rarity, weight}) => pack.RarityWeights?.[IDOS_RARITIES[rarity]] !== weight) ||
      Object.entries(pack.RarityWeights ?? {}).some(([rarity, weight]) => !['1', '2', '3', '4'].includes(rarity) && weight !== 0) ||
      (pack.GuaranteedMinRarity ?? 1) !== 1 || pack.GuaranteeMaxRarity || pack.BonusRewardSlots?.length || pack.PityRules?.length || pack.Presets?.BonusRewardSlots || pack.Presets?.PityRules) throw new Error('Agora rarity settings must match the displayed 60/25/11/4 odds, without bonus slots or special versions.');
  if ([1, 2, 3, 4].some(rarity => !defs.DuplicateConversions?.some(entry => entry.Rarity === rarity && Number.isSafeInteger(entry.CollectionCurrencyGranted) && entry.CollectionCurrencyGranted! > 0))) throw new Error('Configure collection-currency compensation for duplicate Agora cards of every rarity.');
}
export function validateRulerCase(defs:CollectionDefinitions){
  validateIDosDefinitions(defs);const pack=defs.PackTypes?.[IDOS_CONFIG.rulerCase],cost=pack?.PriceOptions?.[IDOS_CONFIG.payment]?.Cost,entries=cost?.Standard?.Entries;
  const ids=defs.Collections?.[IDOS_CONFIG.collection]?.Sets?.flatMap(set=>set.Collectibles?.map(card=>card.CollectibleID)??[])??[];
  if(!pack||CASE_HERO_IDS.some(id=>!ids.includes(rulerCollectible(id)))||pack.CollectibleCount!==1||!entries||entries.length!==1||entries[0].Type!==IDOS_CONFIG.currencyType||entries[0].CurrencyID!==IDOS_CONFIG.currency||entries[0].Amount!==REAL_RULER_CASE_COST||entries[0].AmountUsd!=null||cost?.Standard?.EventTokens?.length||cost?.PremiumTiers?.length||cost?.PremiumDiscounts?.length||pack.RarityWeights?.[5]!==100||Object.entries(pack.RarityWeights??{}).some(([rarity,weight])=>rarity!=='5'&&weight!==0)||(pack.GuaranteedMinRarity??5)!==5||pack.GuaranteeMaxRarity||pack.BonusRewardSlots?.length||pack.PityRules?.length||pack.Presets?.BonusRewardSlots||pack.Presets?.PityRules||!defs.DuplicateConversions?.some(entry=>entry.Rarity===5&&entry.CollectionCurrencyGranted===100))throw new Error('Кейсы правителей iDos ещё не настроены: 1 правитель за 900000 IMP, по 25%, повтор — 100 валюты коллекции.');
}
/** Uses the app's authenticated client; it never logs in or creates an SDK client. */
export class IDosCollectionGateway implements CollectionGateway {
  private inFlight = false;
  private receipt(client: IDosGamesClient) {
    const userId = client.auth.context?.userID;
    if (!userId) throw new Error('Для покупки войдите в iDos.');
    if (!IDOS_CONFIG.title) throw new Error('iDos title is not configured.');
    return new PackPaymentReceipt(IDOS_CONFIG.title, userId);
  }
  private async locked<T>(client: IDosGamesClient, work: () => Promise<T>): Promise<T> {
    const userId = client.auth.context?.userID;
    if (!userId || typeof navigator === 'undefined' || !navigator.locks) throw new Error('Покупка требует браузер с безопасной блокировкой платежей между вкладками. Обновите браузер.');
    return await navigator.locks.request(`imperivm.pack-payment:${IDOS_CONFIG.title}:${userId}`, work);
  }
  constructor(private readonly runtime: IDosRuntime) {}
  private async read(client: IDosGamesClient): Promise<CollectionSnapshot> {
    validateIDosDefinitions(unwrap(await client.collection.getDefinitions({forceRefresh: true})));
    if (IDOS_CONFIG.currencyType === 'CryptoCurrency') unwrap(await client.blockchain.getUserState());
    else unwrap(await client.cache.ensureState(['VirtualCurrencies'], { force: true }));
    const state = unwrap(await client.collection.getUserState());
    if (state.CollectionID !== IDOS_CONFIG.collection) throw new Error('The active iDos collection must be IMPERIVM Agora.');
    const raw = IDOS_CONFIG.currencyType === 'CryptoCurrency' ? client.data.user.getCryptoCurrencyAmount(IDOS_CONFIG.currency) : String(client.data.user.getVirtualCurrencyAmount(IDOS_CONFIG.currency));
    if (!/^\d+(?:\.\d{1,6})?$/.test(raw)) throw new Error('iDos returned an invalid IMP balance.');
    const rug = Number(raw);
    if (!Number.isFinite(rug) || rug > Number.MAX_SAFE_INTEGER || rug < 0) throw new Error('iDos returned an invalid IMP balance.');
    const collectionCurrency = state.CollectionCurrencyBalance ?? 0;
    if (!Number.isSafeInteger(collectionCurrency) || collectionCurrency < 0) throw new Error('iDos returned an invalid collection-currency balance.');
    const payment = this.receipt(client);
    // Only a saved successful receipt can be reconciled by a fresh server collection.
    let purchaseBlocked: string | undefined;
    try {
      if (payment.status() === 'accepted') payment.clear();
      if (payment.status() === 'pending') purchaseBlocked = 'Предыдущая покупка не подтверждена. Новое списание заблокировано. Проверьте историю операций iDos; автоматического повтора не будет.';
    } catch (error) {purchaseBlocked = error instanceof Error ? error.message : 'Платёжный статус недоступен.';}
    return { mode: 'idos', rug, exactBalance: raw, purchaseBlocked, owned: withFreeCards(cleanOwned(state.OwnedCollectibles)), packsOpened: 0, collectionCurrency,heroes:heroesFromCollectibles(state.OwnedCollectibles) };
  }
  load(): Promise<CollectionSnapshot> { return this.runtime.withAccount(client => this.read(client)); }
  async openPack(): Promise<PackResult> {
    if (this.inFlight) throw new Error('A pack is already opening.');
    this.inFlight = true;
    try {
      return await this.runtime.withAccount(client => this.locked(client, async () => {
        if (IDOS_CONFIG.title === IMPERIVM_TITLE.id && IDOS_CONFIG.currencyType === 'CryptoCurrency') validateImpToken({CryptoCurrencies: unwrap(await client.blockchain.getDefinitions({forceRefresh: true})).CryptoCurrencies});
        validateIDosDefinitions(unwrap(await client.collection.getDefinitions({forceRefresh: true})));
        if (!COMMERCE_CONFIG.enabled) throw new Error('Покупки за реальные IMP временно выключены.');
        const before = await this.read(client);
        if (!cryptoAffordable(before.exactBalance!, String(REAL_PACK_COST))) throw new Error(`Для пака нужно ${REAL_PACK_COST} IMP на игровом счёте. Сначала переведите выбранную сумму из кошелька.`);
        const payment = this.receipt(client);
        payment.begin(IDOS_CONFIG.pack, REAL_PACK_COST);
        // No retry: a lost reply can still mean a completed server-side debit.
        const result = unwrap(await client.collection.openPack(IDOS_CONFIG.collection, IDOS_CONFIG.pack, 1, { selectedOptionID: IDOS_CONFIG.payment }));
        const drops = idosPackDrops(result);
        const cards = drops.map(drop => CARDS[drop.CollectibleID]).filter(Boolean);
        if (drops.length !== 5 || cards.length !== 5 || cards.some(card => !PACK_CARD_IDS.includes(card.id))) throw new Error('The pack was processed by iDos, but its card IDs do not match IMPERIVM. Refresh the collection; do not repurchase automatically.');
        payment.accept();
        const snapshot = await this.read(client);
        return { cards, snapshot, duplicates: drops.map(drop => drop.IsDuplicate === true) };
      }));
    } finally { this.inFlight = false; }
  }
  async openRulerCase():Promise<RulerCaseResult>{
    if(!IDOS_CONFIG.rulerCasesEnabled)throw new Error('Кейсы iDos откроются после проверки настроек и шансов на платформе.');
    if(this.inFlight)throw new Error('A pack is already opening.');this.inFlight=true;
    try{return await this.runtime.withAccount(client=>this.locked(client,async()=>{
      if (IDOS_CONFIG.title === IMPERIVM_TITLE.id && IDOS_CONFIG.currencyType === 'CryptoCurrency') validateImpToken({CryptoCurrencies: unwrap(await client.blockchain.getDefinitions({forceRefresh: true})).CryptoCurrencies});
      validateRulerCase(unwrap(await client.collection.getDefinitions({forceRefresh: true})));
      if (!COMMERCE_CONFIG.enabled) throw new Error('Покупки за реальные IMP временно выключены.');
      const before = await this.read(client);
      if (!cryptoAffordable(before.exactBalance!, String(REAL_RULER_CASE_COST))) throw new Error('Для кейса нужно 900000 IMP на игровом счёте.');
      const payment = this.receipt(client); payment.begin(IDOS_CONFIG.rulerCase, REAL_RULER_CASE_COST);
      const receipt=unwrap(await client.collection.openPack(IDOS_CONFIG.collection,IDOS_CONFIG.rulerCase,1,{selectedOptionID:IDOS_CONFIG.payment}));
      const drops=idosPackDrops(receipt),heroId=CASE_HERO_IDS.find(id=>rulerCollectible(id)===drops[0]?.CollectibleID);
      if(drops.length!==1||!heroId)throw new Error('Кейс обработан, но правитель ещё не подтверждён. Обновите коллекцию; не покупайте повторно автоматически.');
      payment.accept();
      const snapshot=await this.read(client);
      if(drops.length!==1||!heroId||!snapshot.heroes?.includes(heroId))throw new Error('Кейс обработан, но правитель ещё не подтверждён. Обновите коллекцию; не покупайте повторно автоматически.');
      return {heroId,duplicate:drops[0].IsDuplicate===true,snapshot};
    }));}finally{this.inFlight=false;}
  }
}
