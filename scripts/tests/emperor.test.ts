import assert from 'node:assert/strict';
import {CARDS} from '../../lib/cards';
import {HEROES} from '../../lib/heroes';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {chooseAiAction} from '../../lib/ai';
import {applyAction, canPlay, createGame, effectiveBoardCapacity, effectiveCardCost, effectivePowerCost, legalActions} from '../../lib/engine/engine';
import {activeEmperorRule, createEmperorState, EMPEROR_RULES, emperorAnnounceIfDue, emperorOf, emperorPrepareFighter, emperorRound, resolveEmperorEvent} from '../../lib/engine/emperor';
import {gameSnapshot} from '../../lib/engine/network';
import type {GameState, Minion, PlayerId} from '../../lib/engine/types';

const covered=new Set<string>();
const fighter=(uid:string,extra:Partial<Minion>={}):Minion=>({uid,cardId:'pixel-squire',name:uid,attack:3,health:2,maxHealth:4,canAttack:true,staked:false,fresh:false,...extra});
function fixture(id:string,seat:PlayerId=0):GameState {
  const state=createGame('builder',FREE_DECKS.builder,'builder',FREE_DECKS.builder,127);
  state.block=9;state.turn=seat;state.emperor=createEmperorState(177);
  state.emperor.active=id;state.emperor.history=[{id,round:1,block:1}];
  for(const p of state.players){p.gas=p.maxGas=10;p.hand=[];p.board=[];p.treasury=20;}
  return state;
}
function play(state:GameState,cardId:string,uid:string):GameState {
  state.players[state.turn].hand.push({uid,cardId});
  const before=structuredClone(state);
  const action=CARDS[cardId].type==='minion'?{type:'play-minion' as const,uid}:{type:'cast-spell' as const,uid};
  const after=applyAction(state,action);assert.deepEqual(state,before,'No transition mutates its input');return after;
}
assert.equal(EMPEROR_RULES.length,40);assert.equal(new Set(EMPEROR_RULES.map(r=>r.id)).size,40);
assert.equal(EMPEROR_RULES.filter(r=>r.kind==='law').length,24);
assert(EMPEROR_RULES.every(r=>r.titleRu&&r.titleEn&&r.textRu&&r.textEn));
assert(Object.isFrozen(EMPEROR_RULES)&&EMPEROR_RULES.every(Object.isFrozen));

