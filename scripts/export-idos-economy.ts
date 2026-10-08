import {writeFileSync} from 'node:fs';
import type {CollectionDefinitions, StoreDefinitions} from '@idosgames/core';
import {CARDS} from '../lib/cards';
import {PACK_CARD_IDS} from '../lib/collection/access';
import {IDOS_RARITIES, validateIDosDefinitions} from '../lib/collection/idos';
import {IDOS_CONFIG} from '../lib/collection/gateway';
const definitions:CollectionDefinitions={
 Collections:{[IDOS_CONFIG.collection]:{CollectionID:IDOS_CONFIG.collection,DisplayName:'Agora After Hours',Sets:[{SetID:'AGORA',Collectibles:PACK_CARD_IDS.map(id=>({CollectibleID:id,DisplayName:CARDS[id].name,Rarity:IDOS_RARITIES[CARDS[id].rarity],HasSpecialVersion:false}))}]}},
 PackTypes:{[IDOS_CONFIG.pack]:{PackTypeID:IDOS_CONFIG.pack,DisplayName:'Agora After Hours',CollectibleCount:5,GuaranteedMinRarity:1,GuaranteeMaxRarity:false,RarityWeights:{'1':60,'2':25,'3':11,'4':4},PriceOptions:{[IDOS_CONFIG.payment]:{Cost:{Standard:{Entries:[{Type:'VirtualCurrency',CurrencyID:IDOS_CONFIG.currency,Amount:50}]}}}}}},
 DuplicateConversions:[1,3,8,20].map((CollectionCurrencyGranted,index)=>({Rarity:index+1,CollectionCurrencyGranted})),
};
validateIDosDefinitions(definitions);
const store:StoreDefinitions={Stores:{IMPERIVM_IMP:{StoreID:'IMPERIVM_IMP',Identity:{DisplayName:'IMP'},Layout:{Sections:{IMP:{SectionID:'IMP',Slots:{}}}}}},StoreOffers:{}};
for(const rug of [250,1000,2500]) {
 const id=`IMP_${rug}_V1`;
 store.Stores!.IMPERIVM_IMP.Layout!.Sections!.IMP.Slots![`${rug}`]={SlotID:`${rug}`,Rotation:{Mode:'Fixed',OfferID:id}};
 store.StoreOffers![id]={OfferID:id,Identity:{DisplayName:`${rug} IMP`},Pricing:{Options:{
  USDC_V1:{Cost:{Standard:{Entries:[{Type:'CryptoCurrency',CurrencyID:'USDC',Amount:null}]}}},
  SOL_V1:{Cost:{Standard:{Entries:[{Type:'CryptoCurrency',CurrencyID:'SOL',Amount:null}]}}},
 }},Reward:{Grant:{Standard:{Entries:[{Type:'VirtualCurrency',CurrencyID:IDOS_CONFIG.currency,Amount:rug}]}}}};
}
writeFileSync('docs/idos/agora-collection.json',JSON.stringify(definitions,null,2)+'\n');
writeFileSync('docs/idos/rug-store-template.json',JSON.stringify(store,null,2)+'\n');
console.log('Wrote 50-card Agora definitions and disabled-price IMP store template. Approve/fill prices in iDos before publishing.');
