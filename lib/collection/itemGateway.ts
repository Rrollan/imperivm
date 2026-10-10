import type {IDosGamesClient} from '@idosgames/core';
import type {IDosRuntime} from '../idos/client';
import {idosResult} from '../idos/auth';
import {CARDS} from '../cards';
import {IDosCollectionGateway} from './idos';
import {withFreeCards,cleanOwned} from './access';
import {CARD_ITEM_CATALOG_ID,CARD_PACK_LOOTBOX_ID,cardItemCounts,validateCardItemDefinitions,validateCardLootboxDefinitions,itemPackDrops} from '../idos/cardEconomy';
import {COMMERCE_CONFIG,cryptoAffordable} from '../idos/commerce';
import {validateImpToken} from '../idos/token';
import {PackPaymentReceipt} from './paymentReceipt';
import {IDOS_CONFIG,REAL_PACK_COST,type CollectionSnapshot,type PackResult,type RulerCaseResult} from './gateway';
import {browserLocks} from '../browserLocks';

/** Preserve legacy collection unlocks, while new native Item copies have server-managed quantities. */
export class IDosCardItemGateway extends IDosCollectionGateway {
  constructor(private readonly itemRuntime:IDosRuntime){super(itemRuntime);}
  private itemBusy=false;
  private async itemOwnership(client:IDosGamesClient):Promise<Record<string,number>> {
    const defs=idosResult(await client.title.getItemDefinitions());
    if(!defs.Catalogs?.[CARD_ITEM_CATALOG_ID])return {};
    validateCardItemDefinitions(defs);return cardItemCounts(idosResult(await client.user.getUserInventory()));
  }
  async load():Promise<CollectionSnapshot>{const identity=this.itemRuntime.getSnapshot(),legacy=await super.load();return this.itemRuntime.withAccount(async client=>{
    const current=this.itemRuntime.getSnapshot();
    if(current.userId!==identity.userId||current.owner!==identity.owner||current.revision!==identity.revision||client.auth.context?.userID!==identity.userId)throw new Error('Аккаунт iDos изменился. Обновите коллекцию.');
    const items=await this.itemOwnership(client),owned={...legacy.owned};
    for(const [id,count] of Object.entries(items))owned[id]=Math.max(owned[id]??0,count);
    return {...legacy,owned:withFreeCards(owned),ownership:'items-and-legacy',packKind:'tradable-items'};
  });}
  async openPack():Promise<PackResult>{
    if(this.itemBusy)throw new Error('Пак уже открывается.');this.itemBusy=true;
    try {return await this.itemRuntime.withAccount(async client=>{
      const user=client.auth.context?.userID,identity=this.itemRuntime.getSnapshot(),locks=browserLocks();
      if(!user||identity.status!=='wallet'||identity.userId!==user||!identity.owner||!locks)throw new Error('Войдите кошельком в iDos и откройте игру в современном браузере.');
      return locks.request(`imperivm.pack-payment:${IDOS_CONFIG.title}:${user}`,async()=>{
        const assertWallet=()=>{const current=this.itemRuntime.getSnapshot();if(current.status!=='wallet'||current.userId!==user||current.owner!==identity.owner||current.revision!==identity.revision||client.auth.context?.userID!==user)throw new Error('Аккаунт iDos изменился. Обновите коллекцию.');};
        assertWallet();
        validateImpToken(idosResult(await client.title.getCurrencyDefinitions()));
        validateCardItemDefinitions(idosResult(await client.title.getItemDefinitions()));
        const boxes=idosResult(await client.lootbox.getDefinitions({forceRefresh:true})).LootboxDefinitions;
        if(!boxes)throw new Error('Новый пак продаваемых карт ещё не настроен на iDos.');validateCardLootboxDefinitions(boxes);
        if(!COMMERCE_CONFIG.enabled)throw new Error('Покупки за реальные IMP временно выключены.');
        const inventory=idosResult(await client.user.getUserInventory()),before=cardItemCounts(inventory);
        if(!cryptoAffordable(client.data.user.getCryptoCurrencyAmount('Main'),String(REAL_PACK_COST)))throw new Error(`Для пака нужно ${REAL_PACK_COST} IMP на игровом счёте.`);
        const receipt=new PackPaymentReceipt(IDOS_CONFIG.title!,user);if(receipt.status()==='accepted')receipt.clear();assertWallet();receipt.begin(CARD_PACK_LOOTBOX_ID,REAL_PACK_COST);
        const result=idosResult(await client.lootbox.open(CARD_PACK_LOOTBOX_ID,1,'IMP'));
        if(result.LootboxID!==CARD_PACK_LOOTBOX_ID||result.OpenedCount!==1)throw new Error('Пак обработан, но статус ещё не подтверждён. Сверьте коллекцию перед новой покупкой.');
        const drops=itemPackDrops(result.Results?.[0]??result.Resources);
        const current=cardItemCounts(idosResult(await client.user.getUserInventory()));
        const amounts:Record<string,number>={};for(const id of drops)amounts[id]=(amounts[id]??0)+1;
        for(const [id,count] of Object.entries(amounts))if((current[id]??0)<(before[id]??0)+count)throw new Error('Полученные копии ещё не подтверждены сервером. Обновите коллекцию.');
        assertWallet();receipt.accept();receipt.clear();
        const legacy=idosResult(await client.collection.getUserState());
        const owned=cleanOwned(legacy.OwnedCollectibles);for(const [id,count] of Object.entries(current))owned[id]=Math.max(owned[id]??0,count);
        const exactBalance=client.data.user.getCryptoCurrencyAmount('Main');if(!/^\d+(?:\.\d{1,6})?$/.test(exactBalance))throw new Error('iDos вернул некорректный баланс IMP.');
        const snapshot:CollectionSnapshot={mode:'idos',rug:Number(exactBalance),exactBalance,owned:withFreeCards(owned),packsOpened:0,collectionCurrency:legacy.CollectionCurrencyBalance??0,ownership:'items-and-legacy',packKind:'tradable-items',
          heroes:(await import('./heroAccess')).heroesFromCollectibles(legacy.OwnedCollectibles)};
        const duplicates=drops.map(id=>{const duplicate=(before[id]??0)>0;before[id]=(before[id]??0)+1;return duplicate;});
        return {cards:drops.map(id=>CARDS[id]),snapshot,duplicates};
      });
    });}finally{this.itemBusy=false;}
  }
  async openRulerCase():Promise<RulerCaseResult>{const result=await super.openRulerCase();return {...result,snapshot:await this.load()};}
}