for(const seat of [0,1] as const){
  // Cost changes are identical for either seat and are actually paid.
  for(const [id,cardId,expected] of [
    ['armory-sale','profile-pic-phalanx',1],['red-tape','restoration-rite',3],
    ['scholars-grant','restoration-rite',1],['heavy-recruitment','impermanent-guard',4],
    ['scout-duty','lending-legionnaire',2],
  ] as const){
    const state=fixture(id,seat);assert.equal(effectiveCardCost(state,seat,CARDS[cardId]),expected);
    const result=play(state,cardId,'cost');assert.equal(result.players[seat].gas,10-expected);
    const poor=fixture(id,seat);poor.players[seat].gas=expected-1;poor.players[seat].hand=[{uid:'poor',cardId}];
    assert(!canPlay(poor,seat,'poor'));assert(!legalActions(poor).some(a=>'uid' in a&&a.uid==='poor'));covered.add(id);
  }
  for(const [id,cost] of [['royal-favor',1],['royal-levy',3]] as const){
    const state=fixture(id,seat);assert.equal(effectivePowerCost(state,seat),cost);
    const result=applyAction(state,{type:'hero-power'});assert.equal(result.players[seat].gas,10-cost);covered.add(id);
  }
  // A reduced cap never destroys existing units, including summons from powers.
  let state=fixture('three-seats',seat);state.players[seat].heroId='strategist';
  state.players[seat].board=Array.from({length:5},(_,i)=>fighter(`existing-${i}`));
  state.players[seat].hand=[{uid:'blocked',cardId:'pixel-squire'}];
  assert.equal(effectiveBoardCapacity(state,seat),3);assert(!canPlay(state,seat,'blocked'));
  assert(!legalActions(state).some(a=>a.type==='hero-power'));assert.throws(()=>applyAction(state,{type:'hero-power'}));
  assert.equal(applyAction(state,{type:'end-turn'}).players[seat].board.length,5);covered.add('three-seats');
  state=fixture('grand-court',seat);state.players[seat].board=Array.from({length:6},(_,i)=>fighter(`six-${i}`));
  assert.equal(effectiveBoardCapacity(state,seat),7);assert.equal(play(state,'pixel-squire','seventh').players[seat].board.length,7);covered.add('grand-court');

  state=fixture('first-blood',seat);let next=play(state,'lending-legionnaire','first');
  assert.equal(next.players[seat].board[0].attack,CARDS['lending-legionnaire'].attack!+1);
  next=play(next,'pixel-squire','second');assert.equal(next.players[seat].board[1].attack,CARDS['pixel-squire'].attack);
  assert.equal(next.emperor?.minionsThisTurn[seat],2);covered.add('first-blood');
  for(const [id,cardId] of [['veteran-armor','impermanent-guard'],['little-heroes','pixel-squire']] as const){
    const result=play(fixture(id,seat),cardId,'armor');
    assert.equal(result.players[seat].board[0].health,CARDS[cardId].health!+1);
    assert.equal(result.players[seat].board[0].maxHealth,CARDS[cardId].health!+1);covered.add(id);
  }
  for(const [id,key] of [['rapid-march','rush'],['honor-guard','taunt'],['mercy-medals','lifesteal']] as const){
    const result=play(fixture(id,seat),'lending-legionnaire','keyword');assert.equal(result.players[seat].board[0][key],true);
    if(key==='rush'){
      result.players[seat===0?1:0].board=[fighter('rush-target')];
      assert(legalActions(result).some(a=>a.type==='attack'&&a.target==='rush-target'));
      assert(!legalActions(result).some(a=>a.type==='attack'&&a.target==='hero'));
    }
    covered.add(id);
  }
  // Mercy preserves normal combat damage and heals the fighter's own treasury.
  // The decree grants the keyword on arrival; existing units are unchanged.
  state=fixture('mercy-medals',seat);
  const foe=seat===0?1:0;
  state.players[seat].board=[fighter('before-mercy',{lifesteal:false})];
  next=play(state,'lending-legionnaire','mercy-arrival');
  assert.equal(next.players[seat].board[0].lifesteal,false,'The law does not retroactively bless existing fighters');
  const blessed=next.players[seat].board[1];
  blessed.attack=3;blessed.health=blessed.maxHealth=5;blessed.fresh=false;blessed.canAttack=true;
  next.players[foe].board=[fighter('mercy-target',{attack:0,health:5,maxHealth:5,lifesteal:false})];
  const traded=applyAction(next,{type:'attack',attackerUid:blessed.uid,target:'mercy-target'});
  assert.equal(traded.players[foe].board[0].health,2,'The enemy fighter still takes 3 damage');
  assert.equal(traded.players[seat].treasury,23,'The same 3 damage heals the attacker\'s treasury');
  assert.equal(traded.players[foe].treasury,20,'Mercy does not redirect fighter damage to the enemy treasury');
  const capped=structuredClone(next);capped.players[seat].treasury=29;
  assert.equal(applyAction(capped,{type:'attack',attackerUid:blessed.uid,target:'mercy-target'}).players[seat].treasury,30,'No healing above 30');
  const overkill=structuredClone(next);overkill.players[foe].board[0].health=1;
  assert.equal(applyAction(overkill,{type:'attack',attackerUid:blessed.uid,target:'mercy-target'}).players[seat].treasury,21,'Only actual health removed is healed');
  const heroHit=applyAction(next,{type:'attack',attackerUid:blessed.uid,target:'hero'});
  assert.equal(heroHit.players[foe].treasury,17);assert.equal(heroHit.players[seat].treasury,23);
  state=fixture('honorable-duels',seat);state.players[seat].board=[fighter('attacker')];state.players[seat===0?1:0].board=[fighter('enemy')];
  assert(!legalActions(state).some(a=>a.type==='attack'&&a.target==='hero'));
  assert(legalActions(state).some(a=>a.type==='attack'&&a.target==='enemy'));
  state.players[seat===0?1:0].board=[];assert(legalActions(state).some(a=>a.type==='attack'&&a.target==='hero'));covered.add('honorable-duels');

  for(const [id,expectedGas,expectedHealth,expectedStaked] of [
    ['garrison-holiday',10,2,true],['full-granaries',12,2,true],['tight-rations',10,2,true],
    ['field-hospital',11,3,true],['morning-parade',10,2,false],
  ] as const){
    state=fixture(id,seat);state.turn=seat===0?1:0;
    state.players[seat].board=[fighter('income',{staked:true,canAttack:false})];
    const result=applyAction(state,{type:'end-turn'});
    assert.equal(result.players[seat].gas,expectedGas,`${id} income for P${seat}`);
    assert.equal(result.players[seat].board[0].health,expectedHealth);
    assert.equal(result.players[seat].board[0].staked,expectedStaked);
    if(!expectedStaked)assert.equal(result.players[seat].board[0].canAttack,true);covered.add(id);
  }
  state=fixture('legion-rations',seat);next=play(state,'lending-legionnaire','rations');
  assert.equal(next.players[seat].treasury,21);next=play(next,'pixel-squire','more-rations');
  assert.equal(next.players[seat].treasury,21);covered.add('legion-rations');
  state=fixture('scribes-insight',seat);next=play(state,'restoration-rite','first-spell');
  assert.equal(next.players[seat].hand.length,1);next=play(next,'restoration-rite','second-spell');
  assert.equal(next.players[seat].hand.length,1,'Only one extra draw each own turn');covered.add('scribes-insight');
  state=fixture('ink-tax',seat);assert.equal(play(state,'restoration-rite','tax').players[seat].treasury,19);
  state.players[seat].treasury=1;assert.equal(play(state,'restoration-rite','last-health').players[seat].treasury,1);covered.add('ink-tax');
}

