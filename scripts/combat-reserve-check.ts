import assert from 'node:assert/strict';
import {createGame, applyAction, canBuyCard, legalActions} from '../lib/engine/engine';
import {retaliationDamage} from '../lib/engine/combat';
import {gameSnapshot, applyMove, actionForIntent} from '../lib/engine/network';
import type {GameState, Minion} from '../lib/engine/types';
import {diffAction} from '../lib/events';
import {historyEntry} from '../components/presentation/battleHistory';
import {parseMessage} from '../server/src/validation';

const reserveDeck=['pixel-squire','profile-pic-phalanx','restoration-rite'];
function fixture(): GameState {
  const state=createGame('builder',reserveDeck,'whale',Array(30).fill('lending-legionnaire'),21);
  state.players[0].gas=4; state.players[0].maxGas=4;
  return state;
}
function fighter(uid:string,attack:number,health=10,lifesteal=false): Minion {
  return {uid,cardId:'pixel-squire',name:uid,attack,health,maxHealth:health,canAttack:true,staked:false,fresh:false,lifesteal};
}
for (const attack of [0,1,2,3,4,5,8]) {
  const state=fixture(); state.players[0].board=[fighter('attacker',4)]; state.players[1].board=[fighter('defender',attack)];
  const original=structuredClone(state);
  const action={type:'attack',attackerUid:'attacker',target:'defender'} as const;
  const after=applyAction(state,action);
  assert.equal(after.players[1].board[0].health,6,'The initiating strike stays at full damage');
  assert.equal(after.players[0].board[0].health,10-Math.ceil(attack/2),'Retaliation rounds odd values up');
  assert.equal(after.players[0].board[0].canAttack,false);
  assert.deepEqual(state,original,'Combat is immutable');
  if (attack===3) assert.equal(diffAction(state,after,action)?.damages?.find(d=>d.uid==='attacker')?.prevHealth! - diffAction(state,after,action)?.damages?.find(d=>d.uid==='attacker')?.health!,2,'The damage float reports the same half damage');
}
assert.equal(retaliationDamage(0),0);
{
  const state=fixture();state.players[0].treasury=20;state.players[1].treasury=20;
  state.players[0].board=[fighter('attacker',10,1,true)];state.players[1].board=[fighter('defender',7,2,true)];
  const after=applyAction(state,{type:'attack',attackerUid:'attacker',target:'defender'});
  assert.equal(after.players[0].board.length,0);assert.equal(after.players[1].board.length,0,'A lethal target still retaliates simultaneously');
  assert.equal(after.players[0].treasury,22);assert.equal(after.players[1].treasury,21,'Lifesteal is capped by actual removed HP, not nominal half damage');
  state.players[0].board=[fighter('attacker',5)];state.players[1].board=[];
  assert.equal(applyAction(state,{type:'attack',attackerUid:'attacker',target:'hero'}).players[1].treasury,15,'Treasury hits stay full damage');
}
{
  const state=fixture(), original=structuredClone(state);
  assert(canBuyCard(state));assert(legalActions(state).some(a=>a.type==='buy-card'));
  const action={type:'buy-card'} as const, after=applyAction(state,action);
  assert.deepEqual(state,original);assert.equal(after.players[0].gas,2);assert.equal(after.players[0].hand.length,state.players[0].hand.length+1);
  const added=after.players[0].hand.find(c=>!state.players[0].hand.some(old=>old.uid===c.uid));
  assert(added&&reserveDeck.includes(added.cardId),'The server draws from the match original custom deck');
  assert.deepEqual(applyAction(state,action),after,'The reserve draw is seeded, including its new instance UID');
  assert.equal(after.players[0].deck.length,0);assert.equal(after.players[0].fatigue,state.players[0].fatigue);
  assert.throws(()=>applyAction(after,action),'No second purchase in the same turn');
  const round=applyAction(applyAction(after,{type:'end-turn'}),{type:'end-turn'});
  assert.equal(round.players[0].reinforcementUsed,false);assert(canBuyCard(round));
  assert.equal(round.players[0].fatigue,1,'Buying never refills the empty deck or evades next-turn fatigue');
  const events=diffAction(state,after,action);
  const entry=historyEntry({id:1,revision:1,before:state,after,action,events});
  assert.equal(entry.kind,'buy-card');assert(entry.details.some(d=>d.kind==='draw'&&d.received===1));
  assert(!JSON.stringify(entry).includes(added!.cardId),'A private purchased card is not leaked into public history');
}
for (const invalid of ['gas','deck','hand','winner','mulligan'] as const) {
  const state=fixture();
  if(invalid==='gas')state.players[0].gas=1;
  if(invalid==='deck')state.players[0].deck=['pixel-squire'];
  if(invalid==='hand')state.players[0].hand=Array.from({length:10},(_,i)=>({uid:`full-${i}`,cardId:'pixel-squire'}));
  if(invalid==='winner')state.winner=0;
  if(invalid==='mulligan')Object.assign(state,{enableMulligan:true,mulliganPhase:[true,true]});
  assert.equal(canBuyCard(state),false);assert.throws(()=>applyAction(state,{type:'buy-card'}),invalid);
}
{
  const state=fixture();
  assert.throws(()=>applyMove(state,1,{type:'buy-card'}),'The wrong player cannot purchase');
  const request=parseMessage(JSON.stringify({type:'intent',intent:{type:'buyCard',cardId:'zeus-liquidator',gas:999},revision:0}));
  assert.equal(request.type,'intent');
  if(request.type==='intent'&&request.intent.type!=='concede'){
    assert.deepEqual(request.intent,{type:'buyCard'},'The client never chooses the generated card or price');
    const after=applyMove(state,0,actionForIntent(state,request.intent));
    assert.equal(after.players[0].gas,2);
    const own=gameSnapshot(after,0,123), enemy=gameSnapshot(after,1,123);
    assert.equal(own.players[0].hand?.length,4);assert.equal(enemy.players[0].hand,undefined);
    for(const snapshot of [own,enemy]){
      const serialized=JSON.stringify(snapshot);
      assert(!serialized.includes('reinforcementPool'));assert(!serialized.includes('"rng"'));
    }
  }
}
console.log('Combat/reserve checks passed: rounded half retaliation, lifesteal, full treasury damage, paid seeded reserves, limits, fatigue, authority and hidden decks.');
