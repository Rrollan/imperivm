import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {IDosGamesClient,MarketplaceOfferView,MarketplaceHistoryEntryView,UserInventoryState} from '@idosgames/core';
import type {IDosRuntime} from '../../lib/idos/client';
import {CARDS} from '../../lib/cards';
import {PACK_CARD_IDS,freeCardCounts} from '../../lib/collection/access';
import {CARD_ITEM_CATALOG_ID,CARD_PACK_LOOTBOX_ID,buildCardItemDefinitions,buildCardLootboxDefinitions,buildCardMarketplaceDefinitions,validateCardItemDefinitions,validateCardLootboxDefinitions,cardItemCounts,itemPackDrops} from '../../lib/idos/cardEconomy';
import {CardMarketService,cardMarketPrice,cardMarketListing,cardMarketTrade,cardMarketStats} from '../../lib/idos/cardMarket';
import {IDosCardItemGateway} from '../../lib/collection/itemGateway';
import {COMMERCE_CONFIG} from '../../lib/idos/commerce';
import {IDOS_CONFIG,REAL_PACK_COST} from '../../lib/collection/gateway';
import {IMPERIVM_TITLE} from '../../lib/idos/title';

const ok=<T>(data:T)=>({ok:true as const,data});
const id=PACK_CARD_IDS[0],freeId=Object.keys(freeCardCounts())[0];
const catalog=buildCardItemDefinitions(),boxes=buildCardLootboxDefinitions();
validateCardItemDefinitions(catalog);validateCardLootboxDefinitions(boxes);
assert.equal(Object.keys(catalog.Catalogs![CARD_ITEM_CATALOG_ID].Items!).length,Object.keys(CARDS).length);
assert(catalog.Catalogs![CARD_ITEM_CATALOG_ID].Items![freeId], 'Catalog supports genuine copies of every card, including starter definitions');
const slots=boxes.Definitions![CARD_PACK_LOOTBOX_ID].RewardSlots!;
assert.equal(slots.length,5);
for(const slot of slots){assert.equal(slot.MinRolls,1);assert.equal(slot.MaxRolls,1);for(const row of slot.Pool!){assert(Number.isSafeInteger(row.Weight));assert(row.Weight!>0);assert(PACK_CARD_IDS.includes(row.Reward!.Standard!.Entries![0].ItemID!));}}
for(const slot of slots.slice(0,4))assert(slot.Pool!.every(row=>CARDS[row.Reward!.Standard!.Entries![0].ItemID!].rarity!=='legendary'));
const pool=slots[4].Pool!,total=pool.reduce((n,row)=>n+row.Weight!,0),legWeight=pool.filter(row=>CARDS[row.Reward!.Standard!.Entries![0].ItemID!].rarity==='legendary').reduce((n,row)=>n+row.Weight!,0);
assert.equal(total,4_000_000);assert.equal(legWeight,4);assert.equal(legWeight/total,1/1_000_000,'Exactly one-in-million per five-card pack; only one slot can roll legendary');
assert(slots.every(slot=>slot.Pool!.every(row=>row.Reward!.Standard!.Entries![0].ItemID!==freeId)));
const reordered=JSON.parse(JSON.stringify(boxes,(_k,v)=>v===undefined?null:v));
reordered.Definitions[CARD_PACK_LOOTBOX_ID].AssetPaths={Logo:'/safe-display.png'};validateCardLootboxDefinitions(reordered);
const badBoxes=structuredClone(boxes);badBoxes.Definitions![CARD_PACK_LOOTBOX_ID].RewardSlots![4].Pool![0].Weight!++;assert.throws(()=>validateCardLootboxDefinitions(badBoxes),/0,0001%/);
const collided=structuredClone(catalog);collided.Catalogs!.Other={Items:{[id]:catalog.Catalogs![CARD_ITEM_CATALOG_ID].Items![id]}};assert.throws(()=>validateCardItemDefinitions(collided),/конфликт/);
const inventory=(amounts:Record<string,number>):UserInventoryState=>({Items:Object.fromEntries(Object.entries(amounts).map(([key,n])=>[key,{StackableAmount:n,UnstackableAmount:0,TotalAmount:n}]))});
assert.deepEqual(cardItemCounts(inventory({})),{},'Free play rights never mint tradable stock');
assert.deepEqual(cardItemCounts(inventory({[id]:3})),{[id]:3});
assert.throws(()=>cardItemCounts({Items:{[id]:{StackableAmount:1,UnstackableAmount:1,TotalAmount:2}}}),/количество/);
assert.equal(itemPackDrops({Grant:{Standard:{Entries:[{Type:'Item',CatalogID:CARD_ITEM_CATALOG_ID,ItemID:id,Amount:5}]}}}).length,5);
assert.throws(()=>itemPackDrops({Grant:{Standard:{Entries:[{Type:'Item',CatalogID:'Other',ItemID:id,Amount:5}]}}}),/каталогу/);
for(const value of ['0','-1','1.1','1e6','01','1000000000001',' 5'])assert.throws(()=>cardMarketPrice(value));
assert.equal(cardMarketPrice('1000000000000'),'1000000000000');
const listing=(offerId:string,seller='seller',quantity=1,price=100):MarketplaceOfferView=>({OfferID:offerId,OfferType:'Listing',Status:'Active',CreatorUserID:seller,GoodsType:'Item',GoodsCatalogID:CARD_ITEM_CATALOG_ID,GoodsItemID:id,GoodsAmount:quantity,Price:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:price}]},ExpiresAt:'2099-01-01T00:00:00Z'});
const trade=(offerId:string,quantity=1,price=100,buyer='buyer'):MarketplaceHistoryEntryView=>({OfferID:offerId,OfferType:'Listing',FinalStatus:'Completed',GoodsType:'Item',GoodsCatalogID:CARD_ITEM_CATALOG_ID,GoodsItemID:id,GoodsAmount:quantity,PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:price}]},SellerUserID:'seller',BuyerUserID:buyer,CompletedAt:'2026-10-10T00:00:00Z'});
assert(cardMarketListing(listing('real')));assert.equal(cardMarketListing({...listing('bad'),GoodsCatalogID:'Other'}),null);
assert.equal(cardMarketTrade({...trade('bad'),FinalStatus:'Cancelled'}),null);assert.equal(cardMarketTrade(trade('self',1,100,'seller')),null);
assert.equal(cardMarketTrade({...trade('usd'),PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',AmountUsd:2}]}}),null);
const stats=cardMarketStats([cardMarketTrade(trade('one',2,101))!,cardMarketTrade(trade('two',1,100))!,cardMarketTrade(trade('one',2,101))!]);
assert.deepEqual(stats[id],{sampleSize:2,units:3,meanImp:'67',minImp:'50.5',maxImp:'100',scope:'personal'});

const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
const tails=new Map<string,Promise<unknown>>();
const lockNames:string[]=[];
const locks={request:async<T>(name:string,work:()=>Promise<T>)=>{lockNames.push(name);const task=(tails.get(name)??Promise.resolve()).then(work);tails.set(name,task.catch(()=>undefined));return task;}};
Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});
let user='buyer',wallet='wallet-A',owned:Record<string,number>={},balance='999999',myOffers:MarketplaceOfferView[]=[],claimables:MarketplaceOfferView[]=[],history:MarketplaceHistoryEntryView[]=[],offer=listing('sale'),market=buildCardMarketplaceDefinitions();
let creates=0,buys=0,cancels=0,reclaims=0,lostCreate=false,lostBuy=false,lostClaim=false;
const currency={CryptoCurrencies:{Main:{CurrencyID:'Main',Status:'Active',Permissions:{SpendableInGame:true},PlayerTradeFeePercent:0,Networks:[{NetworkID:IMPERIVM_TITLE.network,ContractAddress:IMPERIVM_TITLE.mint,Decimals:6}]}}};
const client={auth:{context:{get userID(){return user;}}},title:{getCurrencyDefinitions:async()=>ok(currency),getItemDefinitions:async()=>ok(catalog)},user:{getUserInventory:async()=>ok(inventory(owned))},data:{user:{getCryptoCurrencyAmount:()=>balance}},marketplace:{
 getDefinitions:async()=>ok({Definitions:market,IsOpenNow:true,GatePassed:true}),getGroupedOffers:async()=>ok({Groups:[{GoodsCatalogID:CARD_ITEM_CATALOG_ID,GoodsItemID:id}]}),
 getMyState:async()=>ok({MyOffers:myOffers,Claimables:claimables}),getHistory:async()=>ok({Entries:history}),getOffer:async()=>ok({Offer:offer}),getOffersByItem:async()=>ok({Offers:[offer]}),
 createListing:async(card:string,cat:string,quantity:number,price:unknown,duration:number)=>{creates++;assert.equal(cat,CARD_ITEM_CATALOG_ID);assert.equal(card,id);assert.equal(duration,72);assert.deepEqual(price,{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:50}]});owned[id]-=quantity;const made=listing('new-'+creates,user,quantity,50);myOffers.push(made);if(lostCreate)throw new Error('Lost create reply');return ok({Offer:made});},
 buy:async(offerId:string)=>{buys++;offer={...offer,Status:'Completed'};history.push(trade(offerId,1,100,user));if(lostBuy)throw new Error('Lost buy reply');return ok({OfferID:offerId,Status:'Completed',Settlement:{FromUserID:user,ToUserID:'seller'}});},
 cancelListing:async(offerId:string)=>{cancels++;offer={...offer,Status:'Cancelled'};return ok({OfferID:offerId,Status:'Cancelled'});},
 claimBack:async(offerId:string)=>{reclaims++;claimables=[];if(lostClaim)throw new Error('Lost claim reply');return ok({OfferID:offerId,Status:'Expired',Resources:{Grant:{Standard:{Entries:[{Type:'Item',CatalogID:CARD_ITEM_CATALOG_ID,ItemID:id,Amount:1}]}}}});}
}} as unknown as IDosGamesClient;
const runtime={getSnapshot:()=>({status:'wallet',userId:user,owner:wallet}),withAccount:async<T>(work:(c:IDosGamesClient)=>Promise<T>)=>work(client)} as unknown as IDosRuntime;
const service=()=>new CardMarketService(runtime,storage,true);
async function main(){
 assert.equal((await service().load()).ready,true);
 await assert.rejects(service().create(freeId,1,'50'),/продаваемых/);assert.equal(creates,0);
 owned={[id]:3};assert.equal((await service().create(id,1,'50')).quantity,1);assert.equal(creates,1);assert.equal(values.size,0);
 lostCreate=true;await assert.rejects(service().create(id,1,'50'),/Lost create/);assert.equal(creates,2);assert.equal(values.size,1);
 await assert.rejects(service().create(id,1,'50'),/не подтверждена/);assert.equal(creates,2);assert.equal(await service().recover(),true);assert.equal(values.size,0);lostCreate=false;
 offer=listing('sale');await assert.rejects(service().buy('sale','101'),/изменилось/);assert.equal(buys,0);
 balance='99.999999';await assert.rejects(service().buy('sale','100'),/Недостаточно/);assert.equal(buys,0);balance='999999';
 market.Commission={Percent:1};assert.equal((await service().load()).ready,false);await assert.rejects(service().buy('sale','100'),/комиссии/);assert.equal(buys,0);
 market=buildCardMarketplaceDefinitions();market.Commission!.PerCatalogOverrides={[CARD_ITEM_CATALOG_ID]:{MinPerPosition:1}};assert.equal((await service().load()).ready,false);
 market=buildCardMarketplaceDefinitions();market.PricePolicy!.AllowCryptoCurrency=false;assert.equal((await service().load()).ready,false);market=buildCardMarketplaceDefinitions();
 lostBuy=true;const first=service().buy('sale','100'),second=service().buy('sale','100');const results=await Promise.allSettled([first,second]);assert(results.every(x=>x.status==='rejected'));assert.equal(buys,1,'Cross-tab/service lock plus journal prevents a second unknown payment');
 history=[trade('sale',1,100,'other-buyer')];assert.equal(await service().recover(),false);history=[trade('sale',1,101,user)];assert.equal(await service().recover(),false,'A mismatching paid amount cannot clear pending');history=[trade('sale',1,100,user)];assert.equal(await service().recover(),true);assert.equal(values.size,0);
 const stale=service();wallet='wallet-B';await assert.rejects(stale.load(),/кошельком/);wallet='wallet-A';
 offer=listing('mine',user);assert.equal((await new CardMarketService(runtime,storage,false).cancel('mine')).Status,'Cancelled');assert.equal(cancels,1,'Refund/cancel remains allowed with real commerce gated off');
 offer={...listing('expired',user),Status:'Expired',ExpiresAt:'2020-01-01T00:00:00Z'};claimables=[offer];assert((await service().load()).myOffers.some(row=>row.offerId==='expired'));
 assert.equal((await new CardMarketService(runtime,storage,false).cancel('expired')).Status,'Expired');assert.equal(reclaims,1,'Expired native listings require claimBack, even with commerce gated off');
 offer={...listing('expired-lost',user),Status:'Expired',ExpiresAt:'2020-01-01T00:00:00Z'};claimables=[offer];lostClaim=true;await assert.rejects(service().cancel('expired-lost'),/Lost claim/);claimables=[offer];assert.equal(await service().recover(),false,'Expired status alone cannot confirm escrow refund');claimables=[];assert.equal(await service().recover(),true);assert.equal(reclaims,2);
 values.set(`imperivm.card-market.v1:SI4IPS8B:${user}:${wallet}`,JSON.stringify({version:1,action:'buy',startedAt:1}));await assert.rejects(service().recover(),/повреждён/);values.clear();
 assert(lockNames.every(name=>name.startsWith('imperivm.card-market.v1:')));
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});await assert.rejects(service().buy('sale','100'),/между вкладками/);Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});

 // Native Item grants remain playable alongside untouched legacy collection rights.
 const legacyDefs=JSON.parse(readFileSync('docs/idos/agora-collection.json','utf8'));
 let packCalls=0,lostPack=false;owned={};balance='999999';
 Object.assign(client,{collection:{getDefinitions:async()=>ok(legacyDefs),getUserState:async()=>ok({CollectionID:IDOS_CONFIG.collection,OwnedCollectibles:{[PACK_CARD_IDS[1]]:2},CollectionCurrencyBalance:3})},blockchain:{getUserState:async()=>ok({})},lootbox:{getDefinitions:async()=>ok({LootboxDefinitions:boxes}),open:async(boxId:string,count:number,option:string)=>{
  packCalls++;assert.equal(boxId,CARD_PACK_LOOTBOX_ID);assert.equal(count,1);assert.equal(option,'IMP');owned[id]=(owned[id]??0)+5;balance=String(Number(balance)-REAL_PACK_COST);if(lostPack)throw new Error('Lost native pack reply');return ok({LootboxID:boxId,OpenedCount:1,Results:[{Grant:{Standard:{Entries:[{Type:'Item',CatalogID:CARD_ITEM_CATALOG_ID,ItemID:id,Amount:5}]}}}]});
 }}});
 const originalGate=COMMERCE_CONFIG.enabled;COMMERCE_CONFIG.enabled=true;
 const gateway=new IDosCardItemGateway(runtime);const before=await gateway.load();assert.equal(before.owned[PACK_CARD_IDS[1]],2);assert.equal(before.packKind,'tradable-items');assert(before.owned[freeId]>0);
 const opened=await gateway.openPack();assert.equal(opened.cards.length,5);assert.equal(opened.snapshot.owned[id],5);assert.equal(opened.snapshot.packKind,'tradable-items');assert.equal(values.size,0);
 lostPack=true;await assert.rejects(gateway.openPack(),/Lost native/);assert.equal(packCalls,2);assert.equal(values.size,1);
 const reload=new IDosCardItemGateway(runtime);const pending=await reload.load();assert.equal(pending.owned[id],10,'Actually granted server copies stay playable after lost reply');assert(pending.purchaseBlocked,'Inventory growth alone cannot prove/clear a native payment receipt');await assert.rejects(reload.openPack(),/заблокировано/);assert.equal(packCalls,2);
 values.clear();const signedOut={...runtime,getSnapshot:()=>({status:'anonymous'})} as unknown as IDosRuntime;await assert.rejects(new IDosCardItemGateway(signedOut).openPack(),/кошельком/);assert.equal(packCalls,2);COMMERCE_CONFIG.enabled=originalGate;
 console.log('Card market checks passed: exact per-pack rarity, canonical Item ownership, native atomic contracts, completed-only weighted prices, config/commission gates, wallet isolation, cross-tab duplicate-payment protection, cancel refunds and native pack uncertainty. Mocked SDK only; no financial transactions.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
