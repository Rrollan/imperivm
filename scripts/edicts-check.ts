import assert from 'node:assert/strict';
import {applyAction,createGame,mempoolOf,spellEffectsOf} from '../lib/engine/engine';
import {DECKS} from '../lib/decks';
import {diffAction} from '../lib/events';
import {soundsForEvents} from '../lib/audio/events';
import {ordersView} from '../components/presentation/ordersView';
import {abilityCues} from '../components/presentation/abilityCues';
import {videoCues} from '../components/presentation/videoCue';
import {cardIdentity} from '../components/presentation/cardIdentity';
import roles from '../components/presentation/cardRoles.json';
import {CARDS} from '../lib/cards';
import {cardText,keywordName} from '../lib/locale';
import type {EffectDef,GameState,Minion} from '../lib/engine/types';
import type {PresentationBatch} from '../components/presentation/GameSession';

const minion=(uid:string,attack=2,health=2,maxHealth=health):Minion=>({uid,cardId:'amm-centurion',name:'AMM Centurion',attack,health,maxHealth,staked:false,canAttack:true,fresh:false,taunt:false,rush:false,lifesteal:false});
const ape=(uid:string,attack=2,health=3,maxHealth=health):Minion=>({...minion(uid,attack,health,maxHealth),cardId:'ape-praetorian',name:'Ape Praetorian'});
function fixture(card:string,seed=42):GameState{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,seed);
  state.players[0].hand=[{uid:'fixture-card',cardId:card}];
  state.players[0].gas=state.players[0].maxGas=5;
  state.players[0].board=[];state.players[1].board=[];
  return state;
}
function queueAndResolve(state:GameState){
  const original=JSON.stringify(state);
  const queued=applyAction(state,{type:'cast-spell',uid:'fixture-card'});
  assert.equal(JSON.stringify(state),original,'Queueing must preserve the input snapshot');
  assert.equal(mempoolOf(queued,0).length,1);
  assert.deepEqual(queued.players.map(p=>p.board),state.players.map(p=>p.board),'An edict must not resolve on cast');
  const waiting=applyAction(queued,{type:'end-turn'});
  assert.equal(mempoolOf(waiting,0).length,1,'Enemy turn must not consume our edict');
  const after=applyAction(waiting,{type:'end-turn'});
  assert.equal(mempoolOf(after,0).length,0,'Owner turn must consume the edict');
  const batch:PresentationBatch={id:1,revision:1,action:{type:'end-turn'},before:waiting,after,events:diffAction(waiting,after,{type:'end-turn'})};
  return {after,batch};
}
function queueCopiesAndResolve(state:GameState,cardIds:string[]){
  state.players[0].hand=cardIds.map((cardId,index)=>({uid:`fixture-card-${index}`,cardId}));
  state.players[0].gas=state.players[0].maxGas=10;
  let queued=state;
  for(let index=0;index<cardIds.length;index++)queued=applyAction(queued,{type:'cast-spell',uid:`fixture-card-${index}`});
  const sourceUids=mempoolOf(queued,0).map(entry=>entry.uid);
  const waiting=applyAction(queued,{type:'end-turn'});
  const after=applyAction(waiting,{type:'end-turn'});
  const batch:PresentationBatch={id:2,revision:2,action:{type:'end-turn'},before:waiting,after,events:diffAction(waiting,after,{type:'end-turn'})};
  return {after,batch,sourceUids};
}
function withTestSpells(spells:Array<{id:string;spell:EffectDef}>,run:()=>void){
  const previous=new Map<string,typeof CARDS[string]|undefined>();
  for(const {id,spell} of spells){
    previous.set(id,CARDS[id]);
    CARDS[id]={id,name:id,faction:'DeFi',rarity:'rare',cost:2,type:'spell',text:'Test-only spell fixture.',spell};
  }
  try{run();}
  finally{
    previous.forEach((card,id)=>{if(card)CARDS[id]=card;else delete CARDS[id];});
  }
}

