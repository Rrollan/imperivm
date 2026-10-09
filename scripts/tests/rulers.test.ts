import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import type {CollectionDefinitions} from '@idosgames/core';
import {HEROES,FREE_HERO_IDS,CASE_HERO_IDS} from '../../lib/heroes';
import {CARDS} from '../../lib/cards';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {createGame,applyAction,legalActions,effectivePowerCost} from '../../lib/engine/engine';
import {gameSnapshot,applyMove} from '../../lib/engine/network';
import type {Minion,GameState} from '../../lib/engine/types';
import {GameSession} from '../../components/presentation/GameSession';
import {videoCues} from '../../components/presentation/videoCue';
import {abilityCues} from '../../components/presentation/abilityCues';
import {arenaViewport} from '../../components/presentation/arenaViewport';
import {fighterRow} from '../../components/presentation/battleLayout';
import {heroesFromCollectibles,LocalCollectionGateway,parseLocalCollection,IDOS_CONFIG,REAL_PACK_COST,REAL_RULER_CASE_COST,rulerCollectible} from '../../lib/collection/gateway';
import {PACK_CARD_IDS} from '../../lib/collection/access';
import {IDOS_RARITIES,validateIDosDefinitions,validateRulerCase} from '../../lib/collection/idos';
import {authorizeCollectionDeck} from '../../lib/collection/authority';
import {MultiplayerStore} from '../../lib/multiplayer/store';
import {parseCommand} from '../../lib/multiplayer/validation';

const fighter=(uid:string,cardId='pixel-squire',extra:Partial<Minion>={}):Minion=>({uid,cardId,name:CARDS[cardId].name,attack:2,health:4,maxHealth:4,canAttack:true,staked:false,fresh:false,...extra});
function fixture(hero:string,seat:0|1=0):GameState{
 const state=createGame(seat===0?hero:'builder',FREE_DECKS[seat===0?hero:'builder'],seat===1?hero:'builder',FREE_DECKS[seat===1?hero:'builder'],71);
 state.turn=seat;state.block=9;state.players.forEach(p=>{p.gas=p.maxGas=10;p.hand=[];p.board=[];});return state;
}
function power(before:GameState){
 const original=structuredClone(before),game=new GameSession(before),batch=game.dispatch({type:'hero-power'});
 assert(batch);assert.deepEqual(before,original,'A power never mutates its input');
 assert(!legalActions(batch.after).some(a=>a.type==='hero-power'),'Once per turn');
 assert.throws(()=>applyAction(batch.after,{type:'hero-power'}));
 assert(abilityCues(batch).length,'An actual power has a native cue');
 game.impact(batch.id);game.complete(batch.id);assert.deepEqual(game.snapshot().shown,batch.after);
 return batch;
}

