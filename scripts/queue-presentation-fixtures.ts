import {createGame,mempoolOf} from '../lib/engine/engine';
import type {Action,GameState,Minion,PlayerId} from '../lib/engine/types';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';

export interface QueuePresentationFixture<TExpected> {
  batch:PresentationBatch;
  expected:TExpected;
}

export interface FullBoardMixedEffectsExpected {
  block:number;
  resolvedCardIds:string[];
  ownUids:string[];
  enemyUids:string[];
  spellUidsByCardId:Record<string,string>;
  effectTargetUidsByCardId:Record<string,string[]>;
  halvingUids:string[];
}

export interface SolarRugPullExpected {
  targetUid:string;
  targetHealthBefore:number;
  targetHealthAfterSolar:number;
  deathCause:'damage'|'rugpull';
  resolvedCardIds:string[];
  solarSpellUid:string;
  rugPullSpellUid:string;
  solarTargetUids:string[];
  rugPullVictimUids:string[];
}

export interface PriorityFourthEntryExpected {
  spellUidsInQueueOrder:string[];
  cardIdsInQueueOrder:string[];
  highestCostUid:string;
  highestCostCardId:'rug-pull';
  highestCostQueueIndex:number;
  counteredSpellUids:string[];
  remainingEnemySpellUids:string[];
  prioritySpellUid:string;
}

function fighter(uid:string,cardId:string,health:number,maxHealth:number,attack?:number,staked=false):Minion{
  const card=CARDS[cardId];
  if(!card||card.type!=='minion')throw new Error(`Fixture requires a minion card: ${cardId}`);
  return {
    uid,cardId,name:card.name,attack:attack??card.attack??0,health,maxHealth,
    canAttack:false,staked,fresh:false,taunt:card.taunt===true,rush:card.rush===true,
    lifesteal:card.lifesteal===true,
  };
}

function dispatchLegal(game:GameSession,match:(action:Action)=>boolean,label:string):PresentationBatch{
  const action=game.legal().find(match);
  if(!action)throw new Error(`Fixture could not dispatch legal action: ${label}`);
  const batch=game.dispatch(action);
  if(!batch)throw new Error(`Fixture action did not produce a batch: ${label}`);
  game.impact(batch.id);
  game.complete(batch.id);
  return batch;
}

function endTurn(game:GameSession,label:string):PresentationBatch{
  return dispatchLegal(game,action=>action.type==='end-turn',label);
}

function cast(game:GameSession,uid:string,label:string):PresentationBatch{
  return dispatchLegal(game,action=>action.type==='cast-spell'&&action.uid===uid,label);
}

function queueUids(state:GameState,owner:PlayerId):Array<{uid:string;cardId:string}>{
  return mempoolOf(state,owner).map(entry=>({uid:entry.uid,cardId:entry.cardId}));
}

function finishOwnerQueue(game:GameSession,owner:PlayerId):PresentationBatch{
  const first=endTurn(game,'pass to opposing turn');
  if(first.after.turn===owner)throw new Error('Fixture expected to pass to the opposing turn');
  const resolution=endTurn(game,'return to queued-spell owner');
  if(resolution.after.turn!==owner)throw new Error('Fixture did not return to the spell owner');
  return resolution;
}

/**
 * Full 7/7 boards and four legal queued effects resolve on block 3. Each row
 * contains one Ape Praetorian, so both board sides emit a Halving entry after
 * the spells. The Senate target is deterministic for seed 42.
 */
export function createFullBoardMixedEffectsFixture():QueuePresentationFixture<FullBoardMixedEffectsExpected>{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,42);
  const spellIds=['solar-sapper','senate-censure','restoration-rite','audit'];
  const spellHandUids=spellIds.map((_,i)=>`mixed-spell-${i}`);
  state.players[0].hand=spellIds.map((cardId,i)=>({uid:spellHandUids[i],cardId}));
  state.players[0].gas=state.players[0].maxGas=10;
  const ownUids=Array.from({length:6},(_,i)=>`own-${i}`).concat('own-ape');
  const enemyUids=Array.from({length:6},(_,i)=>`foe-${i}`).concat('foe-ape');
  state.players[0].board=Array.from({length:6},(_,i)=>fighter(`own-${i}`,'amm-centurion',2,4))
    .concat(fighter('own-ape','ape-praetorian',1,3));
  state.players[1].board=Array.from({length:6},(_,i)=>fighter(`foe-${i}`,'amm-centurion',4,4))
    .concat(fighter('foe-ape','ape-praetorian',3,3));

  const game=new GameSession(state);
  spellHandUids.forEach((uid,i)=>cast(game,uid,`queue ${spellIds[i]}`));
  const queued=queueUids(game.snapshot().state,0);
  const batch=finishOwnerQueue(game,0);
  const spellUidsByCardId=Object.fromEntries(queued.map(entry=>[entry.cardId,entry.uid]));

  return {
    batch,
    expected:{
      block:3,
      resolvedCardIds:spellIds,
      ownUids,
      enemyUids,
      spellUidsByCardId,
      effectTargetUidsByCardId:{
        'solar-sapper':enemyUids,
        'senate-censure':['foe-4'],
        'restoration-rite':ownUids,
        audit:ownUids,
      },
      halvingUids:['own-ape','foe-ape'],
    },
  };
}