const healing=fixture('restoration-rite');
healing.players[0].board=[minion('wounded',2,1,4),minion('almost-full',2,3,4),minion('full',2,4,4)];
healing.players[1].board=[minion('enemy-wounded',2,1,4)];
healing.players[0].treasury=18;
const heal=queueAndResolve(healing);
assert.deepEqual(heal.after.players[0].board.map(m=>m.health),[3,4,4]);
assert.equal(heal.after.players[1].board[0].health,1,'Healing must respect ownership');
assert.equal(heal.after.players[0].treasury,18,'Fighter healing must not heal the ruler');
assert.deepEqual(abilityCues(heal.batch).filter(c=>c.kind==='heal').map(c=>c.to).sort(),['almost-full','wounded']);
assert.deepEqual(videoCues(heal.batch).map(c=>c.anchor).sort(),['almost-full','wounded']);
assert.equal(heal.batch.events?.damages?.find(d=>d.uid==='almost-full')?.health,4);
assert.equal(soundsForEvents(heal.batch.events!).filter(sound=>sound==='heal').length,1,'Group healing plays one contact cue rather than stacking one sound per fighter');

const healthyApe=fixture('restoration-rite');healthyApe.players[0].board=[ape('full-ape')];
const healBeforeHalving=queueAndResolve(healthyApe);
assert.deepEqual(healBeforeHalving.batch.events?.effectResults?.[0]?.targets,[], 'A full-health Ape must not be reported as healed by the later halving tick');
assert.equal(healBeforeHalving.after.players[0].board[0].health,4,'The subsequent halving tick still raises the Ape health normally');
assert.equal(soundsForEvents(healBeforeHalving.batch.events!).includes('heal'),false,'Passive growth after a capped heal must not sound like healing');

const weakenedApe=fixture('senate-censure');weakenedApe.players[1].board=[ape('enemy-ape')];
const weakenBeforeHalving=queueAndResolve(weakenedApe);
const apeResult=weakenBeforeHalving.batch.events?.effectResults?.[0];
assert.equal(apeResult?.kind,'weaken-random-enemy');
assert.deepEqual(apeResult?.targets,[{uid:'enemy-ape',attackBefore:2,attackAfter:1,healthBefore:3,healthAfter:3,maxHealth:3}], 'The ledger must retain the exact pre-halving weaken delta');
assert.equal(weakenBeforeHalving.after.players[1].board[0].attack,2,'The later halving tick can restore the final attack without erasing the weaken result');
assert.deepEqual(weakenBeforeHalving.batch.events?.halvings?.map(h=>h.uid),['enemy-ape'],'Compensated weakening must not erase the passive halving cue');
assert.ok(abilityCues(weakenBeforeHalving.batch).some(c=>c.kind==='buff'&&c.to==='enemy-ape'),'The passive buff and the weakening both need feedback');
const woundedApe=fixture('restoration-rite');woundedApe.players[0].board=[{...ape('wounded-ape'),health:1}];
const healedApe=queueAndResolve(woundedApe);
assert.deepEqual(healedApe.batch.events?.halvings?.map(h=>h.uid),['wounded-ape'],'A heal followed by halving must retain both abilities');
assert.deepEqual(healedApe.batch.events?.effectResults?.[0]?.targets.map(t=>[t.healthBefore,t.healthAfter]),[[1,3]],'The heal amount excludes subsequent passive growth');
assert.ok(soundsForEvents(healedApe.batch.events!).includes('heal'),'Healing before halving retains its own audio feedback');