async function main(){
 assert.equal(Object.keys(HEROES).length,9);assert.equal(FREE_HERO_IDS.length,5);assert.equal(CASE_HERO_IDS.length,4);
 for(const hero of [...FREE_HERO_IDS,...CASE_HERO_IDS]){
  const state=fixture(hero);state.players[0].treasury=24;state.players[0].board=[fighter('ally')];state.players[1].board=[fighter('enemy')];
  const b=power(state);assert.equal(b.after.players[0].gas,10-HEROES[hero].powerCost);
  assert.equal(gameSnapshot(b.after,1,0).players[0].hand,undefined,'Opponent hand stays hidden');
  if(hero!=='validator')assert(videoCues(b).length,`${hero} has an exact video target`);
  else assert.equal(videoCues(b).length,0,'Reservation is not a fake instant payout');
  state.players[0].treasury=5;assert(effectivePowerCost(state,0)>=1,'No free comeback power');
  if(!['whale','builder','degen','validator'].includes(hero)){assert(existsSync(`public/ui/heroes/rulers-v2/${hero}.png`));assert(existsSync(`public/ui/heroes/rulers-v2/${hero}.webp`),'Runtime coin asset exists');}
 }
 for(const seat of [0,1] as const){
  let state=fixture('validator',seat);state=power(state).after;
  assert.equal(state.players[seat].powerIncome,2);assert.equal(gameSnapshot(state,seat,0).players[seat].powerIncome,2);
  state=applyAction(state,{type:'end-turn'});assert.equal(state.players[seat].powerIncome,2);
  state=applyAction(state,{type:'end-turn'});assert.equal(state.players[seat].gas,12);assert.equal(state.players[seat].powerIncome,undefined);
  state=applyAction(applyAction(state,{type:'end-turn'}),{type:'end-turn'});assert.equal(state.players[seat].gas,10,'No repeated payout');
 }
 let state=fixture('builder');
 // Same printed card, different missing health: the wounded target is explicit.
 state.players[0].board=[fighter('less','pixel-squire',{health:3}),fighter('most','pixel-squire',{health:1})];
 let b=power(state);assert.equal(b.after.players[0].board[1].health,3);assert.equal(b.after.players[0].treasury,30);
 assert.equal(videoCues(b)[0].anchor,'most','Fighter-only healing follows the fighter');
 for(const seat of [0,1] as const){
  const patch=fixture('builder',seat),me=patch.players[seat],foe=patch.players[seat===0?1:0];
  me.treasury=29;
  me.board=[fighter('first','pixel-squire',{health:2}),fighter('tie','pixel-squire',{health:2})];
  foe.treasury=18;foe.board=[fighter('enemy','pixel-squire',{health:1})];
  const applied=power(patch).after;
  assert.deepEqual(applied.players[seat].board.map(m=>m.health),[4,2],'Heal 2, with deterministic formation ties');
  assert.equal(applied.players[seat].treasury,30,'Treasury heal is capped');
  assert.equal(applied.players[seat===0?1:0].treasury,foe.treasury,'Opponent treasury is untouched');
  assert.deepEqual(applied.players[seat===0?1:0].board.map(m=>[m.uid,m.attack,m.health,m.maxHealth,m.canAttack,m.staked]),foe.board.map(m=>[m.uid,m.attack,m.health,m.maxHealth,m.canAttack,m.staked]),'Only the owner is healed');
  assert.equal(applied.players[seat].gas,8,'Same two-order cost for either seat');
  assert.equal(gameSnapshot(applied,seat,0).players[seat].board[0].health,4,'Online snapshot includes the same repair');
  me.treasury=30;me.board=[fighter('cap','pixel-squire',{health:3})];
  assert.equal(power(patch).after.players[seat].board[0].health,4,'No overhealing');
  me.board[0].health=4;assert(!legalActions(patch).some(a=>a.type==='hero-power'),'Never offer a repair with nothing to heal');
 }
 state=fixture('athena');assert(!legalActions(state).some(a=>a.type==='hero-power'));
 state.players[0].board=[fighter('first','pixel-squire',{health:1}),fighter('second','pixel-squire',{health:1,fresh:true})];
 b=power(state);assert.equal(b.after.players[0].board[0].maxHealth,5);assert.equal(b.after.players[0].board[1].maxHealth,4);
 state.players[0].board[1].fresh=false;b=power(state);assert.equal(b.after.players[0].board[0].maxHealth,6);assert.equal(b.after.players[0].board[0].taunt,true);
 state=fixture('hermes');b=power(state);assert.equal(b.after.players[0].treasury,27);assert.equal(b.after.players[0].hand.length,1);
 state.players[0].factionPlaysThisTurn={DePIN:1};assert.equal(power(state).after.players[0].treasury,30);
 state.players[0].treasury=1;state.players[0].deck=[];b=power(state);assert.equal(b.after.winner,1,'Fatigue still kills a protected relay');
 state=fixture('hephaestus');b=power(state);assert.deepEqual([b.after.players[0].board[0].attack,b.after.players[0].board[0].health],[2,2]);
 state.players[0].board=[fighter('stake','lending-legionnaire',{staked:true,fresh:true})];b=power(state);assert.equal(b.after.players[0].board[1].attack,2);
 state.players[0].board[0].fresh=false;b=power(state);assert.deepEqual([b.after.players[0].board[1].attack,b.after.players[0].board[1].health],[3,3]);assert.equal(b.after.players[0].board[1].canAttack,false);
 for(const hero of ['strategist','hephaestus']){state=fixture(hero);state.players[0].board=Array.from({length:5},(_,i)=>fighter(`full-${i}`));assert(!legalActions(state).some(a=>a.type==='hero-power'));assert.throws(()=>applyAction(state,{type:'hero-power'}));}
 state=fixture('poseidon');assert(!legalActions(state).some(a=>a.type==='hero-power'));state.players[1].board=[fighter('one','pixel-squire',{health:1}),fighter('two')];
 b=power(state);assert.equal(b.after.players[1].board.length,1);assert.equal(b.after.players[1].board[0].health,3);
 state.players[0].factionPlaysThisTurn={DeFi:2};b=power(state);assert.equal(b.after.players[1].board[0].health,2);assert(videoCues(b).every(c=>['one','two'].includes(c.anchor)));
 assert.throws(()=>applyMove(state,1,{type:'hero-power'}),'Wrong seat cannot use a power');
 let opening=createGame('builder',FREE_DECKS.builder,'builder',FREE_DECKS.builder,{enableMulligan:true},71);
 opening=applyAction(applyAction(opening,{type:'mulligan',uids:[]}),{type:'end-turn'});assert.equal(opening.players[1].gas,0);
 opening=applyAction(opening,{type:'mulligan',uids:[]});assert.equal(opening.players[1].gas,2);assert.equal(opening.players[1].maxGas,1);assert.throws(()=>applyAction(opening,{type:'mulligan',uids:[]}));
 opening=applyAction(applyAction(opening,{type:'end-turn'}),{type:'end-turn'});assert.equal(opening.players[1].gas,2);assert.equal(opening.players[1].maxGas,2,'Bonus expires at refill');
 for(const [w,h] of [[844,390],[932,430],[1280,720]]){const v=arenaViewport(w,h);assert(!v.portrait);if(h<=540)assert.equal(v.halfWidth,16,'No sidebars inside phone host');for(let n=1;n<=7;n++){const row=fighterRow(n,0,v.portrait,v.compact);assert(row.width<=row.spacing,'Formation never overlaps');}}
 assert(arenaViewport(390,844).portrait);
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
 const gateway=new LocalCollectionGateway(storage,()=>0);assert.deepEqual((await gateway.load()).heroes,FREE_HERO_IDS);
 const first=await gateway.openRulerCase();assert.equal(first.heroId,CASE_HERO_IDS[0]);assert.equal(first.snapshot.rug,300);assert(!first.duplicate);
 const duplicate=await gateway.openRulerCase();assert(duplicate.duplicate);assert.equal(duplicate.snapshot.rug,100);assert.equal(duplicate.snapshot.collectionCurrency,100);
 await assert.rejects(gateway.openRulerCase());assert.equal((await gateway.load()).rug,100);
 assert.deepEqual(parseLocalCollection(JSON.stringify({version:2,rug:500,packsOpened:0,owned:{},heroes:['forged']})).heroes,FREE_HERO_IDS);
 assert(!heroesFromCollectibles({'ruler-athena':0,'ruler-hermes':-1,'ruler-poseidon':'1'}).includes('poseidon'));
 const defs:CollectionDefinitions={Collections:{[IDOS_CONFIG.collection]:{Sets:[{SetID:'AGORA',Collectibles:[...PACK_CARD_IDS.map(id=>({CollectibleID:id,Rarity:IDOS_RARITIES[CARDS[id].rarity]})),...CASE_HERO_IDS.map(id=>({CollectibleID:rulerCollectible(id),Rarity:5}))]}]}},PackTypes:{[IDOS_CONFIG.pack]:{CollectibleCount:5,RarityWeights:{1:60,2:25,3:11,4:4,5:0},PriceOptions:{[IDOS_CONFIG.payment]:{Cost:{Standard:{Entries:[{Type:IDOS_CONFIG.currencyType,CurrencyID:IDOS_CONFIG.currency,Amount:REAL_PACK_COST}]}}}}},[IDOS_CONFIG.rulerCase]:{CollectibleCount:1,RarityWeights:{5:100},GuaranteedMinRarity:5,PriceOptions:{[IDOS_CONFIG.payment]:{Cost:{Standard:{Entries:[{Type:IDOS_CONFIG.currencyType,CurrencyID:IDOS_CONFIG.currency,Amount:REAL_RULER_CASE_COST}]}}}}}},DuplicateConversions:[1,2,3,4,5].map(Rarity=>({Rarity,CollectionCurrencyGranted:100}))};
 validateIDosDefinitions(defs);validateRulerCase(defs);
 const unsafe=structuredClone(defs);unsafe.PackTypes![IDOS_CONFIG.pack].RarityWeights![5]=1;assert.throws(()=>validateIDosDefinitions(unsafe));
 const altered=structuredClone(defs);altered.PackTypes![IDOS_CONFIG.rulerCase].CollectibleCount=2;assert.throws(()=>validateRulerCase(altered));
 const title=process.env.IDOS_TITLE_ID;process.env.IDOS_TITLE_ID='fixture-rulers';const auth={userId:'ruler-test',sessionTicket:'test-session-ticket-no-real-auth'};
 const backend=(owned:Record<string,number>):typeof fetch=>async()=>new Response(JSON.stringify({Success:true,Data:{CollectionID:IDOS_CONFIG.collection,OwnedCollectibles:owned}}));
 await assert.rejects(authorizeCollectionDeck(FREE_DECKS.athena,auth,backend({}),'athena'));
 await authorizeCollectionDeck(FREE_DECKS.athena,auth,backend({'ruler-athena':1}),'athena');
 await assert.rejects(authorizeCollectionDeck(FREE_DECKS.athena,undefined,backend({'ruler-athena':1}),'athena'));
 if(title===undefined)delete process.env.IDOS_TITLE_ID;else process.env.IDOS_TITLE_ID=title;
 const store=new MultiplayerStore(),token=store.createSession();assert.throws(()=>store.command(token,{type:'queue',heroId:'athena'}));
 assert.throws(()=>parseCommand({type:'queue',heroId:'athena',verifiedHero:'athena'}),'Cannot forge server authorization');
 assert.throws(()=>parseCommand({type:'queue',heroId:'athena',collectionAuth:{userId:'bad',sessionTicket:'short'}}));
 assert.equal(store.command(token,{type:'queue',heroId:'athena'},'athena').queue?.heroId,'athena');
 console.log('RULERS OK: nine powers, both seats, immutable transitions, exact targets, conditional peaks, caps, fatigue, delayed payout, opening compensation, ownership, safe case definitions and phone geometry. No payments.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