/**
 * Queue Solar Sapper before RUG PULL and resolve both through owner turns.
 * Health 2 dies to Solar; health 4 survives its damage and is then Rugged.
 */
export function createSolarRugPullFixture(targetHealth:2|4):QueuePresentationFixture<SolarRugPullExpected>{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,501);
  const targetUid=targetHealth===2?'solar-lethal':'solar-then-rug';
  const spellHandUids={solar:'solar-before-rug',rug:'rug-after-solar'};
  state.players[0].hand=[
    {uid:spellHandUids.solar,cardId:'solar-sapper'},
    {uid:spellHandUids.rug,cardId:'rug-pull'},
  ];
  state.players[0].gas=state.players[0].maxGas=11;
  state.players[1].board=[fighter(targetUid,'amm-centurion',targetHealth,targetHealth)];

  const game=new GameSession(state);
  cast(game,spellHandUids.solar,'queue Solar Sapper');
  cast(game,spellHandUids.rug,'queue RUG PULL');
  const queued=queueUids(game.snapshot().state,0);
  const batch=finishOwnerQueue(game,0);
  const death=batch.events?.deaths?.find(entry=>entry.uid===targetUid);

  return {
    batch,
    expected:{
      targetUid,
      targetHealthBefore:targetHealth,
      targetHealthAfterSolar:Math.max(0,targetHealth-2),
      deathCause:targetHealth===2?'damage':'rugpull',
      resolvedCardIds:['solar-sapper','rug-pull'],
      solarSpellUid:queued.find(entry=>entry.cardId==='solar-sapper')?.uid??'',
      rugPullSpellUid:queued.find(entry=>entry.cardId==='rug-pull')?.uid??'',
      solarTargetUids:[targetUid],
      rugPullVictimUids:death?.cause==='rugpull'?[targetUid]:[],
    },
  };
}

/**
 * P1 legally queues four spells from its 10 base Orders plus five staked
 * minions. P0 then casts Priority Fee; RUG PULL is the fourth/highest-cost
 * entry and must be the exact removed UID.
 */
export function createPriorityFourthEntryFixture():QueuePresentationFixture<PriorityFourthEntryExpected>{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,907);
  const queuedCards=['senate-censure','restoration-rite','solar-sapper','rug-pull'] as const;
  const enemyHandUids=queuedCards.map((_,i)=>`enemy-spell-${i}`);
  const priorityHandUid='priority-fee-hand';
  state.players[0].hand=[{uid:priorityHandUid,cardId:'priority-fee'}];
  state.players[0].gas=state.players[0].maxGas=1;
  state.players[1].hand=queuedCards.map((cardId,i)=>({uid:enemyHandUids[i],cardId}));
  state.players[1].gas=0;
  state.players[1].maxGas=10;
  state.players[1].board=Array.from({length:5},(_,i)=>fighter(`staked-${i}`,'amm-centurion',2,2,2,true));

  const game=new GameSession(state);
  endTurn(game,'pass to the four-spell owner');
  const p1State=game.snapshot().state;
  if(p1State.turn!==1||p1State.players[1].gas!==15)throw new Error('Five garrisons must fund exactly 15 Orders for P1');
  enemyHandUids.forEach((uid,i)=>cast(game,uid,`queue ${queuedCards[i]}`));
  const queued=queueUids(game.snapshot().state,1);
  if(queued.length!==4||queued[3].cardId!=='rug-pull')throw new Error('RUG PULL must be queued fourth and be the unique highest-cost entry');
  endTurn(game,'return to P0 for Priority Fee');
  const batch=cast(game,priorityHandUid,'cast Priority Fee against fourth queue entry');
  const prioritySpellUid=batch.events?.spellQueued?.mempoolUid??'';
  const expectedCountered=[queued[3].uid];

  return {
    batch,
    expected:{
      spellUidsInQueueOrder:queued.map(entry=>entry.uid),
      cardIdsInQueueOrder:queued.map(entry=>entry.cardId),
      highestCostUid:queued[3].uid,
      highestCostCardId:'rug-pull',
      highestCostQueueIndex:3,
      counteredSpellUids:expectedCountered,
      remainingEnemySpellUids:queued.filter(entry=>!expectedCountered.includes(entry.uid)).map(entry=>entry.uid),
      prioritySpellUid,
    },
  };
}