const aoeApe=fixture('solar-sapper');aoeApe.players[1].board=[ape('aoe-ape',2,3,3)];
const aoeBeforeHalving=queueAndResolve(aoeApe);
assert.equal(aoeBeforeHalving.after.players[1].board[0].health,2,'AOE damage resolves before the Ape gains +1 health');
assert.equal(aoeBeforeHalving.after.players[1].board[0].maxHealth,4,'The subsequent passive tick still raises max health');
const aoeResult=aoeBeforeHalving.batch.events?.effectResults?.find(result=>result.kind==='damage-all-enemy-minions');
assert.deepEqual(aoeResult?.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter,target.maxHealth]),[['aoe-ape',3,1,3]],'AOE ledger must preserve the pre-halving damage amount and target');
assert.deepEqual(aoeBeforeHalving.batch.events?.halvings?.map(event=>event.uid),['aoe-ape']);
assert.ok(soundsForEvents(aoeBeforeHalving.batch.events!).includes('damage'),'Damage compensated by subsequent passive growth still sounds at contact');

const lethalAoe=fixture('solar-sapper');lethalAoe.players[1].board=[minion('lethal-aoe-target',2,2,5)];
const lethalAoeResult=queueAndResolve(lethalAoe);
assert.equal(lethalAoeResult.after.players[1].board.length,0,'Lethal AOE removes the fighter from the board');
assert.deepEqual(lethalAoeResult.batch.events?.effectResults?.[0]?.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter,target.maxHealth]),[['lethal-aoe-target',2,0,5]],'The effect ledger must keep a dead target UID and report healthAfter 0');

withTestSpells([
  {id:'edicts-check-heal-treasury',spell:{kind:'heal-treasury',amount:5}},
],()=>{
  const hurtRuler=fixture('edicts-check-heal-treasury');hurtRuler.players[0].treasury=20;
  const rulerHeal=queueAndResolve(hurtRuler);
  assert.equal(rulerHeal.after.players[0].treasury,25);
  assert.deepEqual(rulerHeal.batch.events?.effectResults?.[0]?.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter,target.maxHealth]),[['hero-0',20,25,30]],'Ruler restoration must target the casting ruler with the treasury cap');

  const fullRuler=fixture('edicts-check-heal-treasury');fullRuler.players[0].treasury=30;
  const noRulerHeal=queueAndResolve(fullRuler);
  assert.equal(noRulerHeal.after.players[0].treasury,30);
  assert.deepEqual(noRulerHeal.batch.events?.effectResults?.[0]?.targets,[],'A capped ruler heal must not create an effect target');
});

withTestSpells([
  {id:'edicts-check-random-one',spell:{kind:'damage-random-enemy',amount:1}},
  {id:'edicts-check-random-two',spell:{kind:'damage-random-enemy',amount:2}},
],()=>{
  const state=fixture('edicts-check-random-one');state.players[1].board=[minion('queued-strike-target',2,6,6)];
  const strikes=queueCopiesAndResolve(state,['edicts-check-random-one','edicts-check-random-two']);
  const results=strikes.batch.events?.effectResults??[];
  assert.equal(results.length,2,'Two queued damage spells must produce separate target results');
  assert.deepEqual(results.map(result=>result.mempoolUid),strikes.sourceUids,'Each damage result must retain its own source UID');
  assert.deepEqual(results.map(result=>result.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter])),[
    [['queued-strike-target',6,5]],
    [['queued-strike-target',5,3]],
  ],'Sequential strikes on one fighter must preserve per-spell damage instead of one aggregate delta');
});

withTestSpells([
  {id:'edicts-check-treasury-strike',spell:{kind:'damage-enemy-treasury',amount:2}},
],()=>{
  const state=fixture('edicts-check-treasury-strike');state.players[1].treasury=20;
  const strike=queueAndResolve(state);
  assert.equal(strike.after.players[1].treasury,18);
  assert.deepEqual(strike.batch.events?.effectResults?.[0]?.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter,target.maxHealth]),[['hero-1',20,18,30]],'Treasury damage must identify the enemy ruler UID');
});

