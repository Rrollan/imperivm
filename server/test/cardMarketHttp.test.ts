import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {startServer} from '../src/service';
import type {CardPriceSnapshot} from '../../lib/idos/cardPrice';

test('market price HTTP accepts server history evidence only, with exact origin and bounded credentials',async t=>{
  const origin='https://si4ips8b.idos.games',owner='BpN6zQ3rec4sCyuRCzo9RaVk433fXyBBEmPghXswWnL6';
  const credential={userId:'fixture-account',sessionTicket:'fixture-ticket-no-real-credential'};
  const result:CardPriceSnapshot={schemaVersion:1,ready:false,coverage:'verified-reports',currencyID:'Main',symbol:'IMP',stats:{},sampleSize:0,units:0,updatedAt:null,reason:'Storage not configured'};
  let reads=0,syncs=0;
  const service=startServer({port:0,host:'127.0.0.1',origins:[origin],cardMarketPrices:{read:async()=>{reads++;return result;},sync:async(address,auth)=>{syncs++;assert.equal(address,owner);assert.deepEqual(auth,credential);return {...result,accepted:0};}}});
  t.after(()=>service.close());if(!service.server.listening)await once(service.server,'listening');
  const url=`http://127.0.0.1:${(service.server.address() as {port:number}).port}/market/prices`;
  assert.equal((await fetch(url)).status,200);assert.equal(reads,1);
  const options={method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({owner,collectionAuth:credential})};
  const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:origin}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(preflight.headers.get('Access-Control-Allow-Headers'),'Content-Type');
  const response=await fetch(url,options);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(syncs,1);
  assert.equal((await fetch(url,{...options,headers:{Origin:'https://attacker.test'}})).status,403);
  assert.equal((await fetch(url,{...options,headers:{}})).status,403);
  assert.equal((await fetch(url+'?history=spoof',options)).status,400);
  assert.equal((await fetch(url,{...options,body:'x'.repeat(16385)})).status,413);
  assert.equal((await fetch(url,{...options,body:JSON.stringify({owner,collectionAuth:credential,prices:{fake:9000}})})).status,400);
  assert.equal((await fetch(url,{...options,body:JSON.stringify({owner,collectionAuth:{...credential,sessionTicket:'bad'}})})).status,400);
  assert.equal(syncs,1);
});
