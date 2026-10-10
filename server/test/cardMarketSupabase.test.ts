import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createSupabaseCardMarketRepository,boundedMarketJson} from '../src/cardMarketSupabase';
import {aggregateCardDeals} from '../src/cardMarketPrices';

const at='2026-10-10T00:00:00.000Z';
const deal={offerId:'fixture-offer',cardId:'dogen',quantity:2,priceImp:'301',completedAt:at};
const key='sb_secret_fixture_server_only';
const url='https://fixture.supabase.co';
const legacy=(role:string)=>`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({role})).toString('base64url')}.fixture_signature`;

test('Supabase RPC authenticates server secrets via apikey, and persists only receipt facts atomically',async()=>{
  const calls:string[]=[];
  const repository=createSupabaseCardMarketRepository({supabaseUrl:url,supabaseKey:key,fetcher:async(target,options)=>{
    calls.push(String(target));assert.equal(options?.method,'POST');assert.equal(options?.redirect,'error');assert.ok(options?.signal);
    const headers=new Headers(options?.headers);assert.equal(headers.get('apikey'),key);assert.equal(headers.get('Authorization'),null);
    const body=JSON.parse(String(options?.body));assert.equal(body.p_title_id,'SI4IPS8B');
    if(String(target).endsWith('/card_market_insert_deals')){assert.deepEqual(body.p_deals,[{offer_id:'fixture-offer',card_id:'dogen',quantity:2,price_imp:'301',completed_at:at}]);return new Response('1');}
    assert.deepEqual(body,{p_title_id:'SI4IPS8B'});return new Response(JSON.stringify(aggregateCardDeals([deal],at)));
  }});
  assert.equal(await repository.insert([deal]),1);assert.equal((await repository.read()).stats.dogen.meanImp,'150.5');assert.deepEqual(calls,[`${url}/rest/v1/rpc/card_market_insert_deals`,`${url}/rest/v1/rpc/card_market_price_snapshot`]);
  assert.equal(await repository.insert([]),0);assert.equal(calls.length,2);
});

test('legacy service_role JWT is supported; publishable, anon and malformed configuration are denied locally',async()=>{
  const old=legacy('service_role');
  const repository=createSupabaseCardMarketRepository({supabaseUrl:url,supabaseKey:old,fetcher:async(_target,options)=>{const headers=new Headers(options?.headers);assert.equal(headers.get('apikey'),old);assert.equal(headers.get('Authorization'),`Bearer ${old}`);return new Response(JSON.stringify(aggregateCardDeals([],null)));}});assert.equal((await repository.read()).ready,true);
  for(const invalid of ['', 'sb_publishable_fixture',legacy('anon'),legacy('authenticated'),'not-a-secret'])assert.throws(()=>createSupabaseCardMarketRepository({supabaseUrl:url,supabaseKey:invalid}));
  for(const invalid of ['http://fixture.supabase.co','https://user:password@fixture.supabase.co','https://fixture.supabase.co/attacker','https://fixture.supabase.co/?key=value'])assert.throws(()=>createSupabaseCardMarketRepository({supabaseUrl:invalid,supabaseKey:key}));
});

test('RPC errors are sanitized, malformed aggregates/accepted counts and oversized bodies fail closed',async()=>{
  const failure=createSupabaseCardMarketRepository({supabaseUrl:url,supabaseKey:key,fetcher:async()=>new Response(JSON.stringify({message:`conflict, ${key}`}),{status:409})});
  await assert.rejects(failure.insert([deal]),error=>error instanceof Error&&error.message==='Market price storage unavailable'&&!error.message.includes(key));
  for(const response of ['{}','null','{"ready":true}']){const repository=createSupabaseCardMarketRepository({supabaseUrl:url,supabaseKey:key,fetcher:async()=>new Response(response)});await assert.rejects(repository.read());}
  for(const result of ['-1','2','1.5','"1"','null']){const repository=createSupabaseCardMarketRepository({supabaseUrl:url,supabaseKey:key,fetcher:async()=>new Response(result)});await assert.rejects(repository.insert([deal]));}
  await assert.rejects(boundedMarketJson(new Response('x'.repeat(20)),10));await assert.rejects(boundedMarketJson(new Response('{}',{headers:{'Content-Length':'1000001'}})));
});

test('migration fixes privileges, RLS, immutable unique identity and security definer search paths',async()=>{
  const sql=await readFile(join(__dirname,'../../supabase/migrations/202610100001_card_market.sql'),'utf8');
  assert.match(sql,/primary key \(title_id, offer_id\)/);assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table public\.card_market_deals from public, anon, authenticated, service_role/);
  assert.equal((sql.match(/security definer\nset search_path = ''/g)||[]).length,3);assert.match(sql,/stable\nsecurity definer\nset search_path = ''/);
  assert.match(sql,/grant execute on function public\.card_market_insert_deals\(text, jsonb\) to service_role/);assert.match(sql,/grant execute on function public\.card_market_price_snapshot\(text\) to service_role/);
  assert.match(sql,/on conflict \(title_id, offer_id\) do nothing/);assert.match(sql,/Conflicting verified market deal/);assert.doesNotMatch(sql,/do update/i);
});
