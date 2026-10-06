import assert from 'node:assert/strict';
import {createFullBoardMixedEffectsFixture,createSolarRugPullFixture,createPriorityFourthEntryFixture} from './queue-presentation-fixtures';
import {battleFloats} from '../components/presentation/battleFloats';
import {abilityCues} from '../components/presentation/abilityCues';
import {videoCues} from '../components/presentation/videoCue';
import {effectTimeline,effectFrame,deathWindow,EFFECT_POOL_SIZE} from '../components/presentation/effectTimeline';
import {queueAnchor,queueSlot} from '../components/presentation/queueLayout';
import {fighterRow} from '../components/presentation/battleLayout';
import {createGame} from '../lib/engine/engine';
import {DECKS} from '../lib/decks';
import {GameSession} from '../components/presentation/GameSession';
import type {Action,Minion} from '../lib/engine/types';

function queueBatch(cards:string[],ownCount=0,enemyCount=0){
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,42);
  const fighter=(uid:string):Minion=>({uid,cardId:'amm-centurion',name:'AMM Centurion',attack:2,health:4,maxHealth:4,canAttack:false,staked:false,fresh:false});
  state.players[0].board=Array.from({length:ownCount},(_,i)=>fighter(`overflow-own-${i}`));
  state.players[1].board=Array.from({length:enemyCount},(_,i)=>fighter(`overflow-foe-${i}`));
  state.players[0].hand=cards.map((cardId,i)=>({cardId,uid:`overflow-spell-${i}`}));state.players[0].gas=30;
  const game=new GameSession(state);
  const run=(action:Action)=>{assert.ok(game.legal().some(legal=>JSON.stringify(legal)===JSON.stringify(action)));const batch=game.dispatch(action)!;game.impact(batch.id);game.complete(batch.id);return batch;};
  cards.forEach((_,i)=>run({type:'cast-spell',uid:`overflow-spell-${i}`}));
  run({type:'end-turn'});return run({type:'end-turn'});
}

