import assert from 'node:assert/strict';
import {createGame,mempoolOf} from '../lib/engine/engine';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import type {Action,Minion} from '../lib/engine/types';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';
import {playedFighter,directEffect} from '../components/presentation/directPlay';
import {battleFloats} from '../components/presentation/battleFloats';
import {abilityCues} from '../components/presentation/abilityCues';
import {videoCues} from '../components/presentation/videoCue';

function fighter(uid:string,cardId:string,overrides:Partial<Minion>={}):Minion{
  const c=CARDS[cardId];return {uid,cardId,name:c.name,attack:c.attack??0,health:c.health??1,maxHealth:c.health??1,canAttack:true,fresh:false,staked:false,...overrides};
}
function fixture(cardId:string,own:Minion[]=[],enemy:Minion[]=[],enemyHand:string[]=[]){
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,731);
  state.players.forEach(p=>{p.gas=p.maxGas=10;p.treasury=20;});
  state.players[0].hand=[{uid:`direct-${cardId}`,cardId}];state.players[0].board=own;
  state.players[1].hand=enemyHand.map((id,i)=>({uid:`enemy-${i}`,cardId:id}));state.players[1].board=enemy;
  return new GameSession(state);
}
function dispatch(game:GameSession,match:(a:Action)=>boolean):PresentationBatch{
  const action=game.legal().find(match);assert.ok(action,'The fixture must reach this action legally');
  const batch=game.dispatch(action)!;game.impact(batch.id);game.complete(batch.id);return batch;
}
const play=(g:GameSession)=>dispatch(g,a=>a.type==='play-minion');
const pass=(g:GameSession)=>dispatch(g,a=>a.type==='end-turn');
function queued(cardId:string,count:number){
  const game=fixture(cardId,[],[],['rug-pull','flash-loan'].slice(0,count));
  if(count){pass(game);for(let i=0;i<count;i++)dispatch(game,a=>a.type==='cast-spell');pass(game);}
  return game;
}

// This wounded witness remains wounded: increasing its maximum is a buff,
// while the newly deployed fighter is compared with its printed 3/4 baseline.
{
  const game=fixture('firmware-phalanx',[fighter('wounded','amm-centurion',{health:1,maxHealth:4})]);
  const batch=play(game),played=playedFighter(batch)!;
  assert.equal(played.attack,4);assert.equal(played.health,5);assert.equal(played.maxHealth,5);
  assert.deepEqual(directEffect(batch)?.targets.map(t=>[t.uid,t.attackBefore,t.attackAfter,t.healthBefore,t.healthAfter]),[['wounded',2,3,1,2],[played.uid,3,4,4,5]]);
  const floats=battleFloats(batch);
  assert.deepEqual(floats,[{anchor:'wounded',label:'+1/+1',kind:'buff'},{anchor:played.uid,label:'+1/+1',kind:'buff'}]);
  assert.equal(floats.some(f=>f.kind==='heal'),false,'Maximum-health growth must never be shown as recovery');
  const native=abilityCues(batch).filter(c=>c.kind==='buff');
  assert.deepEqual(native.map(c=>c.to),['wounded',played.uid]);assert.ok(native.every(c=>c.from===played.uid&&c.phase==='after'));
  assert.equal(videoCues(batch).length,2,'Deployment and one actual result share the sprite budget');
}

// Both triggers are preserved without inventing cancellations on an empty queue.
for(const count of [0,1,2]){
  const game=queued('frontrun-bot',count),batch=play(game),played=playedFighter(batch)!;
  const victims=batch.events?.spellCounters??[];
  assert.equal(victims.length,count);assert.equal(mempoolOf(batch.after,1).length,0);
  const cues=abilityCues(batch).filter(c=>c.kind==='counter');
  assert.deepEqual(cues.map(c=>c.to),victims.map(v=>`queued-${v.mempoolUid}`));
  assert.ok(cues.every(c=>c.from===played.uid&&c.phase==='after'));
  const videos=videoCues(batch);
  assert.equal(videos.length,count?2:1);assert.equal(videos.filter(c=>c.id==='09-spell-counter').length,count?1:0);
}

