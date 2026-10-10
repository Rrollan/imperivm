import {readFile,writeFile,rename,mkdir,stat,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CARDS} from '../../lib/cards';
import {parseCollectionAuth} from '../../lib/collection/access';
import {IMPERIVM_TITLE} from '../../lib/idos/title';
import type {CardPriceSnapshot,CardPriceStats} from '../../lib/idos/cardPrice';
import {validSolanaAddress} from '../../lib/solana/tokenBalance';
import {boundedMarketJson,createSupabaseCardMarketRepository,type CardMarketRepository,type VerifiedCardDeal} from './cardMarketSupabase';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const identifier=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function completedAt(value:unknown):string|null {
  if(typeof value!=='string'||value.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))return null;
  // Date.parse normalizes impossible calendar dates. Reject those before normalizing UTC.
  const day=new Date(`${value.slice(0,10)}T00:00:00.000Z`);if(day.toISOString().slice(0,10)!==value.slice(0,10))return null;
  return new Date(value).toISOString();
}
export function verifiedCardDeal(value:unknown,reporter:string):VerifiedCardDeal|null {
  if(!record(value)||value.FinalStatus!=='Completed'||value.OfferType!=='Listing'||value.GoodsType!=='Item'||value.GoodsCatalogID!=='IMPERIVM_CARDS_V1'||typeof value.GoodsItemID!=='string'||!Object.hasOwn(CARDS,value.GoodsItemID)||!identifier(value.OfferID)||!identifier(value.SellerUserID)||!identifier(value.BuyerUserID)||value.SellerUserID===value.BuyerUserID||![value.SellerUserID,value.BuyerUserID].includes(reporter)||typeof value.GoodsAmount!=='number'||!Number.isSafeInteger(value.GoodsAmount)||value.GoodsAmount<1||value.GoodsInstances!=null&&(!Array.isArray(value.GoodsInstances)||value.GoodsInstances.length>0)||!record(value.PricePaid)||value.PricePaid.EventTokens!=null||!Array.isArray(value.PricePaid.Entries)||value.PricePaid.Entries.length!==1)return null;
  const price=value.PricePaid.Entries[0],at=completedAt(value.CompletedAt);
  if(!record(price)||price.Type!=='CryptoCurrency'||price.CurrencyID!=='Main'||typeof price.Amount!=='number'||!Number.isSafeInteger(price.Amount)||price.Amount<1||price.Amount>1_000_000_000_000||price.AmountUsd!=null||price.CatalogID!=null||price.ItemID!=null||!at)return null;
  return {offerId:value.OfferID,cardId:value.GoodsItemID,quantity:value.GoodsAmount,priceImp:String(price.Amount),completedAt:at};
}
const empty=(ready:boolean,reason?:string):CardPriceSnapshot=>({schemaVersion:1,ready,coverage:'verified-reports',currencyID:'Main',symbol:'IMP',stats:{},sampleSize:0,units:0,updatedAt:null,...(reason?{reason}:{})});
const format=(value:bigint)=>{const fraction=(value%1_000_000n).toString().padStart(6,'0').replace(/0+$/,'');return `${value/1_000_000n}${fraction?`.${fraction}`:''}`;};
export function aggregateCardDeals(deals:readonly VerifiedCardDeal[],updatedAt:string|null):CardPriceSnapshot {
  const groups=new Map<string,VerifiedCardDeal[]>();let totalUnits=0;
  for(const deal of deals){totalUnits+=deal.quantity;if(!Number.isSafeInteger(totalUnits))throw new Error('Market volume exceeds supported range');const rows=groups.get(deal.cardId)??[];rows.push(deal);groups.set(deal.cardId,rows);}
  const stats:Record<string,CardPriceStats>={};
  for(const [id,rows] of groups){
    const units=rows.reduce((n,row)=>n+row.quantity,0),paid=rows.reduce((n,row)=>n+BigInt(row.priceImp),0n),unitPrices=rows.map(row=>BigInt(row.priceImp)*1_000_000n/BigInt(row.quantity));
    stats[id]={sampleSize:rows.length,units,meanImp:format(paid*1_000_000n/BigInt(units)),minImp:format(unitPrices.reduce((a,b)=>a<b?a:b)),maxImp:format(unitPrices.reduce((a,b)=>a>b?a:b)),lastTradeAt:rows.reduce((last,row)=>last>row.completedAt?last:row.completedAt,rows[0].completedAt)};
  }
  return {...empty(true),stats,sampleSize:deals.length,units:totalUnits,updatedAt};
}
const same=(a:VerifiedCardDeal,b:VerifiedCardDeal)=>a.cardId===b.cardId&&a.quantity===b.quantity&&a.priceImp===b.priceImp&&a.completedAt===b.completedAt;
/** Serializes writes across reader instances in this process. Use Supabase for replicas. */
const fileLocks=new Map<string,Promise<unknown>>();
function fileRepository(path:string,clock:()=>number):CardMarketRepository {
  const file=resolve(path);
  async function state():Promise<{deals:VerifiedCardDeal[];updatedAt:string|null}>{
    let raw:string;try{if((await stat(file)).size>32_000_000)throw new Error('Market price storage too large');raw=await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {deals:[],updatedAt:null};throw new Error('Market price storage unavailable');}
    let data:unknown;try{data=JSON.parse(raw);}catch{throw new Error('Invalid market price storage');}
    if(!record(data)||data.schemaVersion!==1||data.titleId!==IMPERIVM_TITLE.id||!Array.isArray(data.deals)||data.deals.length>100_000||data.updatedAt!==null&&completedAt(data.updatedAt)!==data.updatedAt)throw new Error('Invalid market price storage');
    const deals:VerifiedCardDeal[]=[],seen=new Set<string>();
    for(const value of data.deals){
      if(!record(value)||!identifier(value.offerId)||typeof value.cardId!=='string'||!Object.hasOwn(CARDS,value.cardId)||typeof value.quantity!=='number'||!Number.isSafeInteger(value.quantity)||value.quantity<1||typeof value.priceImp!=='string'||! /^[1-9]\d{0,12}$/.test(value.priceImp)||BigInt(value.priceImp)>1_000_000_000_000n||completedAt(value.completedAt)!==value.completedAt||seen.has(value.offerId))throw new Error('Invalid market price storage');
      seen.add(value.offerId);deals.push({offerId:value.offerId,cardId:value.cardId,quantity:value.quantity,priceImp:value.priceImp,completedAt:value.completedAt as string});
    }
    if(deals.length>0&&data.updatedAt===null||deals.length===0&&data.updatedAt!==null)throw new Error('Invalid market price storage');
    return {deals,updatedAt:data.updatedAt as string|null};
  }
  return {
    async read(){await fileLocks.get(file);const data=await state();return aggregateCardDeals(data.deals,data.updatedAt);},
    async insert(incoming){
      const previous=fileLocks.get(file)??Promise.resolve();
      const task=previous.catch(()=>{}).then(async()=>{
        const data=await state(),byId=new Map(data.deals.map(deal=>[deal.offerId,deal]));let accepted=0;
        for(const deal of incoming){const existing=byId.get(deal.offerId);if(existing){if(!same(existing,deal))throw new Error('Conflicting verified market deal');}else{byId.set(deal.offerId,deal);accepted++;}}
        if(!accepted)return 0;
        if(byId.size>100_000)throw new Error('Market price storage too large');
        const next={schemaVersion:1,titleId:IMPERIVM_TITLE.id,deals:[...byId.values()],updatedAt:new Date(clock()).toISOString()};aggregateCardDeals(next.deals,next.updatedAt);
        await mkdir(dirname(file),{recursive:true});const temporary=`${file}.${randomUUID()}.tmp`;
        try{await writeFile(temporary,JSON.stringify(next),{mode:0o600,flag:'wx'});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
        return accepted;
      });
      fileLocks.set(file,task);try{return await task;}finally{if(fileLocks.get(file)===task)fileLocks.delete(file);}
    },
  };
}

export function createCardMarketPriceReader({path=process.env.IMPERIVM_MARKET_HISTORY_PATH,supabaseUrl=process.env.SUPABASE_URL,supabaseKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SERVICE_ROLE_KEY,fetcher=fetch,clock=Date.now}:{path?:string;supabaseUrl?:string;supabaseKey?:string;fetcher?:typeof fetch;clock?:()=>number}={}) {
  let repository:CardMarketRepository|undefined,reason='Market price storage is not configured';
  if(supabaseUrl||supabaseKey){
    if(supabaseUrl&&supabaseKey){try{repository=createSupabaseCardMarketRepository({supabaseUrl,supabaseKey,fetcher});}catch{reason='Market price storage configuration is invalid';}}
    else reason='Market price storage configuration is incomplete';
  }else if(path)repository=fileRepository(path,clock);
  let active=0;
  return {
    async read():Promise<CardPriceSnapshot>{return repository?repository.read():empty(false,reason);},
    async sync(owner:string,collectionAuth:unknown):Promise<CardPriceSnapshot&{accepted:number}>{
      if(!repository)return {...empty(false,reason),accepted:0};
      const auth=parseCollectionAuth(collectionAuth);
      if(!auth||!validSolanaAddress(owner))throw new Error('Invalid market account');
      if(active>=8)throw new Error('Market history service is busy');active++;
      const timeout=AbortSignal.timeout(15_000);
      async function native(path:string,fields:Record<string,unknown>):Promise<Record<string,unknown>>{
        try{
          const raw=await boundedMarketJson(await fetcher(`https://api.idosgames.com/api/v2/${IMPERIVM_TITLE.id}/Client/${path}/${encodeURIComponent(auth!.userId)}`,{method:'POST',redirect:'error',signal:AbortSignal.any([timeout,AbortSignal.timeout(8000)]),headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth!.sessionTicket}`,'X-IG-Platform':'Web'},body:JSON.stringify({TitleID:IMPERIVM_TITLE.id,UserID:auth!.userId,ClientSessionTicket:auth!.sessionTicket,...fields})}));
          if(!record(raw)||raw.Success!==true||raw.Error!=null||raw.error!=null||!record(raw.Data))throw new Error('Invalid native history');return raw.Data;
        }catch{throw new Error('Native market history unavailable');}
      }
      try{
        const state=await native('User/GetUserState',{Fields:['Blockchain','PublicData']});
        const blockchain=record(state.User)?state.User.Blockchain:undefined;
        if(!record(state.User)||state.User.UserID!==auth.userId||!record(blockchain)||!record(blockchain.LastWalletLogin)||blockchain.LastWalletLogin.NetworkID!=='solana'||blockchain.LastWalletLogin.Address!==owner)throw new Error('Wallet does not match the native iDos account');
        const deals:VerifiedCardDeal[]=[],tokens=new Set<string>();let cursor:string|undefined;
        for(let page=0;page<10;page++){
          const history=await native('Marketplace/GetHistory',{HistoryFilter:'Deals',PageSize:100,...(cursor?{ContinuationToken:cursor}:{})});
          if(!Array.isArray(history.Entries)||history.Entries.length>100)throw new Error('Invalid native market history');
          for(const entry of history.Entries){const deal=verifiedCardDeal(entry,auth.userId);if(deal)deals.push(deal);}
          if(history.ContinuationToken===null||history.ContinuationToken===undefined||history.ContinuationToken==='')break;
          if(typeof history.ContinuationToken!=='string'||history.ContinuationToken.length>4096||/[\u0000-\u0020\u007f]/.test(history.ContinuationToken)||tokens.has(history.ContinuationToken))throw new Error('Invalid native history continuation');
          tokens.add(history.ContinuationToken);cursor=history.ContinuationToken;
          // The bounded initial window can be incomplete; coverage remains verified-reports.
        }
        const accepted=await repository.insert(deals);return {...await repository.read(),accepted};
      }finally{active--;}
    },
  };
}
