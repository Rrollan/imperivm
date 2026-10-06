import assert from 'node:assert/strict';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {createGame} from '../lib/engine/engine';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';
import {battleFloats} from '../components/presentation/battleFloats';
import {effectTimeline,effectFrame} from '../components/presentation/effectTimeline';
import {historyEntry} from '../components/presentation/battleHistory';
import type {Action} from '../lib/engine/types';

function resolve(cards:string[],deck:string[]=[],treasury=30):PresentationBatch{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,42);
  state.players[0].hand=cards.map((cardId,i)=>({cardId,uid:`fatigue-card-${i}`}));
  state.players[0].gas=10;state.players[0].deck=deck;state.players[0].treasury=treasury;
  state.players[0].board=[];state.players[1].board=[];
  const game=new GameSession(state);
  const run=(action:Action)=>{
    assert.ok(game.legal().some(legal=>JSON.stringify(legal)===JSON.stringify(action)),'Only dispatch real legal actions');
    const batch=game.dispatch(action)!;game.impact(batch.id);game.complete(batch.id);return batch;
  };
  cards.forEach((_,i)=>run({type:'cast-spell',uid:`fatigue-card-${i}`}));
  run({type:'end-turn'});return run({type:'end-turn'});
}

{
  const batch=resolve(['flash-loan','flash-loan']),plan=effectTimeline(batch)!;
  const sources=batch.events!.spellResolved!.map(s=>`queued-${s.mempoolUid}`);
  assert.equal(batch.after.players[0].treasury,15,'Five empty draws remove 1+2+3+4+5 health');
  assert.deepEqual(battleFloats(batch).map(c=>[c.anchor,c.label,c.wave??'aftermath']),[
    ['hero-0','−3',sources[0]],['hero-0','−7',sources[1]],['hero-0','−5','aftermath'],
  ],'Each edict owns its fatigue; the turn draw is a separate outcome');
  assert.deepEqual(plan.windows.map(w=>w.key),sources.concat('aftermath'));
  assert.equal(effectFrame(batch,plan,plan.windows[0].contactMs-1).treasuries[0],30);
  assert.equal(effectFrame(batch,plan,plan.windows[0].contactMs).treasuries[0],27);
  assert.equal(effectFrame(batch,plan,plan.windows[1].contactMs).treasuries[0],20);
  assert.equal(effectFrame(batch,plan,plan.windows[2].contactMs).treasuries[0],15,'Turn-draw health changes at its number contact');
  assert.deepEqual(historyEntry(batch).details.filter(d=>d.kind==='resolved').map(d=>d.kind==='resolved'?d.changes?.[0]?.health:undefined),[[30,27],[27,20]]);
}
{
  const batch=resolve(['flash-loan','flash-loan'],['pixel-squire']);
  assert.equal(batch.after.players[0].fatigue,4);assert.equal(batch.after.players[0].treasury,20);
  assert.deepEqual(battleFloats(batch).map(c=>c.label),['−1','−5','−4'],'The successful first draw must not be counted as fatigue');
  assert.ok(historyEntry(batch).details.some(d=>d.kind==='draw'&&d.received===1&&d.fatigue===4));
}
{
  const batch=resolve(['flash-loan'],['pixel-squire','pixel-squire','pixel-squire']);
  assert.equal(batch.after.players[0].treasury,30);
  assert.deepEqual(battleFloats(batch),[],'Ordinary card draws do not invent damage');
  assert.equal(batch.events?.effectResults,undefined,'Ordinary draws do not pretend to have a health target');
}
{
  const batch=resolve(['flash-loan','flash-loan'],[],2),plan=effectTimeline(batch)!;
  assert.equal(batch.after.winner,1);assert.equal(batch.after.players[0].fatigue,2);
  assert.equal(batch.events?.spellResolved?.length,1,'Lethal fatigue stops the remaining edicts and normal draw');
  assert.deepEqual(battleFloats(batch).map(c=>c.label),['−2'],'Visible damage is capped to remaining health');
  assert.equal(plan.windows.length,1);
  assert.equal(effectFrame(batch,plan,plan.windows[0].contactMs).treasuries[0],0);
}
// Probe both orderings with a test-only heal definition; existing card data is
// restored immediately. No production card or rule is added by this fixture.
const id='fatigue-check-heal';
CARDS[id]={id,name:id,faction:'DeFi',rarity:'common',cost:0,type:'spell',text:'Test-only heal.',spell:{kind:'heal-treasury',amount:5}};
try{
  for(const cards of [[id,'flash-loan'],['flash-loan',id]]){
    const batch=resolve(cards,[],20),floats=battleFloats(batch),plan=effectTimeline(batch)!;
    assert.equal(batch.after.players[0].treasury,19);
    assert.deepEqual(floats.map(c=>c.label),cards[0]===id?['+5','−3','−3']:['−3','+5','−3'],'A healing ledger must not swallow later fatigue');
    assert.equal(floats.filter(c=>!c.wave).length,1,'The turn-draw delta appears exactly once');
    assert.equal(effectFrame(batch,plan,plan.windows.at(-1)!.contactMs).treasuries[0],19);
  }
}finally{delete CARDS[id];}
console.log('FATIGUE PRESENTATION OK: duplicate draw edicts, mixed full/empty draws, normal draw, lethal stop, both heal orderings, source-specific history and exact health contact.');