// Damage and cancellation coexist; the two sprite slots cannot erase either
// native outcome or label a counter victim as a treasury damage target.
{
  const batch=play(queued('sandwich-attacker',1)),source=playedFighter(batch)!.uid;
  assert.equal(batch.after.players[1].treasury,19);
  assert.deepEqual(battleFloats(batch),[{anchor:'hero-1',label:'−1',kind:'damage'}]);
  const native=abilityCues(batch);
  assert.ok(native.some(c=>c.kind==='steel'&&c.from===source&&c.to==='hero-1'));
  assert.ok(native.some(c=>c.kind==='counter'&&c.from===source&&c.to.startsWith('queued-')));
  assert.equal(videoCues(batch).length,2);
  assert.equal(videoCues(batch)[1].id,'09-spell-counter','Priority gets the second sprite slot; numeric/native damage remains present');
}
{
  const batch=play(fixture('minting-press')),source=playedFighter(batch)!;
  const summoned=batch.after.players[0].board.find(m=>m.cardId==='pixel-squire')!;
  assert.equal(source.cardId,'minting-press');assert.notEqual(source.uid,summoned.uid);
  assert.equal(videoCues(batch)[0].anchor,source.uid);
  assert.ok(abilityCues(batch).some(c=>c.from===source.uid&&c.to===summoned.uid));
}
{
  const game=queued('audit',1),batch=dispatch(game,a=>a.type==='cast-spell');
  assert.equal(batch.events?.spellResolved,undefined,'Priority at cast must not masquerade as delayed resolution');
  const source=`queued-${batch.events!.spellQueued!.mempoolUid}`,victim=`queued-${batch.events!.spellCountered!.mempoolUid}`;
  assert.deepEqual(videoCues(batch).map(c=>c.anchor),[victim]);
  assert.ok(abilityCues(batch).some(c=>c.kind==='counter'&&c.from===source&&c.to===victim));
  assert.equal(battleFloats(batch).some(f=>f.kind==='buff'),false,'Casting Audit must not buff before its next turn');
}

// A played damage source targets the real treasury fallback; capped recovery
// and empty AOE do not paint fake successful impacts.
{
  const batch=play(fixture('liquidation-officer'));
  assert.deepEqual(directEffect(batch)?.targets.map(t=>t.uid),['hero-1']);
  assert.deepEqual(battleFloats(batch),[{anchor:'hero-1',label:'−1',kind:'damage'}]);
}
{
  const game=fixture('gm-greeter');game.snapshot().state.players[0].treasury=30;
  const batch=play(game);
  assert.equal(directEffect(batch)?.targets.length,0);
  assert.equal(abilityCues(batch).some(c=>c.kind==='heal'),false);
  assert.equal(battleFloats(batch).some(c=>c.kind==='heal'),false);
  assert.equal(videoCues(batch).length,1);
}
{
  const batch=play(fixture('imperator-liquidus'));
  assert.equal(directEffect(batch)?.targets.length,0);assert.equal(videoCues(batch).length,1);
}
{
  const game=fixture('staking-pool'),state=game.snapshot().state;
  state.players[0].factionPlaysThisTurn={DeFi:1};
  const batch=play(game);
  assert.equal(batch.after.players[0].gas,9,'10 - cost 4 + Battlecry 2 + faction rebate 1');
  assert.equal(directEffect(batch)?.ordersGain,2,'The Battlecry reward must not absorb the separate faction rebate');
  assert.deepEqual(battleFloats(batch),[{anchor:'gas-counter',label:'+2',kind:'gas'}]);
}
{
  const game=fixture('sandwich-attacker');game.snapshot().state.players[1].treasury=1;
  const batch=play(game);
  assert.equal(batch.after.winner,0);
  assert.ok(videoCues(batch).some(c=>c.id==='07-spell-impact'&&c.anchor==='hero-1'),'The final strike must remain visible before the result dialog');
}
console.log('DIRECT PLAY OK: real buff baselines, source/target ownership, 0/1/2 counters, simultaneous outcomes, summon identity, capped/empty results and final strike.');
