import assert from 'node:assert/strict';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {applyAction,createGame,legalActions} from '../lib/engine/engine';
import type {GameState,Minion,Action} from '../lib/engine/types';
import {battleCommand,fighterReadiness,nextHalvingBlock,unavailableCardText} from '../components/presentation/battleReadability';
import {cardKeywords,cardRules} from '../components/presentation/rulesText';

function fixture(hand:string[]=[]):GameState{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,731);
  state.players[0].hand=hand.map((cardId,index)=>({cardId,uid:`hand-${index}`}));
  state.players[0].gas=state.players[0].maxGas=10;
  state.players[0].board=[];state.players[1].board=[];
  return state;
}
function fighter(uid:string,cardId='pixel-squire',extra:Partial<Minion>={}):Minion{
  const card=CARDS[cardId];
  return {uid,cardId,name:card.name,attack:card.attack!,health:card.health!,maxHealth:card.health!,canAttack:true,staked:false,fresh:false,rush:!!card.rush,taunt:!!card.taunt,lifesteal:!!card.lifesteal,...extra};
}
function step(state:GameState,predicate:(action:Action)=>boolean):GameState{
  const action=legalActions(state).find(predicate);assert.ok(action,'The transition must use an actual legal action');return applyAction(state,action);
}

let state=fixture(['pixel-squire']);
state=step(state,a=>a.type==='play-minion');
const uid=state.players[0].board[0].uid;
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'fresh');
state=step(state,a=>a.type==='end-turn');
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'waiting');
state=step(state,a=>a.type==='end-turn');
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'ready');
state=step(state,a=>a.type==='attack'&&a.target==='hero');
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'exhausted');
state=step(state,a=>a.type==='stake'&&a.uid===uid);
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'garrison');
state=step(state,a=>a.type==='unstake'&&a.uid===uid);
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'exhausted','Returning from garrison does not restore an attack');

const rushCard=Object.values(CARDS).find(card=>card.rush)!;
state=fixture([rushCard.id]);state=step(state,a=>a.type==='play-minion');
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'no-target','Fresh Rush cannot attack the ruler without an enemy fighter');
state.players[1].board=[fighter('enemy')];
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'rush');
assert.ok(legalActions(state).filter(a=>a.type==='attack').every(a=>a.target!=='hero'));

state=fixture();
// Zero attack is still a legal engine attack; UI must not invent a restriction.
state.players[0].board=[fighter('zero','pixel-squire',{attack:0})];
assert.equal(fighterReadiness(state,0,state.players[0].board[0]),'ready');
state.players[0].board=[fighter('spent','pixel-squire',{canAttack:false})];
state.players[0].gas=0;state.players[0].heroPowerUsed=true;
assert.equal(battleCommand(state),'done','The warm finish signal refers to cards, attacks and power; garrison stays optional');
assert.ok(legalActions(state).some(a=>a.type==='stake'));
state.players[0].board[0].canAttack=true;assert.equal(battleCommand(state),'own');
state=step(state,a=>a.type==='end-turn');assert.equal(battleCommand(state),'enemy');
state.winner=1;assert.equal(battleCommand(state),'over');

state=fixture(['pixel-squire']);state.players[0].gas=0;
assert.equal(unavailableCardText(state,'pixel-squire','ru'),'Не хватает приказов: 1');
state.players[0].gas=10;state.players[0].board=Array.from({length:5},(_,i)=>fighter(`full-${i}`));
assert.equal(unavailableCardText(state,'pixel-squire','en'),'Court full: 5 fighters. Expand the agora.');
assert.equal(unavailableCardText(state,'pixel-squire','ru',true),'Действие выполняется');
const opening=createGame('builder',DECKS.builder,'degen',DECKS.degen,{enableMulligan:true},13);
assert.equal(battleCommand(opening),'busy');
assert.equal(unavailableCardText(opening,opening.players[0].hand[0].cardId,'ru'),'Сначала выберите стартовую руку');
assert.equal(nextHalvingBlock(8,4),12);assert.equal(nextHalvingBlock(9,4),12);
for(const card of Object.values(CARDS)){
  for(const locale of ['ru','en'] as const){
    const keywords=cardKeywords(card.id,locale);
    assert.equal(keywords.length,[card.taunt,card.rush,card.lifesteal,card.priority].filter(Boolean).length);
    assert.ok(keywords.every(keyword=>keyword.description.length>20));
    if(!card.battlecry&&!card.ultimate&&!card.spell&&!card.halvingPeriod&&keywords.length)assert.equal(cardRules(card.id,locale,false),'','Do not repeat keyword labels in the rules paragraph');
  }
}
console.log('READABILITY OK: engine-backed fresh/Rush/ready/spent/garrison states, legal zero-attack, finish signal, card denial reasons and bilingual keyword explanations.');
