import type {IDosGamesClient, MarketplaceOfferView, MarketplaceHistoryEntryView, ResourceBundle, ItemDefinitions, CurrencyDefinitions, MarketplaceGetDefinitionsResponse} from '@idosgames/core';
import type {IDosRuntime} from './client';
import {idosResult} from './auth';
import {COMMERCE_CONFIG,cryptoAffordable} from './commerce';
import {validateImpToken} from './token';
import {CARD_ITEM_CATALOG_ID,cardItemCounts,validateCardItemDefinitions} from './cardEconomy';
import {CARDS} from '../cards';
import {browserLocks} from '../browserLocks';
export {CARD_ITEM_CATALOG_ID} from './cardEconomy';

export interface CardMarketListing {offerId:string;cardId:string;quantity:number;priceImp:string;sellerUserId:string;sellerName?:string;status:string;expiresAt?:string}
export interface CardMarketTrade {offerId:string;cardId:string;quantity:number;priceImp:string;completedAt:string;sellerUserId:string;buyerUserId:string}
export interface CardMarketPriceStats {sampleSize:number;units:number;meanImp:string;minImp:string;maxImp:string;scope:'personal'}
export interface CardMarketSnapshot {ready:boolean;reason?:string;balance:string;inventory:Record<string,number>;groups:string[];myOffers:CardMarketListing[];history:CardMarketTrade[];stats:Record<string,CardMarketPriceStats>;pending:boolean;tradeFeePercent:number}
type MarketStorage={getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
type Pending={version:1;action:'create'|'buy'|'cancel'|'reclaim';cardId?:string;quantity?:number;priceImp?:string;offerId?:string;sellerUserId?:string;startedAt:number;knownOfferIds?:string[]};
const validOfferId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=160&&!/[\x00-\x20]/.test(value);
export function cardMarketPrice(value:string):string {
  if(!/^[1-9]\d{0,12}$/.test(value)||BigInt(value)>BigInt(1_000_000_000_000))throw new Error('Укажите целую цену от 1 до 1 000 000 000 000 IMP.');
  return value;
}
function bundlePrice(bundle:ResourceBundle|undefined|null):string|null {
  const entries=bundle?.Entries;
  if(bundle?.EventTokens?.length||entries?.length!==1)return null;
  const p=entries[0];
  if(p.Type!=='CryptoCurrency'||p.CurrencyID!=='Main'||p.AmountUsd!=null||p.CatalogID||p.ItemID||!Number.isSafeInteger(p.Amount)||p.Amount!<1)return null;
  try{return cardMarketPrice(String(p.Amount));}catch{return null;}
}
export function cardMarketListing(raw:MarketplaceOfferView):CardMarketListing|null {
  const price=bundlePrice(raw.Price);
  if(raw.OfferType!=='Listing'||raw.GoodsType!=='Item'||raw.GoodsCatalogID!==CARD_ITEM_CATALOG_ID||!raw.GoodsItemID||!Object.hasOwn(CARDS,raw.GoodsItemID)||!validOfferId(raw.OfferID)||!validOfferId(raw.CreatorUserID)||!price||!Number.isSafeInteger(raw.GoodsAmount)||raw.GoodsAmount!<1||raw.GoodsInstances?.length||raw.ExpiresAt!=null&&!Number.isFinite(Date.parse(raw.ExpiresAt)))return null;
  return {offerId:raw.OfferID,cardId:raw.GoodsItemID,quantity:raw.GoodsAmount!,priceImp:price,sellerUserId:raw.CreatorUserID,
    sellerName:raw.CreatorPublicData?.Username??undefined,status:raw.Status??'',expiresAt:raw.ExpiresAt??undefined};
}
export function cardMarketTrade(raw:MarketplaceHistoryEntryView):CardMarketTrade|null {
  const price=bundlePrice(raw.PricePaid);
  if(raw.FinalStatus!=='Completed'||raw.OfferType!=='Listing'||raw.GoodsType!=='Item'||raw.GoodsCatalogID!==CARD_ITEM_CATALOG_ID||!raw.GoodsItemID||!Object.hasOwn(CARDS,raw.GoodsItemID)||!validOfferId(raw.OfferID)||!validOfferId(raw.SellerUserID)||!validOfferId(raw.BuyerUserID)||raw.SellerUserID===raw.BuyerUserID||!price||!Number.isSafeInteger(raw.GoodsAmount)||raw.GoodsAmount!<1||!raw.CompletedAt||!Number.isFinite(Date.parse(raw.CompletedAt)))return null;
  return {offerId:raw.OfferID,cardId:raw.GoodsItemID,quantity:raw.GoodsAmount!,priceImp:price,completedAt:raw.CompletedAt,sellerUserId:raw.SellerUserID,buyerUserId:raw.BuyerUserID};
}
/** SDK GetHistory is personal; this MUST NOT be called a site-wide market average. */
export function cardMarketStats(history:CardMarketTrade[]):Record<string,CardMarketPriceStats> {
  const result:Record<string,CardMarketPriceStats>={};const groups=new Map<string,CardMarketTrade[]>(),seen=new Set<string>();
  for(const row of history){if(seen.has(row.offerId))continue;seen.add(row.offerId);const group=groups.get(row.cardId)??[];group.push(row);groups.set(row.cardId,group);}
  for(const [id,rows] of Array.from(groups.entries())){const units=rows.reduce((n,r)=>n+r.quantity,0);if(!Number.isSafeInteger(units))continue;
    const paid=rows.reduce((n,r)=>n+BigInt(r.priceImp),BigInt(0)),millionths=paid*BigInt(1_000_000)/BigInt(units);
    const whole=millionths/BigInt(1_000_000),fraction=(millionths%BigInt(1_000_000)).toString().padStart(6,'0').replace(/0+$/,'');
    const perUnit=rows.map(r=>BigInt(r.priceImp)*BigInt(1_000_000)/BigInt(r.quantity));
    const format=(n:bigint)=>`${n/BigInt(1_000_000)}${n%BigInt(1_000_000)?'.'+(n%BigInt(1_000_000)).toString().padStart(6,'0').replace(/0+$/,''):''}`;
    result[id]={sampleSize:rows.length,units,meanImp:whole.toString()+(fraction?'.'+fraction:''),minImp:format(perUnit.reduce((a,b)=>a<b?a:b)),maxImp:format(perUnit.reduce((a,b)=>a>b?a:b)),scope:'personal'};
  }return result;
}
export class CardMarketService {
  private readonly identity:ReturnType<IDosRuntime['getSnapshot']>;private locked=false;
  constructor(private runtime:Pick<IDosRuntime,'withAccount'|'getSnapshot'>,private storage?:MarketStorage,private commerceEnabled=COMMERCE_CONFIG.enabled){this.identity=runtime.getSnapshot();if(!storage&&typeof window!=='undefined')try{this.storage=window.localStorage;}catch{}}
  private assertIdentity(){const current=this.runtime.getSnapshot();if(this.identity.status!=='wallet'||!this.identity.owner||!this.identity.userId||current.status!=='wallet'||current.owner!==this.identity.owner||current.userId!==this.identity.userId)throw new Error('Войдите своим кошельком в iDos для рынка карт.');}
  private key(){return `imperivm.card-market.v1:SI4IPS8B:${this.identity.userId}:${this.identity.owner}`;}
  private pending():Pending|null {if(!this.storage)return null;const raw=this.storage.getItem(this.key());if(!raw)return null;try{
    const p=JSON.parse(raw);if(!p||p.version!==1||!['create','buy','cancel','reclaim'].includes(p.action)||!Number.isSafeInteger(p.startedAt)||p.startedAt<=0)throw new Error('invalid');
    if(p.action==='create'||p.action==='buy'||p.action==='reclaim'){
      if(typeof p.cardId!=='string'||!Object.hasOwn(CARDS,p.cardId)||!Number.isSafeInteger(p.quantity)||p.quantity<1||p.action==='create'&&p.quantity>1000||typeof p.priceImp!=='string')throw new Error('invalid');cardMarketPrice(p.priceImp);
    }
    if(p.action==='create'){if(!Array.isArray(p.knownOfferIds)||p.knownOfferIds.length>1000||p.knownOfferIds.some((id:unknown)=>!validOfferId(id)))throw new Error('invalid');}
    else if(!validOfferId(p.offerId)||p.action==='buy'&&!validOfferId(p.sellerUserId))throw new Error('invalid');
    return p;
  }catch{}throw new Error('Статус сделки повреждён. Сверьте историю iDos перед новой сделкой.');}
  private begin(pending:Pending){if(!this.storage)throw new Error('Разрешите сохранение статуса сделки в браузере.');if(this.pending())throw new Error('Предыдущая сделка не подтверждена. Обновите рынок и проверьте историю.');this.storage.setItem(this.key(),JSON.stringify(pending));if(!this.pending())throw new Error('Не удалось сохранить статус сделки.');}
  private async withAccount<T>(work:(client:IDosGamesClient)=>Promise<T>):Promise<T>{this.assertIdentity();return this.runtime.withAccount(async client=>{this.assertIdentity();if(client.auth.context?.userID!==this.identity.userId)throw new Error('Аккаунт iDos изменился.');const r=await work(client);this.assertIdentity();return r;});}
  private async capability(client:IDosGamesClient):Promise<{ready:boolean;reason?:string;tradeFeePercent:number}> {
    const [currency,config,defs]=await Promise.all([client.title.getCurrencyDefinitions(),client.marketplace.getDefinitions(),client.title.getItemDefinitions()]);
    return this.validateCapability(idosResult(currency),idosResult(config),idosResult(defs));
  }
  private validateCapability(currency:CurrencyDefinitions,config:MarketplaceGetDefinitionsResponse,defs:ItemDefinitions):{ready:boolean;reason?:string;tradeFeePercent:number} {
    validateImpToken(currency);
    const fee=Number(currency.CryptoCurrencies?.Main?.PlayerTradeFeePercent??0);
    if(!Number.isFinite(fee)||fee<0||fee>50)throw new Error('Некорректная комиссия рынка iDos.');
    if(!config.Definitions?.Enabled||!config.Definitions.Listings?.Enabled||config.IsOpenNow===false||config.GatePassed===false)return {ready:false,reason:'Рынок карт ещё не включён на iDos.',tradeFeePercent:fee};
    validateCardItemDefinitions(defs);
    const policy=config.Definitions.PricePolicy,allowed=policy?.Allowed,commission=config.Definitions.Commission,tradability=config.Definitions.Tradability;
    const zero=(value:unknown)=>value==null||value===0;
    if(!zero(commission?.Percent)||!zero(commission?.MinPerPosition)||Object.values(commission?.PerCatalogOverrides??{}).some(row=>!zero(row.Percent)||!zero(row.MinPerPosition))||fee!==0)
      return {ready:false,reason:'Настройки комиссии рынка изменились. Сделки приостановлены до проверки.',tradeFeePercent:fee};
    if(policy?.AllowCryptoCurrency!==true||policy.AllowVirtualCurrency!==false||policy.AllowItems!==false||policy.AllowEventTokens!==false||allowed?.length!==1||allowed[0].Kind!=='CryptoCurrency'||allowed[0].CurrencyID!=='Main'||allowed[0].MinAmount!==1||allowed[0].MaxAmount!==1_000_000_000_000||policy?.MaxPositions!==1||config.Definitions.Listings.ListingFeeOptions&&Object.keys(config.Definitions.Listings.ListingFeeOptions).length||config.Definitions.Matching?.Enabled||!tradability?.AllowedCatalogIDs?.includes(CARD_ITEM_CATALOG_ID)||tradability.DeniedCatalogIDs?.includes(CARD_ITEM_CATALOG_ID)||tradability.DeniedItemIDs?.some(id=>Object.hasOwn(CARDS,id)))
      return {ready:false,reason:'Рынок должен принимать только IMP без дополнительной платы за выставление.',tradeFeePercent:fee};
    if(!this.commerceEnabled)return {ready:false,reason:'Сделки за реальные IMP откроются после проверки пополнения и тестовой покупки.',tradeFeePercent:fee};
    return {ready:true,tradeFeePercent:fee};
  }
  async load():Promise<CardMarketSnapshot>{return this.withAccount(async client=>{
    // Independent reads share one round trip window. Never reuse this snapshot
    // to authorize a later payment: mutate() still checks fresh definitions.
    const [currencyResponse,configResponse,itemResponse,inventoryResponse]=await Promise.all([
      client.title.getCurrencyDefinitions(),client.marketplace.getDefinitions(),client.title.getItemDefinitions(),client.user.getUserInventory(),
    ]);
    const config=idosResult(configResponse),itemDefinitions=idosResult(itemResponse),inventory=idosResult(inventoryResponse);
    const gate=this.validateCapability(idosResult(currencyResponse),config,itemDefinitions);
    const balance=client.data.user.getCryptoCurrencyAmount('Main');if(!/^\d+(?:\.\d{1,6})?$/.test(balance))throw new Error('iDos вернул некорректный баланс IMP.');
    let owned:Record<string,number>={};if(itemDefinitions.Catalogs?.[CARD_ITEM_CATALOG_ID]){validateCardItemDefinitions(itemDefinitions);owned=cardItemCounts(inventory);}
    const empty:CardMarketSnapshot={...gate,balance,inventory:owned,groups:[],myOffers:[],history:[],stats:{},pending:!!this.pending(),tradeFeePercent:gate.tradeFeePercent};
    // Read views remain available even when local money operations are disabled.
    if(!config.Definitions?.Enabled)return empty;
    const [groupsResponse,myResponse,tradesResponse]=await Promise.all([
      client.marketplace.getGroupedOffers(),client.marketplace.getMyState(undefined,{forceRefresh:true}),client.marketplace.getHistory(undefined,100,'Deals'),
    ]);
    const groups=idosResult(groupsResponse),my=idosResult(myResponse),historyResponse=idosResult(tradesResponse);
    const history=(historyResponse.Entries??[]).map(cardMarketTrade).filter((x):x is CardMarketTrade=>!!x);
    const own=Array.from(new Map([...(my.MyOffers??[]),...(my.Claimables??[])].map(row=>[row.OfferID,row])).values());
    return {...empty,groups:(groups.Groups??[]).filter(x=>x.GoodsCatalogID===CARD_ITEM_CATALOG_ID&&x.GoodsItemID&&Object.hasOwn(CARDS,x.GoodsItemID)).map(x=>x.GoodsItemID!),myOffers:own.map(cardMarketListing).filter((x):x is CardMarketListing=>!!x&&x.sellerUserId===this.identity.userId),history,stats:cardMarketStats(history)};
  });}
  async browse(cardId:string,cursor?:string){if(!Object.hasOwn(CARDS,cardId))throw new Error('Неизвестная карта.');return this.withAccount(async client=>{const r=idosResult(await client.marketplace.getOffersByItem(cardId,'Listing',cursor,50));return {offers:(r.Offers??[]).map(cardMarketListing).filter((x):x is CardMarketListing=>!!x),cursor:r.ContinuationToken??undefined};});}
  private async mutate<T>(work:(client:IDosGamesClient)=>Promise<T>,requireReady=true):Promise<T>{if(this.locked)throw new Error('Сделка уже обрабатывается.');this.locked=true;try{
    const locks=browserLocks();if(!locks)throw new Error('Для сделок нужен браузер с защитой платежей между вкладками.');
    return await locks.request(this.key(),()=>this.withAccount(async client=>{
      if(this.pending())throw new Error('Предыдущая сделка не подтверждена. Обновите рынок и проверьте историю.');
      if(requireReady){const gate=await this.capability(client);if(!gate.ready)throw new Error(gate.reason);}return work(client);
    }));
  }finally{this.locked=false;}}
  async create(cardId:string,quantity:number,priceImp:string,durationHours=72){cardMarketPrice(priceImp);if(!Object.hasOwn(CARDS,cardId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000||![24,72,168].includes(durationHours))throw new Error('Проверьте карту, количество и срок объявления.');return this.mutate(async client=>{
    const owned=cardItemCounts(idosResult(await client.user.getUserInventory()));if((owned[cardId]??0)<quantity)throw new Error('Нет нужного количества продаваемых копий. Бесплатный стартовый набор и прежние открытия не выставляются как товары.');
    const before=idosResult(await client.marketplace.getMyState(undefined,{forceRefresh:true}));this.begin({version:1,action:'create',cardId,quantity,priceImp,startedAt:Date.now(),knownOfferIds:(before.MyOffers??[]).map(x=>x.OfferID).filter(validOfferId)});
    // One server operation escrows goods AND inserts the offer. Never retry after a lost reply.
    const result=idosResult(await client.marketplace.createListing(cardId,CARD_ITEM_CATALOG_ID,quantity,{Entries:[{Type:'CryptoCurrency',CurrencyID:'Main',Amount:Number(priceImp)}]},durationHours));
    const listing=result.Offer&&cardMarketListing(result.Offer);if(!listing||listing.cardId!==cardId||listing.quantity!==quantity||listing.priceImp!==priceImp||listing.sellerUserId!==this.identity.userId)throw new Error('Объявление обработано, но ответ не совпадает. Сверьте мои объявления; повторного выставления не будет.');
    this.storage!.removeItem(this.key());return listing;
  });}
  async buy(offerId:string,expectedPriceImp:string){cardMarketPrice(expectedPriceImp);if(!validOfferId(offerId))throw new Error('Неизвестное объявление.');return this.mutate(async client=>{
    const offer=cardMarketListing(idosResult(await client.marketplace.getOffer(offerId)).Offer??{});
    if(!offer||offer.status!=='Active'||offer.sellerUserId===this.identity.userId||offer.priceImp!==expectedPriceImp||offer.expiresAt&&Date.parse(offer.expiresAt)<=Date.now())throw new Error('Объявление изменилось или недоступно. Обновите рынок перед покупкой.');
    idosResult(await client.user.getUserInventory());if(!cryptoAffordable(client.data.user.getCryptoCurrencyAmount('Main'),expectedPriceImp))throw new Error('Недостаточно IMP на игровом счёте. Пополните его из Phantom.');
    this.begin({version:1,action:'buy',offerId,cardId:offer.cardId,quantity:offer.quantity,priceImp:offer.priceImp,sellerUserId:offer.sellerUserId,startedAt:Date.now()});const result=idosResult(await client.marketplace.buy(offerId));
    const parties=[result.Settlement?.FromUserID,result.Settlement?.ToUserID];
    if(result.OfferID!==offerId||result.Status!=='Completed'||!result.Settlement||!parties.includes(this.identity.userId!)||!parties.includes(offer.sellerUserId))throw new Error('Статус покупки ещё не подтверждён. Сверьте историю; повторной оплаты не будет.');
    this.storage!.removeItem(this.key());return result;
  });}
  async cancel(offerId:string){if(!validOfferId(offerId))throw new Error('Неизвестное объявление.');return this.mutate(async client=>{
    const offer=cardMarketListing(idosResult(await client.marketplace.getOffer(offerId)).Offer??{});if(!offer||offer.sellerUserId!==this.identity.userId||!['Active','Expired'].includes(offer.status))throw new Error('Можно вернуть карты только из своего непроданного объявления.');
    const expired=offer.status==='Expired'||!!offer.expiresAt&&Date.parse(offer.expiresAt)<=Date.now();
    if(expired){
      const my=idosResult(await client.marketplace.getMyState(undefined,{forceRefresh:true}));if(!my.Claimables?.some(row=>row.OfferID===offerId))throw new Error('Карты этого объявления уже возвращены или возврат ещё проверяется. Обновите коллекцию.');
      this.begin({version:1,action:'reclaim',offerId,cardId:offer.cardId,quantity:offer.quantity,priceImp:offer.priceImp,startedAt:Date.now()});
      const r=idosResult(await client.marketplace.claimBack(offerId)),entries=r.Resources?.Grant?.Standard?.Entries;
      if(r.OfferID!==offerId||!['Expired','Cancelled'].includes(r.Status??'')||entries?.length!==1||entries[0].Type!=='Item'||entries[0].CatalogID!==CARD_ITEM_CATALOG_ID||entries[0].ItemID!==offer.cardId||entries[0].Amount!==offer.quantity)throw new Error('Возврат карт ещё не подтверждён. Обновите мои объявления.');
      this.storage!.removeItem(this.key());return r;
    }
    this.begin({version:1,action:'cancel',offerId,startedAt:Date.now()});const r=idosResult(await client.marketplace.cancelListing(offerId));if(r.OfferID!==offerId||r.Status!=='Cancelled')throw new Error('Снятие объявления ещё не подтверждено. Обновите мои объявления.');this.storage!.removeItem(this.key());return r;
  },false);}
  async recover():Promise<boolean>{const locks=browserLocks();if(!locks)throw new Error('Для проверки сделки нужен современный браузер.');return locks.request(this.key(),()=>this.withAccount(async client=>{const p=this.pending();if(!p)return true;const my=idosResult(await client.marketplace.getMyState(undefined,{forceRefresh:true}));
    if(p.action==='create'){const matches=(my.MyOffers??[]).map(cardMarketListing).filter((x):x is CardMarketListing=>!!x&&x.cardId===p.cardId&&x.quantity===p.quantity&&x.priceImp===p.priceImp&&x.sellerUserId===this.identity.userId&&!p.knownOfferIds?.includes(x.offerId));if(matches.length!==1)return false;}
    else if(p.action==='cancel'){const offer=idosResult(await client.marketplace.getOffer(p.offerId!)).Offer;if(offer?.Status!=='Cancelled'||offer.CreatorUserID!==this.identity.userId)return false;}
    else if(p.action==='reclaim'){
      // Expired alone is NOT a refund. The complete native Claimables list must explicitly
      // show no remaining escrow for this known claimable, and its immutable goods must match.
      if(!Array.isArray(my.Claimables)||my.Claimables.some(row=>row.OfferID===p.offerId))return false;
      const offer=cardMarketListing(idosResult(await client.marketplace.getOffer(p.offerId!)).Offer??{});
      if(!offer||!['Expired','Cancelled'].includes(offer.status)||offer.sellerUserId!==this.identity.userId||offer.cardId!==p.cardId||offer.quantity!==p.quantity||offer.priceImp!==p.priceImp)return false;
    }
    else {const history=idosResult(await client.marketplace.getHistory(undefined,100,'Deals'));if(!(history.Entries??[]).some(raw=>{const row=cardMarketTrade(raw);return !!row&&row.offerId===p.offerId&&row.buyerUserId===this.identity.userId&&row.cardId===p.cardId&&row.quantity===p.quantity&&row.priceImp===p.priceImp&&row.sellerUserId===p.sellerUserId;}))return false;}
    this.storage!.removeItem(this.key());return true;
  }));}
}