{
  const {batch,expected}=createFullBoardMixedEffectsFixture(),floats=battleFloats(batch),accents=abilityCues(batch),plan=effectTimeline(batch)!;
  assert.equal(batch.after.block,expected.block);
  assert.deepEqual(batch.events?.spellResolved?.map(s=>s.cardId),expected.resolvedCardIds);
  assert.equal(floats.length,24,'7 damage, 1 weaken, 7 heals, 7 Audit buffs and 2 separate passive growths');
  assert.equal(accents.length,24,'Every outcome has its own source and target');
  assert.equal(plan.floats.length,floats.length);assert.equal(plan.abilities.length,accents.length);
  assert.deepEqual(plan.windows.map(w=>w.key),expected.resolvedCardIds.map(id=>`queued-${expected.spellUidsByCardId[id]}`).concat('growth'));
  assert.equal(plan.tailMs,1800);
  for(const window of plan.windows){
    assert.ok(plan.floats.filter(c=>c.window===window).length<=EFFECT_POOL_SIZE);
    assert.ok(plan.abilities.filter(c=>c.window===window).length<=EFFECT_POOL_SIZE);
  }
  for(const id of expected.resolvedCardIds){
    const source=`queued-${expected.spellUidsByCardId[id]}`;
    assert.deepEqual(floats.filter(f=>f.wave===source).map(f=>f.anchor),expected.effectTargetUidsByCardId[id]);
    assert.ok(accents.filter(c=>c.wave===source).every(c=>c.from===source));
    assert.ok(queueAnchor(source,[batch.after,batch.before],true),'A removed fourth queue source remains publicly locatable');
  }
  const before=effectFrame(batch,plan,plan.windows[0].contactMs-1);
  assert.equal(before.fighters.get('foe-0')?.health,4);
  const solar=effectFrame(batch,plan,plan.windows[0].contactMs);
  assert.equal(solar.fighters.get('foe-0')?.health,2);assert.equal(solar.fighters.get('own-0')?.health,2);
  const heal=effectFrame(batch,plan,plan.windows[2].contactMs);
  assert.equal(heal.fighters.get('own-0')?.health,4);assert.equal(heal.fighters.get('own-0')?.attack,2);
  const audit=effectFrame(batch,plan,plan.windows[3].contactMs);
  assert.equal(audit.fighters.get('own-ape')?.attack,3);assert.equal(audit.fighters.get('own-ape')?.health,4);
  const growth=effectFrame(batch,plan,plan.windows[4].contactMs);
  assert.equal(growth.fighters.get('own-ape')?.attack,4);assert.equal(growth.fighters.get('own-ape')?.health,5);
  for(const fighter of batch.after.players.flatMap(p=>p.board))assert.deepEqual(effectFrame(batch,plan,plan.tailMs).fighters.get(fighter.uid),fighter);
  // Each scheduled number gets a contact interval, including the former overflow.
  const seen=new Set<object>();for(let ms=0;ms<=plan.tailMs;ms+=16)plan.floats.filter(c=>ms>=c.window.contactMs&&ms<c.window.endMs).forEach(c=>seen.add(c));
  assert.equal(seen.size,24);
}
for(const health of [2,4] as const){
  const {batch,expected}=createSolarRugPullFixture(health),plan=effectTimeline(batch)!,cues=abilityCues(batch);
  assert.deepEqual(battleFloats(batch).map(c=>[c.anchor,c.label]),[[expected.targetUid,'−2']]);
  assert.equal(cues.filter(c=>c.kind==='destroy').length,health===4?1:0);
  assert.equal(cues.some(c=>c.kind==='counter'),false,'Board destruction must never look like Priority cancellation');
  assert.equal(videoCues(batch).some(c=>c.id==='09-spell-counter'),false);
  assert.equal(deathWindow(batch,plan,expected.targetUid)?.key,`queued-${health===2?expected.solarSpellUid:expected.rugPullSpellUid}`);
  const solar=plan.windows.find(w=>w.key===`queued-${expected.solarSpellUid}`)!;
  assert.equal(effectFrame(batch,plan,solar.contactMs).fighters.get(expected.targetUid)?.health,expected.targetHealthAfterSolar);
  if(health===4){const rug=plan.windows.find(w=>w.key===`queued-${expected.rugPullSpellUid}`)!;assert.ok(rug.contactMs>solar.endMs);assert.equal(effectFrame(batch,plan,rug.contactMs-1).fighters.get(expected.targetUid)?.health,2);assert.equal(effectFrame(batch,plan,rug.contactMs).fighters.get(expected.targetUid)?.health,0);}
}
{
  const {batch,expected}=createPriorityFourthEntryFixture(),uid=`queued-${expected.highestCostUid}`;
  assert.deepEqual(batch.events?.spellCounters?.map(c=>c.mempoolUid),expected.counteredSpellUids);
  assert.ok(abilityCues(batch).some(c=>c.kind==='counter'&&c.to===uid));
  const anchor=queueAnchor(uid,[batch.after,batch.before],true)!;
  assert.equal(anchor.overflow,true);assert.deepEqual(anchor,queueSlot(1,true,3));
  assert.notDeepEqual(anchor,queueSlot(1,true,0),'A removed hidden card must not flash cancellation on an unrelated first card');
}
for(const owner of [0,1]){
  const row=fighterRow(7,owner,true),queue=queueSlot(owner,true);
  assert.ok(queue.y-174/2>row.y+row.height/2,'The queue stack clears a complete narrow battle row');
}
{
  const batch=queueBatch(['rug-pull','rug-pull'],0,1),plan=effectTimeline(batch)!;
  assert.equal(batch.events?.deaths?.length,1);
  assert.equal(abilityCues(batch).filter(c=>c.kind==='destroy').length,1,'The second Rug must not destroy an already dead fighter again');
  assert.equal(plan.windows.length,2,'A resolved no-op still owns its queue acknowledgement');
  assert.equal(plan.windows[0].key,deathWindow(batch,plan,'overflow-foe-0')?.key);
}
{
  const batch=queueBatch(['senate-censure','audit'],1),plan=effectTimeline(batch)!;
  assert.equal(batch.events?.effectResults?.[0].targets.length,0);
  assert.deepEqual(plan.windows.map(w=>w.key),batch.events?.spellResolved?.map(s=>`queued-${s.mempoolUid}`),'An edict with no target is acknowledged before the next edict');
}
{
  const batch=queueBatch(Array(10).fill('audit'),7),plan=effectTimeline(batch,true)!;
  assert.equal(plan.floats.length,70);assert.equal(plan.abilities.length,70);
  const clips=videoCues(batch);
  assert.equal(clips.length,20,'Every Audit reuses two supplemental sprite slots');
  assert.equal(new Set(clips.map(c=>c.wave)).size,10);
  assert.equal(plan.windows.length,10);
  assert.ok(plan.windows.every(w=>w.contactMs===w.startMs&&w.endMs-w.startMs===240),'Reduced motion keeps readable source outcomes without travel');
  assert.ok(plan.windows.every(w=>plan.floats.filter(c=>c.window===w).length<=EFFECT_POOL_SIZE));
  for(const fighter of batch.after.players[0].board)assert.deepEqual(effectFrame(batch,plan,plan.tailMs).fighters.get(fighter.uid),fighter);
}
console.log('QUEUE PRESENTATION OK: 24 mixed outcomes, bounded reused slots, ordered contacts, separate passives, real destruction, no-op acknowledgement, 70 reduced-motion outcomes, fourth-entry anchors and narrow-row clearance.');
