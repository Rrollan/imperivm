import assert from 'node:assert/strict';
import {DECKS} from '../lib/decks';
import {createGame,applyAction,canPlay} from '../lib/engine/engine';
import {mechanicalTwins,probeMatch} from '../lib/balance/simulation';
import {factionLink} from '../components/presentation/factionLink';
import {createLabGame} from '../components/presentation/GameSession';

const first=probeMatch('builder',DECKS.builder,'degen',DECKS.degen,104729);
assert.deepEqual(first,probeMatch('builder',DECKS.builder,'degen',DECKS.degen,104729),'Same seed and policy must reproduce metrics exactly');
assert.notEqual(first.winner,null);assert(first.actions<2000);assert(first.counters<=first.casts);
assert.notEqual(probeMatch('validator',DECKS.validator,'whale',DECKS.whale,112648,['pressure','pressure']).winner,null);
assert(mechanicalTwins().some(group=>group.differentCost&&group.cards.some(c=>c.id==='solar-sapper')&&group.cards.some(c=>c.id==='reveal-ceremony')));

let state=createGame('builder',DECKS.builder,'degen',DECKS.degen,42);
state.players[0].gas=3;state.players[0].hand=[{uid:'one',cardId:'amm-centurion'},{uid:'two',cardId:'amm-centurion'},{uid:'three',cardId:'lending-legionnaire'}];
assert.deepEqual(factionLink(state.players[0],'DeFi'),{played:0,earned:false,step:0,refundOnNext:false});
state=applyAction(state,{type:'play-minion',uid:'one'});
assert.equal(factionLink(state.players[0],'DeFi').refundOnNext,true);
assert.equal(canPlay(state,0,'two'),false,'An upcoming refund cannot pay the card’s up-front cost');
state.players[0].gas=2;state=applyAction(state,{type:'play-minion',uid:'two'});
assert.equal(state.players[0].gas,1);assert.equal(factionLink(state.players[0],'DeFi').step,2);
state=applyAction(state,{type:'play-minion',uid:'three'});
assert.equal(state.players[0].gas,0,'Third same-faction play does not refund again');
state=applyAction(state,{type:'end-turn'});state=applyAction(state,{type:'end-turn'});
assert.equal(factionLink(state.players[0],'DeFi').step,0,'Reset only when the owner starts a new turn');
assert.equal(createLabGame('builder',true,42,'validator').players[1].heroId,'validator');
assert.equal(createLabGame('builder',true,42,'constructor').players[1].heroId,'degen','Unknown opponent falls back to the established matchup');
assert.deepEqual(createLabGame('builder',true,42),createLabGame('builder',true,42,'degen'),'Existing entry points retain exactly the same opening');
console.log('PASS reproducible probes, bounded matches, mechanical twins, actual faction refund timing and opponent selection');