const buffSpell=fixture('trait-reroll');buffSpell.players[0].board=[minion('buffed',2,3,3)];
const buff=queueAndResolve(buffSpell);
assert.deepEqual(buff.batch.events?.effectResults?.[0]?.targets.map(target=>[target.uid,target.attackBefore,target.attackAfter,target.healthBefore,target.healthAfter]),[['buffed',2,3,3,3]],'Buff results must retain the source target and stat delta');
const healthBuff=fixture('audit');healthBuff.players[0].board=[minion('audit-buff',2,3,3)];
assert.equal(soundsForEvents(queueAndResolve(healthBuff).batch.events!).includes('heal'),false,'A +1/+1 edict is growth rather than healing');
const leaderBuff=fixture('genesis-pfp');leaderBuff.players[0].gas=10;leaderBuff.players[0].board=[minion('leader-buff',2,3,3)];
const leaderAfter=applyAction(leaderBuff,{type:'play-minion',uid:'fixture-card'});
assert.equal(soundsForEvents(diffAction(leaderBuff,leaderAfter,{type:'play-minion',uid:'fixture-card'})!).includes('heal'),false,'A leader battlecry must not mislabel extra health as restoration');
const powerBefore=fixture('senate-censure');powerBefore.players[0].treasury=27;
const powerAfter=applyAction(powerBefore,{type:'hero-power'});
assert.ok(soundsForEvents({}, {action:{type:'hero-power'},before:powerBefore,after:powerAfter}).includes('heal'),'Actual ruler healing has audio even without a fighter delta');
const cappedBefore=fixture('senate-censure');
assert.equal(soundsForEvents({}, {action:{type:'hero-power'},before:cappedBefore,after:applyAction(cappedBefore,{type:'hero-power'})}).includes('heal'),false,'A full ruler still has activation feedback without a false heal');
const garrisonBefore=fixture('senate-censure');garrisonBefore.players[0].board=[minion('garrison')];
const garrisonAfter=applyAction(garrisonBefore,{type:'stake',uid:'garrison'});
assert.deepEqual(soundsForEvents({}, {action:{type:'stake',uid:'garrison'},before:garrisonBefore,after:garrisonAfter}),['stake'],'Garrison actions retain feedback without a BattleEvents envelope');

const duplicateHeals=fixture('restoration-rite');duplicateHeals.players[0].board=[minion('twice-wounded',2,1,5)];
const twoHeals=queueCopiesAndResolve(duplicateHeals,['restoration-rite','restoration-rite']);
const healResults=twoHeals.batch.events?.effectResults??[];
assert.equal(healResults.length,2,'Both copies of a queued edict need independent results');
assert.deepEqual(healResults.map(result=>result.mempoolUid),twoHeals.sourceUids,'Each result must retain the originating mempool UID');
assert.deepEqual(healResults.map(result=>result.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter])),[
  [['twice-wounded',1,3]],
  [['twice-wounded',3,5]],
],'Duplicate copies must report ordered, per-copy health deltas');
assert.equal(spellEffectsOf(twoHeals.after).length,2,'The public getter exposes both per-action effect results');
assert.deepEqual(spellEffectsOf(twoHeals.after)[0].targets,healResults[0].targets,'The public getter returns the recorded target data');
assert.deepEqual(spellEffectsOf(applyAction(twoHeals.after,{type:'end-turn'})),[],'The effect ledger resets on the next action');

const weak=fixture('senate-censure');
weak.players[1].board=[minion('defender',1,3)];
const debuff=queueAndResolve(weak);
assert.equal(debuff.after.players[1].board[0].attack,0);
assert.equal(debuff.after.players[1].board[0].health,3,'Weakening must not masquerade as damage');
assert.equal(abilityCues(debuff.batch).find(c=>c.kind==='weaken')?.to,'defender');
assert.equal(videoCues(debuff.batch).find(c=>c.id==='16-edict-weaken')?.anchor,'defender');
const noAttack=fixture('senate-censure');noAttack.players[1].board=[minion('zero',0)];
const noChange=queueAndResolve(noAttack);
assert.equal(noChange.after.players[1].board[0].attack,0,'Attack cannot go negative');
assert.equal(abilityCues(noChange.batch).some(c=>c.kind==='weaken'),false,'No changed stat means no false debuff float');
const empty=fixture('senate-censure');
assert.equal(queueAndResolve(empty).after.players[1].treasury,empty.players[1].treasury,'An empty enemy board must not redirect weakening to the ruler');

