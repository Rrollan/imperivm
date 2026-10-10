import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {aggregateCardDeals,createCardMarketPriceReader,verifiedCardDeal} from '../src/cardMarketPrices';
import {parseCardPriceSnapshot} from '../../lib/idos/cardPrice';

const owner='BpN6zQ3rec4sCyuRCzo9RaVk433fXyBBEmPghXswWnL6';
const auth={userId:'fixture-seller',sessionTicket:'fixture-ticket-no-real-credential'};
const at='2026-10-10T00:00:00.000Z';
const trade=(overrides:Record<string,unknown>={})=>({FinalStatus:'Completed',OfferType:'Listing',GoodsType:'Item',GoodsCatalogID:'IMPERIVM_CARDS_V1',GoodsItemID:'dogen',GoodsAmount:2,OfferID:'offer-fixture',SellerUserID:auth.userId,BuyerUserID:'fixture-buyer',PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:301}],EventTokens:null},CompletedAt:at,...overrides});
const state=(wallet=owner,userId=auth.userId)=>({User:{UserID:userId,Blockchain:{LastWalletLogin:{NetworkID:'solana',Address:wallet}},PublicData:{Username:'PRIVATE_NICK',Avatar:'PRIVATE_AVATAR'}}});
const envelope=(Data:unknown)=>new Response(JSON.stringify({Success:true,Data}));
const config={supabaseUrl:'',supabaseKey:''};
async function storage(t:{after:(cleanup:()=>Promise<void>)=>void}){const folder=await mkdtemp(join(tmpdir(),'imperivm-market-test-'));t.after(()=>rm(folder,{recursive:true,force:true}));return join(folder,'deals.json');}

