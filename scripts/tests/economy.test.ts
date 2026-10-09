import assert from 'node:assert/strict';
import type {BlockchainConfigResponse, CurrencyDefinitions, GetStorefrontResponse, IDosGamesClient, OperationResult, StorePurchaseResponse} from '@idosgames/core';
import {CARDS} from '../../lib/cards';
import {FREE_CARD_IDS, PACK_CARD_IDS, freeCardCounts, deckCardCounts, needsCollection, playableDeck, parseCollectionAuth} from '../../lib/collection/access';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {DECKS} from '../../lib/decks';
import {IDOS_CONFIG, COLLECTION_KEY, LocalCollectionGateway, parseLocalCollection} from '../../lib/collection/gateway';
import {authorizeCollectionDeck} from '../../lib/collection/authority';
import {saveCustomDeck} from '../../lib/deckbuilder';
import {deckError} from '../../lib/engine/deckValidation';
import type {IDosRuntime, IDosSession} from '../../lib/idos/client';
import {COMMERCE_CONFIG, SOLANA_USDC_MINT, RugCommerce, cryptoAffordable, platformAppUrl, rugOffers, validateCommerceCurrencies} from '../../lib/idos/commerce';
import {SessionQueue} from '../../lib/idos/auth';

function storage() {
  const map = new Map<string,string>();
  return {map, getItem: (key:string) => map.get(key) ?? null, setItem: (key:string,value:string) => {map.set(key,value);}, removeItem: (key:string) => {map.delete(key);}};
}
const ok = <T>(data:T): OperationResult<T> => ({ok:true,data});
const common = PACK_CARD_IDS.find(id => CARDS[id].rarity === 'common')!;
const legendary = PACK_CARD_IDS.find(id => CARDS[id].rarity === 'legendary')!;
const premiumDeck = [...FREE_DECKS.whale]; premiumDeck.splice(0,2,common,common);
const auth = {userId:'wallet-test',sessionTicket:'test-session-ticket-no-real-auth'};
function currencies(): CurrencyDefinitions {return {CryptoCurrencies:{
  SOL:{CurrencyID:'SOL',Status:'Active',Permissions:{SpendableInGame:true},Networks:[{NetworkID:'SOLANA_MAINNET',ContractAddress:'',Decimals:9}]},
  USDC:{CurrencyID:'USDC',Status:'Active',Permissions:{SpendableInGame:true},Networks:[{NetworkID:'SOLANA_MAINNET',ContractAddress:SOLANA_USDC_MINT,Decimals:6}]},
}};}
const blockchain: BlockchainConfigResponse = {Blockchain:{Networks:{SOLANA_MAINNET:{Type:'Solana',RpcUrl:'https://api.mainnet-beta.solana.com'}}}};
function storefront(): GetStorefrontResponse {return {ServerTimeUtc:'2026-10-08T00:00:00Z',AdCreditBalance:0,Stores:[{
 StoreID:'IMPERIVM_IMP',SortOrder:0,Sections:[{SectionID:'IMP',SortOrder:0,Slots:[{SlotID:'250',SortOrder:0,Offer:{OfferID:'IMP_250_TEST',
  Rewards:{Standard:{Entries:[{Type:'VirtualCurrency',CurrencyID:IDOS_CONFIG.currency,Amount:250}]}},
  State:{PurchasedTotal:0,PurchasedToday:0,PurchasedThisRotation:0,IsFirstPurchaseAvailable:true,SoldOut:false},
  PriceOptions:[{OptionID:'USDC_V1',IsFree:false,IsAdPaid:false,IsStorePaid:false,Cost:{Standard:{Entries:[{Type:'CryptoCurrency',CurrencyID:'USDC',Amount:1}]}}},
    {OptionID:'SOL_V1',IsFree:false,IsAdPaid:false,IsStorePaid:false,Cost:{Standard:{Entries:[{Type:'CryptoCurrency',CurrencyID:'SOL',Amount:0.002}]}}}],
 }}]}],
}]};}
function scenario() {
 const store=storefront(), money={SOL:'0.02',USDC:'10'}, persist=storage(), queue=new SessionQueue();
 let session:IDosSession={status:'wallet',userId:auth.userId,owner:'fixture-wallet',error:null,revision:0}, charges=0;
 const offer=store.Stores![0].Sections![0].Slots![0].Offer!;
 const receipt=(option:string):StorePurchaseResponse => ({ServerTimeUtc:store.ServerTimeUtc,OfferID:offer.OfferID,Count:1,Resources:{
   Grant:{Standard:{Entries:[{Type:'VirtualCurrency',CurrencyID:IDOS_CONFIG.currency,Amount:250}]}},
   Consume:{Standard:{Entries:[{Type:'CryptoCurrency',CurrencyID:option==='USDC_V1'?'USDC':'SOL',Amount:option==='USDC_V1'?1:0.002}]}},
 }});
 let execute = async (option:string):Promise<OperationResult<StorePurchaseResponse>> => {offer.State!.PurchasedTotal++; return ok(receipt(option));};
 const client = {
  title:{getCurrencyDefinitions:async()=>ok(currencies())},
  blockchain:{getDefinitions:async()=>ok(blockchain),getUserState:async()=>ok({})},
  data:{user:{getCryptoCurrencyAmount:(id:string)=>money[id as keyof typeof money]}},
  store:{getStorefront:async(opts:{forceRefresh?:boolean})=>{assert.equal(opts.forceRefresh,true);return ok(store);},
    purchase:async (id:string,count:number,opts:{selectedOptionID?:string;slot?:{storeID:string;sectionID:string;slotID:string}})=>{
      assert.equal(id,offer.OfferID);assert.equal(count,1);assert.deepEqual(opts.slot,{storeID:'IMPERIVM_IMP',sectionID:'IMP',slotID:'250'});charges++;return execute(opts.selectedOptionID!);
    }},
 } as unknown as IDosGamesClient;
 const runtime:Pick<IDosRuntime,'withAccount'|'getSnapshot'>={getSnapshot:()=>session,withAccount:work=>queue.forAccount(()=>work(client))};
 return {service:new RugCommerce(runtime,persist),runtime,persist,offer,money,receipt,charges:()=>charges,
   execute:(fn:typeof execute)=>{execute=fn;}, account:(status:IDosSession['status'],userId=auth.userId)=>{session={...session,status,userId};}};
}

