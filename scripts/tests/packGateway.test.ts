import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {IDosGamesClient} from '@idosgames/core';
import type {IDosRuntime} from '../../lib/idos/client';
process.env.NEXT_PUBLIC_IDOS_COMMERCE_ENABLED='true';
async function main(){
 const {IDosCollectionGateway}=await import('../../lib/collection/idos');
 const {IDOS_CONFIG,REAL_PACK_COST}=await import('../../lib/collection/gateway');
 const defs=JSON.parse(readFileSync('docs/idos/agora-collection.json','utf8'));
 const amounts=new Map<string,string>(),storage={getItem:(k:string)=>amounts.get(k)??null,setItem:(k:string,v:string)=>{amounts.set(k,v);},removeItem:(k:string)=>{amounts.delete(k);}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:storage}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_name:string,work:()=>Promise<unknown>)=>work()}}});
 const {IMPERIVM_TITLE}=await import('../../lib/idos/title');
 let calls=0,balance='490021.764541',fail=false;
 const owns:Record<string,number>={};
 const client={auth:{context:{userID:'user-test'}},title:{getCurrencyDefinitions:async()=>({ok:true,data:{CryptoCurrencies:{Main:{CurrencyID:'Main',Status:'Active',Permissions:{SpendableInGame:true},Networks:[{NetworkID:IMPERIVM_TITLE.network,ContractAddress:IMPERIVM_TITLE.mint,Decimals:6}]}}}})},collection:{getDefinitions:async()=>({ok:true,data:defs}),getUserState:async()=>({ok:true,data:{CollectionID:IDOS_CONFIG.collection,OwnedCollectibles:owns}}),openPack:async(_c:string,_p:string,count:number,options:unknown)=>{calls++;assert.equal(count,1);assert.deepEqual(options,{selectedOptionID:'IMP'});if(fail)throw Error('Lost reply after send'); balance='390021.764541'; const drops=defs.Collections[IDOS_CONFIG.collection].Sets[0].Collectibles.slice(0,5).map((c:{CollectibleID:string})=>{owns[c.CollectibleID]=1;return {CollectibleID:c.CollectibleID};});return {ok:true,data:{GrantedCollectibles:drops}};}},blockchain:{getDefinitions:async()=>({ok:true,data:(await client.title.getCurrencyDefinitions()).ok ? (await client.title.getCurrencyDefinitions() as any).data : {}}),getUserState:async()=>({ok:true,data:{}})},data:{user:{getCryptoCurrencyAmount:()=>balance}}} as unknown as IDosGamesClient;
 const runtime={withAccount:async(work:(c:IDosGamesClient)=>Promise<unknown>)=>work(client)} as unknown as IDosRuntime;
 const gateway=new IDosCollectionGateway(runtime);
 assert.equal((await gateway.load()).exactBalance,balance);
 const cost=defs.PackTypes[IDOS_CONFIG.pack].PriceOptions.IMP.Cost.Standard.Entries[0];
 for(const oldPrice of [50,225_000]){cost.Amount=oldPrice;await assert.rejects(gateway.openPack(),/cost exactly 100000/);assert.equal(calls,0,'Old prices must be rejected before a server debit');}cost.Amount=REAL_PACK_COST;
 balance='99999.999999';await assert.rejects(gateway.openPack(),/100000/);assert.equal(calls,0);
 balance='490021.764541';const opened=await gateway.openPack();assert.equal(opened.cards.length,5);assert.equal(opened.snapshot.exactBalance,'390021.764541');assert.equal(calls,1);assert.equal(amounts.size,0,'Confirmed collection reconciles a known successful charge');
 fail=true;await assert.rejects(gateway.openPack(),/Lost reply/);assert.equal(calls,2);assert.equal(amounts.size,1);
 const reloaded=new IDosCollectionGateway(runtime);assert((await reloaded.load()).purchaseBlocked);await assert.rejects(reloaded.openPack(),/заблокировано/);assert.equal(calls,2,'Reload cannot repeat a debit after a lost reply');
 console.log('Pack gateway checks passed: fixed server pricing, exact insufficient balance, successful five-card grant and durable network-loss duplicate-debit prevention. Mocked backend only.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