// Each one-shot event performs its declared operation on both players.
for(const rule of EMPEROR_RULES.filter(r=>r.kind==='event')){
  const state=fixture(rule.id);state.emperor!.active=null;
  state.players[0].treasury=1;state.players[1].treasury=19;
  for(const p of state.players){
    p.board=[fighter(`weak-${p.id}`,{attack:1,health:1,maxHealth:2,staked:true,canAttack:false}),fighter(`strong-${p.id}`,{attack:5,health:3,maxHealth:5})];
    (p as typeof p&{mempool:unknown[]}).mempool=[{uid:`edict-${p.id}`,cardId:'staking-pool',name:'Staking Pool',owner:p.id}];
  }
  const before=structuredClone(state);const draws:PlayerId[]=[];
  resolveEmperorEvent(state,rule.id,{draw:(pid,count)=>{assert.equal(count,1);draws.push(pid);},log:()=>{}});
  switch(rule.id){
    case 'festival':assert.deepEqual(draws,[0,1]);break;
    case 'arena-quake':for(const p of state.players){assert.equal(p.board.length,1);assert.equal(p.board[0].health,2);}break;
    case 'imperial-tax':assert.deepEqual(state.players.map(p=>p.treasury),[1,17]);assert.equal(state.winner,null);break;
    case 'bread-and-games':assert.deepEqual(state.players.map(p=>p.treasury),[4,22]);break;
    case 'war-cry':for(const p of state.players)assert.deepEqual(p.board.map(m=>m.attack),[2,6]);break;
    case 'bronze-issue':for(const p of state.players)assert.deepEqual(p.board.map(m=>[m.health,m.maxHealth]),[[2,3],[4,6]]);break;
    case 'blunt-weapons':for(const p of state.players)assert.deepEqual(p.board.map(m=>m.attack),[0,4]);break;
    case 'medical-inspection':for(const p of state.players)assert.deepEqual(p.board.map(m=>m.health),[2,5]);break;
    case 'cut-the-tallest':for(const p of state.players)assert.deepEqual(p.board.map(m=>m.attack),[1,3]);break;
    case 'shield-the-smallest':for(const p of state.players)assert.deepEqual(p.board.map(m=>[m.health,m.maxHealth]),[[3,4],[3,5]]);break;
    case 'amnesty':for(const p of state.players)assert.deepEqual((p as typeof p&{mempool:unknown[]}).mempool,[]);break;
    case 'garrison-recall':for(const p of state.players){assert.equal(p.board[0].staked,false);assert.equal(p.board[0].canAttack,p.id===state.turn);}break;
    case 'reserve-grant':for(const p of state.players)assert.equal(p.powerIncome,2);break;
    case 'emergency-guard':for(const p of state.players){assert.equal(p.board[0].taunt,true);assert.equal(p.board[0].health,3);}break;
    case 'mirror-drill':for(const p of state.players)assert.deepEqual(p.board.map(m=>[m.attack,m.health,m.maxHealth]),[[1,1,1],[3,5,5]]);break;
    case 'balanced-books':assert.deepEqual(state.players.map(p=>p.treasury),[10,10]);break;
    default:assert.fail(`Unverified event: ${rule.id}`);
  }
  assert.deepEqual(state.players.map(p=>p.hand),before.players.map(p=>p.hand),'Public events do not expose or alter hidden hand identities');
  covered.add(rule.id);
}
assert.deepEqual(Array.from(covered).sort(),EMPEROR_RULES.map(r=>r.id).sort(),'All forty rules have a behavioral assertion');