async function main() {
 assert.equal(FREE_CARD_IDS.length,49);assert.equal(PACK_CARD_IDS.length,50);assert.equal(Object.keys(CARDS).length,99);
 assert.equal(new Set([...FREE_CARD_IDS,...PACK_CARD_IDS]).size,99);
 for(const deck of Object.values(FREE_DECKS)){assert.equal(deckError(deck,freeCardCounts()),null);assert.equal(needsCollection(deck),false);}
 for(const [hero,recipe] of Object.entries(DECKS)){assert(needsCollection(recipe));assert.deepEqual(playableDeck(hero,{},recipe),FREE_DECKS[hero]);}
 assert(deckError(premiumDeck,freeCardCounts())); assert.equal(deckError(premiumDeck,deckCardCounts({[common]:1})),null);
 assert.equal(deckCardCounts({[legendary]:1})[legendary],1);
 assert.deepEqual(playableDeck('whale',{[common]:1},premiumDeck),premiumDeck);
 const cache=storage();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:cache});
 assert.throws(()=>saveCustomDeck('whale',premiumDeck,{}),/copy/);saveCustomDeck('whale',premiumDeck,{[common]:1});
 assert(parseCollectionAuth(auth));assert.equal(parseCollectionAuth({...auth,sessionTicket:'x\n'.repeat(20)}),null);
 assert.equal(parseCollectionAuth({...auth,userId:'../foreign'}),null);
 for(const [roll,rarity] of [[0,'common'],[0.6,'rare'],[0.85,'epic'],[0.96,'legendary']] as const){
  const local=new LocalCollectionGateway(storage(),()=>roll);const start=await local.load();
  assert.equal(Object.keys(start.owned).length,49);assert.equal(start.rug,500);
  const opened=await local.openPack();assert.equal(opened.cards.length,5);assert.equal(opened.snapshot.rug,450);
  assert(opened.cards.every(card=>PACK_CARD_IDS.includes(card.id)&&card.rarity===rarity));
 }
 const migration={version:1,rug:500,packsOpened:0,owned:{[common]:2}};
 assert.equal(parseLocalCollection(JSON.stringify(migration)).owned[common],undefined);
 assert.equal(parseLocalCollection(JSON.stringify({...migration,packsOpened:1})).owned[common],2);
 assert.equal(parseLocalCollection(JSON.stringify({...migration,version:2})).owned[common],2);
 assert.equal(COLLECTION_KEY,'imperivm.collection.v1');
 const oldTitle=process.env.IDOS_TITLE_ID;process.env.IDOS_TITLE_ID='fixture-title';
 let calls=0, data:unknown={CollectionID:'IMPERIVM_AGORA',OwnedCollectibles:{[common]:1}}, accepted=true;
 const fetcher:typeof fetch = async (url,options) => {
  calls++;assert.equal(String(url),'https://api.idosgames.com/api/v2/fixture-title/Client/Collection/GetUserState/wallet-test');
  assert.equal(options?.redirect,'error');assert.equal(new Headers(options?.headers).get('Authorization'),`Bearer ${auth.sessionTicket}`);
  assert.deepEqual(JSON.parse(String(options?.body)),{TitleID:'fixture-title',UserID:auth.userId,ClientSessionTicket:auth.sessionTicket});
  return new Response(JSON.stringify({Success:accepted,Data:data}));
 };
 await authorizeCollectionDeck(FREE_DECKS.whale,undefined,fetcher);assert.equal(calls,0);
 await assert.rejects(authorizeCollectionDeck(premiumDeck,undefined,fetcher));assert.equal(calls,0);
 await authorizeCollectionDeck(premiumDeck,auth,fetcher);
 data={CollectionID:'IMPERIVM_AGORA',OwnedCollectibles:{audit:100}};await assert.rejects(authorizeCollectionDeck(premiumDeck,auth,fetcher),/коллекции/);
 data={CollectionID:'OTHER',OwnedCollectibles:{[common]:1}};await assert.rejects(authorizeCollectionDeck(premiumDeck,auth,fetcher),/выпуску/);
 accepted=false;await assert.rejects(authorizeCollectionDeck(premiumDeck,auth,fetcher),/Сессия/);
 await assert.rejects(authorizeCollectionDeck(premiumDeck,auth,async()=>new Response('',{status:401})),/проверить/);
 if(oldTitle===undefined)delete process.env.IDOS_TITLE_ID;else process.env.IDOS_TITLE_ID=oldTitle;

 validateCommerceCurrencies(currencies(),blockchain);
 const wrongMint=currencies();wrongMint.CryptoCurrencies!.USDC.Networks![0].ContractAddress='fake-usdc';assert.throws(()=>validateCommerceCurrencies(wrongMint,blockchain),/native SOL/);
 const testnet=structuredClone(blockchain);testnet.Blockchain!.Networks!.SOLANA_MAINNET.RpcUrl='https://api.devnet.solana.com';assert.throws(()=>validateCommerceCurrencies(currencies(),testnet),/mainnet/);
 assert(cryptoAffordable('9007199254740993.000001','9007199254740993.000000'));assert(!cryptoAffordable('0.001999999','0.002'));
 assert(cryptoAffordable('0001.000000000','1'));assert(!cryptoAffordable('1e3','1'));
 assert.equal(platformAppUrl('https://evil.test/app/ours'),null);assert.equal(platformAppUrl('https://idosgames.com/app/title-123'),'https://idosgames.com/app/title-123');
 const front=storefront();assert.equal(rugOffers(front,()=> '10').length,2);
 const altered=structuredClone(front);altered.Stores![0].Sections![0].Slots![0].Offer!.Rewards!.Standard!.Entries!.push({Type:'Item',ItemID:'hidden'});
 assert.equal(rugOffers(altered,()=> '10').length,0);
 const tooPrecise=structuredClone(front);tooPrecise.Stores![0].Sections![0].Slots![0].Offer!.PriceOptions![0].Cost!.Standard!.Entries![0].Amount=0.0000001;
 assert.equal(rugOffers(tooPrecise,()=> '10').length,1);

 const enabled=COMMERCE_CONFIG.enabled;COMMERCE_CONFIG.enabled=true;
 const good=scenario(),quote=(await good.service.load())[0];await good.service.buy(quote);assert.equal(good.charges(),1);assert.equal(good.service.pending(),null);
 const changed=scenario(),old=(await changed.service.load())[0];changed.offer.PriceOptions![0].Cost!.Standard!.Entries![0].Amount=2;
 await assert.rejects(changed.service.buy(old),/offer changed/);assert.equal(changed.charges(),0);
 const broke=scenario(),rich=(await broke.service.load())[0];broke.money.USDC='0.9';await assert.rejects(broke.service.buy(rich),/Top up/);assert.equal(broke.charges(),0);
 const guest=scenario(),guestQuote=(await guest.service.load())[0];guest.account('guest');await assert.rejects(guest.service.buy(guestQuote),/Sign in/);assert.equal(guest.charges(),0);
 const switched=scenario();switched.account('wallet','other-user');await assert.rejects(switched.service.load(),/account changed/);
 const uncertain=scenario(),uq=(await uncertain.service.load())[0];uncertain.execute(async()=>({ok:false,reason:'connection',error:'fixture lost response'}));
 await assert.rejects(uncertain.service.buy(uq),/connection/);assert(uncertain.service.pending());
 const reopen=new RugCommerce(uncertain.runtime,uncertain.persist);await reopen.load();await assert.rejects(reopen.buy(uq),/previous IMP purchase/);assert.equal(uncertain.charges(),1);
 uncertain.offer.State!.PurchasedTotal++;await reopen.load();assert.equal(reopen.pending(),null);assert.equal(uncertain.charges(),1);
 const malformed=scenario(),mq=(await malformed.service.load())[0];malformed.execute(async()=>({ok:false,reason:'server',error:'Malformed response envelope'}));
 await assert.rejects(malformed.service.buy(mq));assert(malformed.service.pending());
 const mismatch=scenario(),mm=(await mismatch.service.load())[0];mismatch.execute(async option=>{const receipt=mismatch.receipt(option);receipt.Resources!.Grant!.Standard!.Entries![0].Amount=1;return ok(receipt);});
 await assert.rejects(mismatch.service.buy(mm),/receipt/);assert(mismatch.service.pending());
 const denied=scenario(),dq=(await denied.service.load())[0];denied.execute(async()=>({ok:false,reason:'client',error:'Invalid local argument'}));
 await assert.rejects(denied.service.buy(dq));assert.equal(denied.service.pending(),null);
 const blocked=scenario();blocked.persist.setItem=()=>{throw new Error('storage blocked');};
 const noStorage=new RugCommerce(blocked.runtime,blocked.persist);await assert.rejects(noStorage.buy((await noStorage.load())[0]),/storage blocked/);assert.equal(blocked.charges(),0);
 const doubled=scenario(),one=(await doubled.service.load())[0];let release!:()=>void;
 const hold=new Promise<void>(resolve=>{release=resolve;});doubled.execute(async option=>{await hold;return ok(doubled.receipt(option));});
 const first=doubled.service.buy(one);await assert.rejects(doubled.service.buy(one),/already processing/);release();await first;assert.equal(doubled.charges(),1);
 COMMERCE_CONFIG.enabled=enabled;
 console.log('Economy checks passed: 49 free / 50 pack-only, four legal starters, unlock copy limits, migration, server entitlements, mainnet asset checks, exact balances, quote changes, account switches, receipts and persistent duplicate-payment prevention. No real payments.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
