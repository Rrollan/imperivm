import assert from 'node:assert/strict';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {applyAction,createGame,legalActions,mempoolOf} from '../lib/engine/engine';
import {isInstantSpell} from '../lib/engine/spellTiming';
import {chooseAiAction} from '../lib/ai';
import {cardText} from '../lib/locale';
import {soundsForEvents} from '../lib/audio/events';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';
import {abilityCues} from '../components/presentation/abilityCues';
import {videoCues} from '../components/presentation/videoCue';
import {battleFloats} from '../components/presentation/battleFloats';
import {cardRules} from '../components/presentation/rulesText';
import type {Action,GameState,Minion,PlayerId} from '../lib/engine/types';

const fighter=(uid:string,attack=2,health=1,maxHealth=4):Minion=>({uid,cardId:'amm-centurion',name:CARDS['amm-centurion'].name,attack,health,maxHealth,canAttack:true,fresh:false,staked:false});
function fixture(id:string,owner:PlayerId=0):GameState{
  const s=createGame('builder',DECKS.builder,'degen',DECKS.degen,42);
  s.turn=owner;s.players.forEach(p=>{p.hand=[];p.board=[];p.gas=p.maxGas=10;});
  s.players[owner].hand=[{uid:'instant-card',cardId:id}];
  s.players[owner].board=[fighter('ally')];s.players[1-owner].board=[fighter('enemy',3,2,4)];
  return s;
}
function run(game:GameSession,action:Action):PresentationBatch{
  assert.ok(game.legal().some(a=>JSON.stringify(a)===JSON.stringify(action)));
  const batch=game.dispatch(action)!;
  assert.equal(game.snapshot().shown,batch.before,'Display retains the prior state until contact');
  game.impact(batch.id);game.complete(batch.id);
  assert.equal(game.snapshot().shown,batch.after);assert.equal(game.snapshot().busy,false);
  return batch;
}
const instantIds=Object.values(CARDS).filter(isInstantSpell).map(c=>c.id);
assert.deepEqual(instantIds.slice().sort(),['agora-expansion','diamond-aegis','flash-loan','restoration-rite','senate-censure','solar-sapper','trait-reroll']);
assert.equal(Object.keys(CARDS).length,49,'Preserve the entire live catalogue');
for(const owner of [0,1] as const)for(const id of instantIds){
  const before=fixture(id,owner),original=JSON.stringify(before),game=new GameSession(before);
  const batch=run(game,{type:'cast-spell',uid:'instant-card'}),after=batch.after;
  assert.equal(JSON.stringify(before),original,'Rules never mutate the input');
  assert.equal(after.block,before.block);assert.equal(after.turn,owner,'Instant casts do not advance the turn');
  assert.equal(after.players[owner].gas,before.players[owner].gas-CARDS[id].cost);
  assert.equal(mempoolOf(after,owner).length,0);
  assert.equal(batch.events?.spellImmediate?.cardId,id);assert.equal(batch.events?.spellQueued,undefined);
  assert.equal(batch.events?.spellResolved,undefined);
  assert.ok(game.snapshot().history[0].details.some(d=>d.kind==='immediate'));
  assert.ok(!game.snapshot().history[0].details.some(d=>d.kind==='queued'));
  assert.ok(soundsForEvents(batch.events!).includes('play'));
  assert.ok(!soundsForEvents(batch.events!).includes('mempool-queue'));
  assert.ok(cardRules(id,'ru').includes('Мгновенно:'));assert.ok(cardText(id,'ru').startsWith('Мгновенно.'));
  const cues=abilityCues(batch),clips=videoCues(batch),floats=battleFloats(batch);
  assert.ok(!cues.some(c=>c.from.startsWith('queued-')));assert.ok(!floats.some(c=>c.wave));
  switch(id){
    case 'restoration-rite':
      assert.equal(after.players[owner].board[0].health,3);assert.equal(after.players[1-owner].board[0].health,2);
      assert.deepEqual(floats.map(c=>[c.anchor,c.label]),[['ally','+2']]);
      assert.ok(clips.some(c=>c.id==='17-edict-heal'&&c.anchor==='ally'));break;
    case 'senate-censure':
      assert.equal(after.players[1-owner].board[0].attack,2);
      assert.deepEqual(floats.map(c=>[c.anchor,c.label]),[['enemy','−1']]);
      assert.ok(clips.some(c=>c.id==='16-edict-weaken'&&c.anchor==='enemy'));break;
    case 'trait-reroll':
      assert.equal(after.players[owner].board[0].attack,3);
      assert.deepEqual(floats.map(c=>[c.anchor,c.label]),[['ally','+1/+0']]);
      // A fighter already ready to attack benefits in this same turn.
      assert.equal(run(game,{type:'attack',attackerUid:'ally',target:'hero'}).after.players[1-owner].treasury,27);break;
    case 'solar-sapper':
      assert.equal(after.players[1-owner].board.length,0);assert.equal(after.players[owner].board[0].health,1);
      assert.deepEqual(floats.map(c=>[c.anchor,c.label]),[['enemy','−2']]);
      assert.ok(clips.some(c=>c.id==='07-spell-impact'&&c.anchor==='enemy'));break;
    case 'flash-loan':
      assert.equal(after.players[owner].hand.length,2);assert.equal(after.players[owner].deck.length,before.players[owner].deck.length-2);
      assert.ok(clips.some(c=>c.id==='04-degen-draw'&&c.anchor==='instant-card'));
      assert.equal(floats.length,0);break;
  }
  run(game,{type:'end-turn'});
  const nextOwn=run(game,{type:'end-turn'});
  assert.equal(nextOwn.events?.spellResolved,undefined,'Instant effects cannot run again on the next turn');
}
// Draw unlocks a card immediately, rather than forcing another whole round.
{
  const s=fixture('flash-loan');s.players[0].deck=['pixel-squire','pixel-squire'];
  const g=new GameSession(s),draw=run(g,{type:'cast-spell',uid:'instant-card'});
  const uid=draw.after.players[0].hand[0].uid;
  assert.ok(legalActions(draw.after).some(a=>a.type==='play-minion'&&a.uid===uid));
  const deployed=run(g,{type:'play-minion',uid});assert.equal(deployed.after.block,s.block);
}
// No-op casts remain auditable but cannot invent successful heal/debuff VFX.
for(const id of ['restoration-rite','senate-censure','trait-reroll','solar-sapper']){
  const s=fixture(id);s.players[0].board=[];s.players[1].board=[];
  if(id==='restoration-rite')s.players[0].board=[fighter('full',2,4,4)];
  if(id==='senate-censure')s.players[1].board=[fighter('zero',0)];
  const b=run(new GameSession(s),{type:'cast-spell',uid:'instant-card'});
  assert.deepEqual(abilityCues(b),[]);assert.deepEqual(videoCues(b),[]);assert.deepEqual(battleFloats(b),[]);
  assert.notEqual(chooseAiAction(s).type,'cast-spell','AI saves orders instead of wasting a no-op tactical spell');
}
// Fatigue is immediate, visibly attributed once, and stops a lethal draw.
{
  const s=fixture('flash-loan');s.players[0].deck=[];s.players[0].treasury=2;
  assert.notEqual(chooseAiAction(s).type,'cast-spell','AI must not spend orders to draw only fatigue');
  const b=run(new GameSession(s),{type:'cast-spell',uid:'instant-card'});
  assert.equal(b.after.winner,1);assert.equal(b.after.players[0].fatigue,2);
  assert.deepEqual(battleFloats(b).map(c=>[c.anchor,c.label]),[['hero-0','−2']]);
}
// Seeded random choice, capped weakening and full-price affordability persist.
{
  const s=fixture('senate-censure');s.players[1].board.push(fighter('other',4));
  assert.deepEqual(applyAction(s,{type:'cast-spell',uid:'instant-card'}),applyAction(s,{type:'cast-spell',uid:'instant-card'}));
  s.players[0].gas=1;const snapshot=JSON.stringify(s);
  assert.throws(()=>applyAction(s,{type:'cast-spell',uid:'instant-card'}));assert.equal(JSON.stringify(s),snapshot);
}
// Edicts preserve a real response window; Priority cancels immediately while
// its main effect remains delayed. Instant spells are never counter victims.
for(const id of ['priority-fee','audit','reveal-ceremony','rug-pull']){
  const s=fixture(id);s.players[0].board=[fighter('ally',2,4,4)];
  const g=new GameSession(s),cast=run(g,{type:'cast-spell',uid:'instant-card'});
  assert.equal(cast.events?.spellImmediate,undefined);assert.equal(mempoolOf(cast.after,0).length,1);
  const enemy=run(g,{type:'end-turn'});assert.equal(mempoolOf(enemy.after,0).length,1);
  const resolved=run(g,{type:'end-turn'});assert.equal(resolved.events?.spellResolved?.[0]?.cardId,id);
  assert.equal(mempoolOf(resolved.after,0).length,0);
}
{
  const s=fixture('flash-loan'),cast=applyAction(s,{type:'cast-spell',uid:'instant-card'});
  let enemy=applyAction(cast,{type:'end-turn'});enemy.players[1].gas=10;enemy.players[1].hand=[{uid:'counter',cardId:'priority-fee'}];
  enemy=applyAction(enemy,{type:'cast-spell',uid:'counter'});assert.equal(mempoolOf(enemy,0).length,0);
  assert.equal(enemy.players[0].hand.length,2,'Priority cannot undo a completed instant draw');
}
console.log('INSTANT SPELLS OK: seven live cards, both owners, same-turn combos, exact contact/VFX/history, no double resolution, no-op AI, fatigue, affordability, deterministic targets and four delayed edicts.');