for(const seat of [0,1] as const){
  const state=fixture('ink-tax',seat);
  state.players[seat].hand=[{uid:'last-loan',cardId:'flash-loan'}];
  state.players[seat].deck=[];state.players[seat].treasury=1;state.players[seat].gas=10;
  const lost=applyAction(state,{type:'cast-spell',uid:'last-loan'});
  assert.equal(lost.winner,1-seat);
  assert(lost.players[seat].treasury<=0,'A nonlethal imperial tax cannot resurrect a treasury defeated by ordinary fatigue');
}

// Opening declarations precede mulligan; the full-round calendar has no repeats.
let calendar=createGame('builder',FREE_DECKS.builder,'whale',FREE_DECKS.whale,{enableMulligan:true,emperor:true},42);
assert.equal(calendar.emperor!.history.length,1);assert.equal(activeEmperorRule(calendar)?.kind,'law');
assert.deepEqual(calendar.emperor!.history[0],{id:calendar.emperor!.active,round:1,block:1});
assert.equal(emperorRound({block:2}),1);assert.equal(emperorRound({block:7}),4);
while(calendar.block<17&&calendar.winner===null){
  calendar=applyAction(calendar,legalActions(calendar).find(a=>a.type==='mulligan')??{type:'end-turn'});
}
assert.deepEqual(calendar.emperor!.history.map(a=>[a.round,a.block]),[[1,1],[4,7],[7,13]]);
assert.equal(new Set(calendar.emperor!.history.map(a=>a.id)).size,3);
assert.equal(emperorAnnounceIfDue(calendar,{draw:()=>assert.fail('No fourth declaration'),log:()=>{}}),false);
const restored=JSON.parse(JSON.stringify(calendar)) as GameState;
assert.deepEqual(applyAction(restored,{type:'end-turn'}),applyAction(calendar,{type:'end-turn'}),'JSON restoration preserves rules and RNG');

// First-seat and second-seat compensation both use the same published law.
for(const [law,p0Gas,p1Gas] of [['full-granaries',2,3],['tight-rations',1,1]] as const){
  let opening:GameState|undefined;
  for(let seed=0;seed<500&&!opening;seed++){
    const candidate=createGame('builder',FREE_DECKS.builder,'builder',FREE_DECKS.builder,{emperor:true,enableMulligan:true},seed);
    if(candidate.emperor?.active===law)opening=candidate;
  }
  assert(opening,`A seed selects ${law}`);assert.equal(opening.players[0].gas,p0Gas);
  opening=applyAction(opening,{type:'mulligan',uids:[]});opening=applyAction(opening,{type:'end-turn'});
  assert.equal(opening.players[1].gas,0,'P1 has not completed its opening selection');
  opening=applyAction(opening,{type:'mulligan',uids:[]});assert.equal(opening.players[1].gas,p1Gas);
}

