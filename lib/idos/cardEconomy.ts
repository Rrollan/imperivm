import type {ItemDefinitions, LootboxDefinitions, LootboxRewardRoll, MarketplaceDefinitions, ResourceOperation} from '@idosgames/core';
export {cardItemCounts} from './cardInventory';
import {CARDS} from '../cards';
import {PACK_CARD_IDS} from '../collection/access';
import {REAL_PACK_COST} from '../collection/gateway';

export const CARD_ITEM_CATALOG_ID = 'IMPERIVM_CARDS_V1';
export const CARD_PACK_LOOTBOX_ID = 'AGORA_TRADABLE_PACK_V1';
export const LEGENDARY_PACK_PROBABILITY = '0.0001%';
const rarityWeight = {common:60, rare:25, epic:11, legendary:0};

export function buildCardItemDefinitions(): ItemDefinitions {
  return {Catalogs:{[CARD_ITEM_CATALOG_ID]:{Items:Object.fromEntries(Object.values(CARDS).map(card => [card.id, {
    ItemID:card.id, CatalogID:CARD_ITEM_CATALOG_ID, ItemClass:'IMPERIVMCard', DisplayName:card.name,
    Description:card.text, IsStackable:true, IsTradable:true,
    Tags:['imperivm-card',card.rarity,card.faction], CustomData:{CardID:card.id},
  }]))}}};
}
function itemReward(cardId:string, weight:number): LootboxRewardRoll {
  return {Weight:weight, Reward:{Standard:{Entries:[{Type:'Item',CatalogID:CARD_ITEM_CATALOG_ID,ItemID:cardId,Amount:1}]}}};
}
/** Four ordinary rolls and ONE rare roll: at most one legendary; exactly 4 / 4,000,000 per pack. */
export function buildCardLootboxDefinitions(): LootboxDefinitions {
  const ordinary = PACK_CARD_IDS.filter(id=>CARDS[id].rarity!=='legendary');
  const legendary = PACK_CARD_IDS.filter(id=>CARDS[id].rarity==='legendary');
  if(legendary.length!==4) throw new Error('The one-in-a-million pack requires exactly four legendary card IDs.');
  const counts = Object.fromEntries(['common','rare','epic'].map(r=>[r,ordinary.filter(id=>CARDS[id].rarity===r).length]));
  // LCM(22,16,8)=176: ordinary rolls retain the previous conditional 60:25:11 rarity distribution.
  const normal = ordinary.map(id=>itemReward(id,rarityWeight[CARDS[id].rarity]*176/counts[CARDS[id].rarity]));
  if(normal.some(row=>!Number.isSafeInteger(row.Weight)||row.Weight!<=0)) throw new Error('Card rarity counts changed; rebuild the integer ordinary pool.');
  const target = 3_999_996;
  const fractions = ordinary.map(id=>({id, exact:target*rarityWeight[CARDS[id].rarity]/(96*counts[CARDS[id].rarity])}));
  const weights = new Map(fractions.map(x=>[x.id,Math.floor(x.exact)]));
  const remaining=target-Array.from(weights.values()).reduce((a,b)=>a+b,0);
  fractions.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||a.id.localeCompare(b.id));
  for(let i=0;i<remaining;i++) weights.set(fractions[i].id,weights.get(fractions[i].id)!+1);
  const rare = [...ordinary.map(id=>itemReward(id,weights.get(id)!)),...legendary.map(id=>itemReward(id,1))];
  return {Definitions:{[CARD_PACK_LOOTBOX_ID]:{
    LootboxID:CARD_PACK_LOOTBOX_ID, MaxOpenCount:1,
    PriceOptions:{IMP:{OptionID:'IMP',Cost:{Standard:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:REAL_PACK_COST}]}}}},
    RewardSlots:[...Array.from({length:4},(_,i)=>({SlotID:`ordinary-${i+1}`,MinRolls:1,MaxRolls:1,Pool:normal})),
      {SlotID:'legendary-opportunity',MinRolls:1,MaxRolls:1,Pool:rare}],
    PityRules:[], SupplyLimits:[],
  }}};
}
export function buildCardMarketplaceDefinitions(): MarketplaceDefinitions {
  return {Enabled:true,PricePolicy:{AllowCryptoCurrency:true,AllowVirtualCurrency:false,AllowItems:false,AllowEventTokens:false,Allowed:[{Kind:'CryptoCurrency',CurrencyID:'Main',MinAmount:1,MaxAmount:1_000_000_000_000}],MaxPositions:1},
    Tradability:{AllowedCatalogIDs:[CARD_ITEM_CATALOG_ID],AllowUnstackableWithState:false},
    Listings:{Enabled:true,AllowedDurationsHours:[24,72,168],MaxActiveListings:20},
    Auctions:{Enabled:false},BuyOrders:{Enabled:false},DirectTrades:{Enabled:false},Matching:{Enabled:false},
    Commission:{Percent:0,MinPerPosition:0,Sink:'Ledger'},
  };
}
export function validateCardItemDefinitions(defs:ItemDefinitions):void {
  const items=defs.Catalogs?.[CARD_ITEM_CATALOG_ID]?.Items;
  if(!items||Object.keys(items).length!==Object.keys(CARDS).length)throw new Error('Каталог продаваемых карт ещё не настроен на iDos.');
  for(const [catalogId,catalog] of Object.entries(defs.Catalogs??{}))if(catalogId!==CARD_ITEM_CATALOG_ID&&Object.keys(catalog.Items??{}).some(id=>Object.hasOwn(CARDS,id)))throw new Error('Идентификаторы продаваемых карт конфликтуют с другим каталогом iDos.');
  for(const card of Object.values(CARDS)) {
    const item=items[card.id];
    if(!item||item.ItemID!==card.id||item.CatalogID!==CARD_ITEM_CATALOG_ID||item.IsStackable!==true||item.IsTradable!==true||item.CustomData?.CardID!==card.id||item.NFT||item.ExpirationDurationSeconds||item.MaxSupply||item.Equipment||item.Upgrade)
      throw new Error('Каталог продаваемых карт не соответствует IMPERIVM.');
  }
}
function stable(value:unknown):string {
  const sort=(v:any):any=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!=null).map(k=>[k,sort(v[k])])):v;
  return JSON.stringify(sort(value));
}
/** Default display metadata/null fields added by the platform do not affect drops. */
function lootboxEconomics(defs:LootboxDefinitions):unknown {
  const pack=defs.Definitions?.[CARD_PACK_LOOTBOX_ID];if(!pack)return null;
  return {priceOptions:pack.PriceOptions,rewardSlots:pack.RewardSlots};
}
export function validateCardLootboxDefinitions(defs:LootboxDefinitions):void {
  const pack=defs.Definitions?.[CARD_PACK_LOOTBOX_ID];
  if(!pack||pack.MaxOpenCount!==1||pack.RewardMultiplier||pack.Presets||pack.PityRules?.length||pack.SupplyLimits?.length||
    stable(lootboxEconomics(defs))!==stable(lootboxEconomics(buildCardLootboxDefinitions())))
    throw new Error('Пак iDos должен содержать пять карт и точный шанс легендарной 0,0001% на весь пак.');
}
export function itemPackDrops(operation:ResourceOperation|undefined|null):string[] {
  if(operation?.Grant?.PremiumBonuses?.length||operation?.Grant?.PremiumTiers?.length||operation?.Grant?.Standard?.EventTokens?.length)throw new Error('Получен неожиданный результат пака iDos.');
  const cards:string[]=[];
  for(const entry of operation?.Grant?.Standard?.Entries??[]) {
    if(entry.Type!=='Item'||entry.CatalogID!==CARD_ITEM_CATALOG_ID||!entry.ItemID||!PACK_CARD_IDS.includes(entry.ItemID)||!Number.isSafeInteger(entry.Amount)||entry.Amount!<1||entry.Amount!>5)throw new Error('Результат пака iDos не соответствует карточному каталогу.');
    cards.push(...Array(entry.Amount!).fill(entry.ItemID));
  }
  if(cards.length!==5||cards.filter(id=>CARDS[id].rarity==='legendary').length>1)throw new Error('iDos должен подтвердить ровно пять карт из пака.');
  return cards;
}