const randomized=fixture('senate-censure',123);randomized.players[1].board=[minion('enemy-a'),minion('enemy-b')];
const runA=queueAndResolve(randomized),runB=queueAndResolve(randomized);
assert.deepEqual(runA.after,runB.after,'Random selection must remain seeded');
const changed=runA.after.players[1].board.filter(m=>m.attack===1).map(m=>m.uid);
assert.equal(changed.length,1);
assert.deepEqual(abilityCues(runA.batch).filter(c=>c.kind==='weaken').map(c=>c.to),changed);

const canceled=fixture('senate-censure');canceled.players[1].board=[minion('untouched')];
let cancellation=applyAction(canceled,{type:'cast-spell',uid:'fixture-card'});
cancellation=applyAction(cancellation,{type:'end-turn'});
cancellation.players[1].hand=[{uid:'counter',cardId:'audit'}];cancellation.players[1].gas=5;
const counter=applyAction(cancellation,{type:'cast-spell',uid:'counter'});
assert.equal(mempoolOf(counter,0).length,0,'Priority must cancel the queued new edict');
assert.equal(applyAction(counter,{type:'end-turn'}).players[1].board[0].attack,2);
assert.equal(diffAction(cancellation,counter,{type:'cast-spell',uid:'counter'})?.spellCountered?.cardId,'senate-censure','A real counter log must still produce a counter event');

const ordersReward=queueAndResolve(fixture('priority-fee'));
assert.equal(ordersReward.after.players[0].maxGas,6);
assert.equal(ordersReward.after.players[0].gas,7,'An edict reward must survive the subsequent base refill without carrying old unspent orders');
const doubledOrders=queueCopiesAndResolve(fixture('priority-fee'),['priority-fee','priority-fee']);
assert.equal(doubledOrders.after.players[0].gas,12,'Two delayed rewards stack above the ten-order base cap');
assert.equal(doubledOrders.after.players[0].maxGas,10);
const ordersAndGarrison=fixture('priority-fee');ordersAndGarrison.players[0].board=[{...minion('reward-garrison'),staked:true,canAttack:false}];
assert.equal(queueAndResolve(ordersAndGarrison).after.players[0].gas,8,'Garrison income and the edict reward both survive refill');

const multiCounter=fixture('frontrun-bot');multiCounter.players[0].gas=10;
multiCounter.players[1].hand=[{uid:'first-victim',cardId:'rug-pull'},{uid:'second-victim',cardId:'flash-loan'}];
multiCounter.players[1].gas=multiCounter.players[1].maxGas=10;
let multiWaiting=applyAction(multiCounter,{type:'end-turn'});
multiWaiting=applyAction(multiWaiting,{type:'cast-spell',uid:'first-victim'});
multiWaiting=applyAction(multiWaiting,{type:'cast-spell',uid:'second-victim'});
multiWaiting=applyAction(multiWaiting,{type:'end-turn'});
const multiAction={type:'play-minion' as const,uid:'fixture-card'};
const multiAfter=applyAction(multiWaiting,multiAction);
const multiBatch:PresentationBatch={id:3,revision:3,action:multiAction,before:multiWaiting,after:multiAfter,events:diffAction(multiWaiting,multiAfter,multiAction)};
assert.deepEqual(multiBatch.events?.spellCounters?.map(entry=>entry.cardId),['rug-pull','flash-loan'],'Every actual cancelled UID must be published in engine order');
assert.equal(multiBatch.events?.spellCountered?.cardId,'rug-pull','The legacy singular counter keeps the first target');
assert.deepEqual(abilityCues(multiBatch).filter(cue=>cue.kind==='counter'&&cue.phase==='after').map(cue=>cue.to),multiBatch.events!.spellCounters!.map(entry=>`queued-${entry.mempoolUid}`),'Both cancelled entries get their own local feedback');
assert.equal(soundsForEvents(multiBatch.events!).filter(sound=>sound==='priority').length,1,'Double cancellation does not double the priority sound');