test('only completed participant card sales for integer IMP become minimal receipts',()=>{
  assert.deepEqual(verifiedCardDeal(trade(),auth.userId),{offerId:'offer-fixture',cardId:'dogen',quantity:2,priceImp:'301',completedAt:at});
  const invalid:unknown[]=[null,[],{},trade({FinalStatus:'Failed'}),trade({FinalStatus:'Cancelled'}),trade({OfferType:'Auction'}),trade({GoodsType:'VirtualCurrency'}),trade({GoodsCatalogID:'FAKE'}),trade({GoodsItemID:'fake-card'}),trade({GoodsItemID:'constructor'}),trade({SellerUserID:'other-seller',BuyerUserID:'other-buyer'}),trade({BuyerUserID:auth.userId}),trade({GoodsAmount:0}),trade({GoodsAmount:1.5}),trade({GoodsAmount:Number.MAX_SAFE_INTEGER+1}),trade({OfferID:''}),trade({CompletedAt:'2026-02-30T00:00:00Z'}),trade({CompletedAt:'yesterday'}),trade({PricePaid:null}),trade({PricePaid:{Entries:null}}),trade({PricePaid:{Entries:[],EventTokens:null}}),trade({PricePaid:{Entries:[{Type:'VirtualCurrency',CurrencyID:'Main',Amount:5}],EventTokens:null}}),trade({PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Fake',Amount:5}],EventTokens:null}}),trade({PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:'5'}],EventTokens:null}}),trade({PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:1.5}],EventTokens:null}}),trade({PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:1_000_000_000_001}],EventTokens:null}}),trade({PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:5}],EventTokens:[]}}),trade({PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:5,AmountUsd:1}],EventTokens:null}})];
  for(const raw of invalid)assert.equal(verifiedCardDeal(raw,auth.userId),null);
});

test('price aggregation uses volume weighted per-unit exact arithmetic',()=>{
  const first=verifiedCardDeal(trade(),auth.userId)!,second=verifiedCardDeal(trade({OfferID:'offer-2',GoodsAmount:1,PricePaid:{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:900}],EventTokens:null},CompletedAt:'2026-10-10T01:00:00Z'}),auth.userId)!;
  const snapshot=aggregateCardDeals([first,second],at);
  assert.deepEqual(snapshot.stats.dogen,{sampleSize:2,units:3,meanImp:'400.333333',minImp:'150.5',maxImp:'900',lastTradeAt:'2026-10-10T01:00:00.000Z'});
  assert.equal(snapshot.sampleSize,2);assert.equal(snapshot.units,3);assert.deepEqual(parseCardPriceSnapshot(snapshot),snapshot);
  const precise=aggregateCardDeals([{...first,quantity:3,priceImp:'1000000000000'},{...second,quantity:7,priceImp:'1'}],at);
  assert.equal(precise.stats.dogen.meanImp,'100000000000.1');
  assert.equal(precise.stats.dogen.minImp,'0.142857');
});

test('snapshot parser rejects malformed prices, identities, count totals and timestamps',()=>{
  const valid=aggregateCardDeals([verifiedCardDeal(trade(),auth.userId)!],at);
  const invalid:unknown[]=[null,[],{...valid,coverage:'global'},{...valid,currencyID:'Fake'},{...valid,sampleSize:NaN},{...valid,units:3},{...valid,updatedAt:'bad'},{...valid,ready:false},{...valid,stats:null},{...valid,stats:{fake:valid.stats.dogen}},{...valid,stats:{dogen:{...valid.stats.dogen,meanImp:150.5}}},{...valid,stats:{dogen:{...valid.stats.dogen,meanImp:'150.5000001'}}},{...valid,stats:{dogen:{...valid.stats.dogen,minImp:'200'}}},{...valid,stats:{dogen:{...valid.stats.dogen,lastTradeAt:'2026-02-30T00:00:00.000Z'}}}];
  for(const raw of invalid)assert.throws(()=>parseCardPriceSnapshot(raw));
});

test('native requests bind the reporter to the wallet, deduplicate across restart, and never persist credentials or profiles',async t=>{
  const path=await storage(t);let calls=0;
  const fetcher:typeof fetch=async(url,options)=>{
    calls++;assert.equal(options?.method,'POST');assert.equal(options?.redirect,'error');assert.ok(options?.signal);
    const headers=new Headers(options?.headers);assert.equal(headers.get('Authorization'),`Bearer ${auth.sessionTicket}`);assert.equal(headers.get('X-IG-Platform'),'Web');
    const body=JSON.parse(String(options?.body));assert.equal(body.TitleID,'SI4IPS8B');assert.equal(body.UserID,auth.userId);assert.equal(body.ClientSessionTicket,auth.sessionTicket);
    if(String(url).endsWith(`/User/GetUserState/${auth.userId}`)){assert.deepEqual(body.Fields,['Blockchain','PublicData']);return envelope(state());}
    assert.equal(String(url),`https://api.idosgames.com/api/v2/SI4IPS8B/Client/Marketplace/GetHistory/${auth.userId}`);assert.equal(body.HistoryFilter,'Deals');assert.equal(body.PageSize,100);
    return envelope({Entries:[trade(),trade(),null,trade({FinalStatus:'Failed'})],ContinuationToken:null});
  };
  const reader=createCardMarketPriceReader({...config,path,fetcher,clock:()=>Date.parse(at)});
  assert.equal((await reader.read()).ready,true);assert.equal((await reader.read()).updatedAt,null);
  const first=await reader.sync(owner,auth);assert.equal(first.accepted,1);assert.equal(first.sampleSize,1);
  assert.equal((await reader.sync(owner,auth)).accepted,0);
  const restarted=createCardMarketPriceReader({...config,path,fetcher});assert.deepEqual(await restarted.read(),await reader.read());assert.equal((await restarted.sync(owner,auth)).accepted,0);assert.equal(calls,6);
  const raw=await readFile(path,'utf8');for(const secret of [owner,auth.sessionTicket,auth.userId,'fixture-buyer','PRIVATE_NICK','PRIVATE_AVATAR'])assert.equal(raw.includes(secret),false);
  assert.deepEqual(Object.keys(JSON.parse(raw).deals[0]).sort(),['cardId','completedAt','offerId','priceImp','quantity']);
});

test('spoofed wallets, wrong native identity/network and failed envelopes cannot report trades',async t=>{
  const path=await storage(t);
  const badStates=[state('11111111111111111111111111111111'),state(owner,'another-user'),{User:{UserID:auth.userId,Blockchain:{LastWalletLogin:{NetworkID:'ethereum',Address:owner}}}},null];
  for(const invalidState of badStates){let calls=0;const reader=createCardMarketPriceReader({...config,path,fetcher:async()=>{calls++;return envelope(invalidState);}});await assert.rejects(reader.sync(owner,auth));assert.equal(calls,1);assert.equal((await reader.read()).sampleSize,0);}
  let calls=0;const reader=createCardMarketPriceReader({...config,path,fetcher:async()=>{calls++;return new Response(JSON.stringify({Success:false,Data:state()}));}});
  await assert.rejects(reader.sync(owner,auth));await assert.rejects(reader.sync('https://fake.test',auth));await assert.rejects(reader.sync(owner,{...auth,sessionTicket:'short'}));assert.equal(calls,1);
});

test('history pagination is fixed and bounded; later errors abort the entire report',async t=>{
  const path=await storage(t);let page=0;
  const fetcher:typeof fetch=async(url,options)=>{
    if(String(url).includes('/User/'))return envelope(state());const body=JSON.parse(String(options?.body));page++;
    assert.equal(body.PageSize,100);assert.equal(body.HistoryFilter,'Deals');assert.equal(body.ContinuationToken,page===1?undefined:`cursor-${page-1}`);
    return envelope({Entries:[trade({OfferID:`offer-${page}`})],ContinuationToken:`cursor-${page}`});
  };
  const reader=createCardMarketPriceReader({...config,path,fetcher});assert.equal((await reader.sync(owner,auth)).accepted,10);assert.equal(page,10);
  let requests=0;
  const failed=createCardMarketPriceReader({...config,path,fetcher:async url=>{if(String(url).includes('/User/'))return envelope(state());requests++;return requests===1?envelope({Entries:[trade({OfferID:'uncommitted'})],ContinuationToken:'next'}):new Response('{}',{status:503});}});
  await assert.rejects(failed.sync(owner,auth));assert.equal((await failed.read()).sampleSize,10);
  for(const Entries of [null,{},Array(101).fill(trade())]){
    const malformed=createCardMarketPriceReader({...config,path,fetcher:async url=>String(url).includes('/User/')?envelope(state()):envelope({Entries})});await assert.rejects(malformed.sync(owner,auth));
  }
  const loop=createCardMarketPriceReader({...config,path,fetcher:async url=>String(url).includes('/User/')?envelope(state()):envelope({Entries:[trade()],ContinuationToken:'same-cursor'})});await assert.rejects(loop.sync(owner,auth));
  const oversized=createCardMarketPriceReader({...config,path,fetcher:async()=>new Response('x'.repeat(1_000_001))});await assert.rejects(oversized.sync(owner,auth));
});

test('conflicting duplicates abort atomically and concurrent reports cannot count twice',async t=>{
  const path=await storage(t);
  const make=(Entries:unknown[])=>createCardMarketPriceReader({...config,path,fetcher:async url=>String(url).includes('/User/')?envelope(state()):envelope({Entries})});
  await make([trade()]).sync(owner,auth);
  const before=await readFile(path,'utf8');
  await assert.rejects(make([trade({OfferID:'new-offer'}),trade({GoodsAmount:3})]).sync(owner,auth),/Conflicting/);
  assert.equal(await readFile(path,'utf8'),before);
  await assert.rejects(make([trade({OfferID:'batch-conflict'}),trade({OfferID:'batch-conflict',GoodsAmount:3})]).sync(owner,auth));assert.equal(await readFile(path,'utf8'),before);
  const one=make([trade({OfferID:'concurrent'})]),two=make([trade({OfferID:'concurrent'})]);
  assert.equal((await Promise.all([one.sync(owner,auth),two.sync(owner,auth)])).reduce((sum,result)=>sum+result.accepted,0),1);assert.equal((await one.read()).sampleSize,2);
});

test('missing or incomplete configuration stays disabled and makes no native request',async()=>{
  let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw new Error('must not run');};
  for(const overrides of [{path:''},{supabaseUrl:'https://fixture.supabase.co'},{supabaseKey:'sb_publishable_invalid'}]){
    const reader=createCardMarketPriceReader({...config,fetcher,...overrides});const snapshot=await reader.read();assert.equal(snapshot.ready,false);assert.equal(snapshot.updatedAt,null);assert.equal((await reader.sync(owner,auth)).accepted,0);assert.deepEqual(parseCardPriceSnapshot(snapshot),snapshot);
  }
  assert.equal(calls,0);
});