// A one-shot decree removes the prior law and reserves income for each next own turn.
let grantSeed:number|undefined;
for(let rng=0;rng<500&&grantSeed===undefined;rng++){
  const candidate=fixture('three-seats');candidate.block=7;candidate.emperor!.rng=rng;
  emperorAnnounceIfDue(candidate,{draw:()=>{},log:()=>{}});
  if(candidate.emperor!.history[1]?.id==='reserve-grant')grantSeed=rng;
}
assert.notEqual(grantSeed,undefined);
let grant=fixture('three-seats');grant.turn=1;grant.block=6;grant.emperor!.rng=grantSeed!;
grant=applyAction(grant,{type:'end-turn'});
assert.equal(grant.emperor!.active,null,'An event replaces the prior sustained law');
assert.equal(grant.emperor!.history[1].id,'reserve-grant');
assert.equal(grant.players[0].gas,10,'No immediate payout on the announcing current turn');
assert.deepEqual(grant.players.map(p=>p.powerIncome),[2,2]);
grant=applyAction(grant,{type:'end-turn'});assert.equal(grant.players[1].gas,12);assert.equal(grant.players[0].powerIncome,2);
grant=applyAction(grant,{type:'end-turn'});assert.equal(grant.players[0].gas,12);
assert.deepEqual(grant.players.map(p=>p.powerIncome),[undefined,undefined]);
const even=fixture('three-seats');even.block=8;
assert.equal(emperorAnnounceIfDue(even,{draw:()=>assert.fail('Even blocks never announce'),log:()=>{}}),false);

// Classic behavior remains exactly opt-in; independent Emperor RNG never shifts legacy setup.
const classic=createGame('builder',FREE_DECKS.builder,'whale',FREE_DECKS.whale,71);
assert.equal(emperorOf(classic),null);
assert.deepEqual(createGame('builder',FREE_DECKS.builder,'whale',FREE_DECKS.whale,{emperor:false},71),classic);
assert.deepEqual(createGame('builder',FREE_DECKS.builder,'whale',FREE_DECKS.whale,{emperor:true},71).players.map(p=>[p.deck,p.hand]),classic.players.map(p=>[p.deck,p.hand]));
const protectedCards=structuredClone(CARDS);
for(const rule of EMPEROR_RULES.filter(r=>r.kind==='law')){
  const state=fixture(rule.id);const minion=fighter('prepared');emperorPrepareFighter(state,CARDS['pixel-squire'],minion);
  assert.deepEqual(CARDS,protectedCards,'Rules never mutate canonical card definitions');
}

// Dedicated selection replay and AI legality / termination, with every ruler in both seats.
const heroes=Object.keys(HEROES);let games=0;
for(let index=0;index<heroes.length;index++)for(const seed of [11,89,170]){
  const a=heroes[index],b=heroes[(index+1)%heroes.length];
  let state=createGame(a,FREE_DECKS[a],b,FREE_DECKS[b],{emperor:true,enableMulligan:true},seed);
  let replay=createGame(a,FREE_DECKS[a],b,FREE_DECKS[b],{emperor:true,enableMulligan:true},seed);
  let steps=0,ownTurnActions=0;
  while(state.winner===null&&steps<2500){
    const action=chooseAiAction(state);assert(legalActions(state).some(candidate=>JSON.stringify(candidate)===JSON.stringify(action)),`${a}/${b} AI action is legal`);
    const block=state.block;const source=state,original=structuredClone(state);state=applyAction(state,action);replay=applyAction(replay,action);
    assert.deepEqual(source,original,'Replay actions never mutate their input');
    assert.deepEqual(state,replay,'Same seed and action trace produce identical Emperor effects');
    ownTurnActions=state.block===block?ownTurnActions+1:0;assert(ownTurnActions<100,'No AI loop within one turn');steps+=1;
  }
  assert.notEqual(state.winner,null,`AI game terminates: ${a}/${b}, seed ${seed}`);games+=1;
  const view=gameSnapshot(state,0,0);
  assert.equal(view.players[1].hand,undefined);
  assert(!('rng' in view));
  if('emperor' in view&&view.emperor)assert(!('rng' in view.emperor),'Do not leak the future rule selection RNG');
}
console.log(`EMPEROR OK: exactly 40 effects verified in both seats; round 1/4/7 calendar; legacy opt-in; deterministic JSON replay; immutable cards/transitions; safe event damage; ${games} completed nine-ruler AI games; private hand and RNG protected.`);