withTestSpells([{id:'edicts-check-delayed-counter',spell:{kind:'counter-mempool'}}],()=>{
  const state=fixture('edicts-check-delayed-counter');
  state.players[1].hand=[{uid:'delayed-counter-victim',cardId:'rug-pull'}];
  state.players[1].gas=state.players[1].maxGas=10;
  let waiting=applyAction(state,{type:'cast-spell',uid:'fixture-card'});
  waiting=applyAction(waiting,{type:'end-turn'});
  waiting=applyAction(waiting,{type:'cast-spell',uid:'delayed-counter-victim'});
  const after=applyAction(waiting,{type:'end-turn'});
  const events=diffAction(waiting,after,{type:'end-turn'});
  assert.deepEqual(events?.spellResolved?.map(entry=>[entry.owner,entry.cardId]),[[0,'edicts-check-delayed-counter']],'Only the active owner resolves an edict; the victim is not falsely paired with that resolve log');
  assert.deepEqual(events?.spellCounters?.map(entry=>[entry.owner,entry.cardId]),[[1,'rug-pull']]);
});

const lethalQueue=fixture('flash-loan');
lethalQueue.players[0].hand=[{uid:'lethal-first',cardId:'flash-loan'},{uid:'after-lethal',cardId:'senate-censure'}];
lethalQueue.players[0].gas=lethalQueue.players[0].maxGas=5;
lethalQueue.players[0].treasury=1;lethalQueue.players[0].deck=[];
let lethalWaiting=applyAction(lethalQueue,{type:'cast-spell',uid:'lethal-first'});
lethalWaiting=applyAction(lethalWaiting,{type:'cast-spell',uid:'after-lethal'});
lethalWaiting=applyAction(lethalWaiting,{type:'end-turn'});
const lethalBefore=lethalWaiting;
const lethalAfter=applyAction(lethalWaiting,{type:'end-turn'});
const lethalEvents=diffAction(lethalBefore,lethalAfter,{type:'end-turn'});
assert.equal(lethalAfter.winner,1,'The first queued draw spell ends the game by fatigue');
assert.equal(lethalEvents?.spellResolved?.length,1,'Only the spell that ran before terminal game state is reported resolved');
assert.equal(lethalEvents?.spellCountered,undefined,'Unexecuted queue entries after a terminal winner are not falsely reported as counters');

const six=ordersView(6,6);
assert.equal(six.slots.filter(s=>s==='ready').length,6,'Six available orders must produce six stones including the first socket');
assert.equal(six.slots[0],'ready');
const bonus=ordersView(6,5);assert.equal(bonus.bonus,1);assert.equal(bonus.slots.filter(s=>s==='bonus').length,1);
const overflow=ordersView(12,10);assert.equal(overflow.available,12);assert.equal(overflow.overflow,2);assert.equal(overflow.bonus,2);assert.equal(overflow.slots.length,10);
assert.equal(ordersView(0,6).slots.filter(s=>s==='spent').length,6);
for(const id of Object.keys(CARDS)){assert.ok(id in roles,`${id}: explicit role is required`);assert.ok(cardIdentity(id).rank>=1&&cardIdentity(id).rank<=4);}
assert.equal(keywordName('Gas','ru'),'Приказы');assert.equal(keywordName('Gas','en'),'Orders');
assert.equal(/газ/i.test(cardText('priority-fee','ru')),false);
console.log('EDICTS OK: ordered per-spell effect ledgers, heal/weaken/AOE/treasury/buff targets, halving compensation, lethal target UIDs, duplicate queued strikes, terminal queue handling, priority cancellation and resource counts/overflow.');
