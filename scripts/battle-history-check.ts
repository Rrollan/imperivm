import {installDelayedSpellFixtures} from './delayed-spell-fixtures';
import assert from 'node:assert/strict';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {createGame,legalActions} from '../lib/engine/engine';
import type {Action,Minion} from '../lib/engine/types';
import {GameSession} from '../components/presentation/GameSession';
import {historyEntry} from '../components/presentation/battleHistory';

const restoreDelayedFixtures=installDelayedSpellFixtures(['senate-censure']);

function fixture(hand:string[]=[]){
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,22);
  state.players[0].hand=hand.map((cardId,index)=>({cardId,uid:`own-${index}`}));
  state.players[0].gas=state.players[0].maxGas=10;
  state.players[0].board=[];state.players[1].board=[];
  return state;
}
function fighter(uid:string,attack=3):Minion{return {uid,cardId:'pixel-squire',name:CARDS['pixel-squire'].name,attack,health:4,maxHealth:4,canAttack:true,staked:false,fresh:false};}
function dispatch(game:GameSession,matches:(action:Action)=>boolean){
  const action=game.legal().find(matches);assert.ok(action,'Use a real legal engine action');
  const batch=game.dispatch(action)!;game.impact(batch.id);game.complete(batch.id);return batch;
}
const state=fixture(['delayed-fixture-senate-censure','delayed-fixture-senate-censure']);state.players[1].board=[fighter('public-target')];
state.players[1].hand=[{cardId:'rug-pull',uid:'enemy-secret-hand-uid'}];state.players[1].deck=['rug-pull'];
const game=new GameSession(state);
const first=game.dispatch(legalActions(state).find(a=>a.type==='cast-spell')!)!;
assert.equal(game.snapshot().history.length,0,'History waits for actual contact');
game.impact(first.id);game.impact(first.id);game.complete(first.id);
assert.equal(game.snapshot().history.length,1,'Duplicate contact and completion cannot duplicate history');
assert.equal(game.snapshot().history[0].source?.cardId,'delayed-fixture-senate-censure');
assert.deepEqual(game.snapshot().history[0].changes,[],'Queueing does not pretend to resolve an effect');
dispatch(game,a=>a.type==='cast-spell');
const enemyStart=dispatch(game,a=>a.type==='end-turn');
const publicJson=JSON.stringify(historyEntry(enemyStart));
assert.ok(!publicJson.includes('rug-pull')&&!publicJson.includes('enemy-secret-hand-uid'),'Opponent hand/deck/draw identities remain hidden');
assert.ok(!publicJson.includes('"log"')&&!publicJson.includes('"rng"')&&!publicJson.includes('"players"'),'History stores public facts rather than engine snapshots');
const resolved=dispatch(game,a=>a.type==='end-turn');
const record=historyEntry(resolved),spells=record.details.filter(d=>d.kind==='resolved');
assert.equal(spells.length,2);
assert.deepEqual(spells.map(s=>s.kind==='resolved'?s.changes?.[0].attack:undefined),[[3,2],[2,1]],'Each duplicate edict keeps its independent target delta');
assert.deepEqual(record.changes.find(change=>change.piece.cardId==='pixel-squire')?.attack,[3,1],'The aggregate outcome is separate from per-edict changes');

const interrupted=game.dispatch({type:'end-turn'})!;
game.restart(fixture());game.impact(interrupted.id);game.complete(interrupted.id);
assert.equal(game.snapshot().history.length,0,'Restart clears the chronicle and rejects stale callbacks');
const fallback=game.dispatch({type:'end-turn'})!;
game.complete(fallback.id);assert.equal(game.snapshot().history.length,1,'A presentation failure still records the committed rules result once');

const capState=fixture();capState.players[0].board=[fighter('garrison')];const bounded=new GameSession(capState);
for(let i=0;i<65;i++)dispatch(bounded,a=>a.type===(i%2?'unstake':'stake'));
assert.equal(bounded.snapshot().history.length,60);assert.equal(bounded.snapshot().history[0].id,6);
const empty=fixture();empty.players[1].deck=[];empty.players[1].hand=[];
const fatigue=historyEntry(dispatch(new GameSession(empty),a=>a.type==='end-turn'));
assert.ok(fatigue.details.some(detail=>detail.kind==='draw'&&detail.owner===1&&detail.fatigue===1));
const burn=fixture();burn.players[1].hand=Array.from({length:10},(_,i)=>({cardId:'rug-pull',uid:`secret-${i}`}));burn.players[1].deck=['rug-pull'];
const burned=historyEntry(dispatch(new GameSession(burn),a=>a.type==='end-turn'));
assert.ok(burned.details.some(detail=>detail.kind==='draw'&&detail.burned===1&&detail.received===0));
assert.ok(!JSON.stringify(burned).includes('rug-pull'),'A burned opponent card is not revealed by this UI');
console.log('HISTORY OK: contact deduplication, per-edict versus aggregate outcomes, hidden opponent draws/burns, fatigue, restart/stale callbacks, failure fallback and bounded retention.');

restoreDelayedFixtures();
