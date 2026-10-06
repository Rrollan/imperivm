/**
 * Headless contract matrix for every card in lib/cards.ts.
 * Run with: node --import tsx scripts/arena-card-matrix.ts
 *
 * Each case uses legal GameSession actions. Fixtures arrange one wounded
 * friendly fighter and one durable enemy so effects have a deterministic,
 * observable target; priority cases first queue enemy spells legally.
 */
import assert from 'node:assert/strict';
import {applyAction,createGame,mempoolOf} from '../lib/engine/engine';
import type {Action,CardDef,GameState,Minion} from '../lib/engine/types';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';
import {abilityCues} from '../components/presentation/abilityCues';
import {videoCues,VIDEO_IDS} from '../components/presentation/videoCue';
import {cardIdentity} from '../components/presentation/cardIdentity';
import roles from '../components/presentation/cardRoles.json';

const cardIds=Object.keys(CARDS).sort();
const findings:string[]=[];
const observedRoleAnimations=new Map<string,string>();
const covered:{cardId:string;phase:'play'|'queue'|'resolve';cueCount:number}[]=[];
const knownVideoIds=new Set<string>(VIDEO_IDS);
const semanticAnchors=new Set(['arena-center','row-0','row-1','gas-counter','hero-power','hero-0','hero-1']);

assert.equal(cardIds.length,43,'The catalog matrix expects all 43 current cards');

function minion(uid:string,cardId:string,overrides:Partial<Minion>={}):Minion{
  const card=CARDS[cardId];
  assert.ok(card&&card.type==='minion',`${cardId} must be a minion fixture`);
  const health=overrides.health??card.health??1;
  return {
    uid,cardId,name:card.name,attack:overrides.attack??card.attack??1,health,
    maxHealth:overrides.maxHealth??health,canAttack:false,staked:false,
    taunt:card.taunt??false,rush:card.rush??false,lifesteal:card.lifesteal??false,
    fresh:false,...overrides,
  };
}

function fixture(cardId:string,enemyHand:string[]=[]):GameState{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,90210);
  state.players[0].hand=[{uid:`matrix-own-${cardId}`,cardId}];
  state.players[1].hand=enemyHand.map((id,index)=>({uid:`matrix-enemy-${id}-${index}`,cardId:id}));
  state.players[0].gas=state.players[0].maxGas=10;
  state.players[1].gas=state.players[1].maxGas=10;
  state.players[0].treasury=20;
  state.players[1].treasury=20;
  state.players[0].board=[minion('matrix-friendly-witness','amm-centurion',{health:1,maxHealth:4})];
  state.players[1].board=[minion('matrix-enemy-witness','pixel-squire',{attack:1,health:10,maxHealth:10})];
  return state;
}

function validateCueTargets(batch:PresentationBatch,label:string):{ability:number;video:number}{
  const valid=new Set<string>(semanticAnchors);
  for(const state of [batch.before,batch.after]){
    state.players.forEach((player,owner)=>{
      valid.add(`hero-${owner}`);
      player.hand.forEach(card=>valid.add(card.uid));
      player.board.forEach(card=>valid.add(card.uid));
      mempoolOf(state,owner as 0|1).forEach(entry=>valid.add(`queued-${entry.uid}`));
    });
  }
  for(const cue of abilityCues(batch)){
    assert.ok(valid.has(cue.from),`${label}: ability source has unknown UID/anchor ${cue.from}`);
    assert.ok(valid.has(cue.to),`${label}: ability target has unknown UID/anchor ${cue.to}`);
  }
  for(const cue of videoCues(batch)){
    assert.ok(knownVideoIds.has(cue.id),`${label}: unknown video cue ID ${cue.id}`);
    assert.ok(valid.has(cue.anchor),`${label}: video target has unknown UID/anchor ${cue.anchor}`);
  }
  for(const result of batch.events?.effectResults??[]){
    for(const target of result.targets){
      assert.ok(valid.has(target.uid),`${label}: effect result has unknown target UID ${target.uid}`);
    }
  }
  return {ability:abilityCues(batch).length,video:videoCues(batch).length};
}

function dispatch(game:GameSession,cardId:string,phase:'play'|'queue'|'resolve',predicate:(action:Action)=>boolean):PresentationBatch{
  const before=game.snapshot().state;
  const action=game.legal().find(predicate);
  assert.ok(action,`${cardId}/${phase}: expected a legal action`);
  const expected=applyAction(before,action);
  const batch=game.dispatch(action);
  assert.ok(batch,`${cardId}/${phase}: GameSession dispatch returned no batch`);
  assert.deepEqual(batch.after,expected,`${cardId}/${phase}: session and engine results differ`);
  const cueCount=validateCueTargets(batch,`${cardId}/${phase}`);
  covered.push({cardId,phase,cueCount:cueCount.ability+cueCount.video});
  game.impact(batch.id);
  game.complete(batch.id);
  assert.equal(game.snapshot().shown,batch.after,`${cardId}/${phase}: settled session must show committed state`);
  assert.equal(game.snapshot().busy,false,`${cardId}/${phase}: input unlocks after completion`);
  return batch;
}

function endTurn(game:GameSession,label:string){
  return dispatch(game,label,'resolve',action=>action.type==='end-turn');
}

function seedEnemyQueue(game:GameSession,cardId:string,count:number){
  endTurn(game,`${cardId}/priority-pass-to-enemy`);
  const p1Hand=game.snapshot().state.players[1].hand;
  const high=p1Hand.find(card=>card.cardId==='rug-pull');
  assert.ok(high,`${cardId}: priority fixture must have RUG PULL ready`);
  dispatch(game,cardId,'queue',action=>action.type==='cast-spell'&&action.uid===high.uid);
  if(count>1){
    const low=game.snapshot().state.players[1].hand.find(card=>card.cardId==='flash-loan');
    assert.ok(low,`${cardId}: multi-counter fixture must have Flash Loan ready`);
    dispatch(game,cardId,'queue',action=>action.type==='cast-spell'&&action.uid===low.uid);
  }
  endTurn(game,`${cardId}/enemy-queues-priority-targets`);
}

function verifyBattlecry(card:CardDef,batch:PresentationBatch,newUid:string):void{
  const effect=card.battlecry;
  if(!effect)return;
  const before=batch.before.players[0],after=batch.after.players[0];
  const enemyBefore=batch.before.players[1],enemyAfter=batch.after.players[1];
  const amount=effect.amount??0;
  switch(effect.kind){
    case 'damage-all-enemy-minions':
      enemyBefore.board.forEach(target=>{
        const next=enemyAfter.board.find(minion=>minion.uid===target.uid);
        assert.equal(next?.health??0,Math.max(0,target.health-amount),`${card.id}: all-enemy battlecry damage must resolve`);
      });
      break;
    case 'damage-random-enemy':{
      const target=batch.events?.damages?.find(d=>enemyBefore.board.some(minion=>minion.uid===d.uid));
      assert.ok(target,`${card.id}: random-damage battlecry must report its actual enemy`);
      assert.equal(target.health,Math.max(0,target.prevHealth-amount));
      break;
    }
    case 'damage-enemy-treasury':
      assert.equal(enemyAfter.treasury,Math.max(0,enemyBefore.treasury-amount),`${card.id}: battlecry must damage enemy treasury`);
      break;
    case 'heal-treasury':
      assert.equal(after.treasury,Math.min(30,before.treasury+amount),`${card.id}: battlecry must heal its owner`);
      break;
    case 'draw':
      assert.equal(after.hand.length,before.hand.length-1+amount,`${card.id}: battlecry draw count`);
      assert.equal(after.deck.length,before.deck.length-amount,`${card.id}: battlecry must consume deck cards`);
      break;
    case 'gain-gas':
      assert.equal(after.gas,before.gas-card.cost+amount,`${card.id}: battlecry gain must be added after payment`);
      break;
    case 'buff-own':{
      const targetBefore=before.board.find(minion=>minion.uid==='matrix-friendly-witness');
      const targetAfter=after.board.find(minion=>minion.uid==='matrix-friendly-witness');
      assert.ok(targetBefore&&targetAfter,`${card.id}: friendly buff target must survive`);
      assert.equal(targetAfter.attack,targetBefore.attack+(effect.attack??0));
      assert.equal(targetAfter.health,targetBefore.health+(effect.health??0));
      assert.equal(targetAfter.maxHealth,targetBefore.maxHealth+(effect.health??0));
      const played=after.board.find(minion=>minion.uid===newUid);
      assert.ok(played,`${card.id}: played minion must survive its buff battlecry`);
      assert.equal(played.attack,(card.attack??0)+(effect.attack??0));
      assert.equal(played.maxHealth,(card.health??0)+(effect.health??0));
      break;
    }
    case 'summon':
      assert.ok(after.board.some(minion=>minion.cardId===effect.cardId&&minion.uid!==newUid),`${card.id}: battlecry summon must create ${effect.cardId}`);
      break;
    case 'counter-mempool':
      assert.ok(mempoolOf(batch.after,1).length<mempoolOf(batch.before,1).length,`${card.id}: counter battlecry must remove an enemy queued spell`);
      break;
    default:
      assert.fail(`${card.id}: matrix has no battlecry contract for ${effect.kind}`);
  }
}

function verifySpell(card:CardDef,cast:PresentationBatch,resolve:PresentationBatch,sourceUid:string):void{
  assert.equal(cast.events?.spellQueued?.cardId,card.id,`${card.id}: cast must enter the owner's queue`);
  assert.equal(cast.events?.spellQueued?.mempoolUid,sourceUid,`${card.id}: queue event must preserve its UID`);
  assert.equal(cast.after.players[0].gas,cast.before.players[0].gas-card.cost,`${card.id}: spell cost must be charged on cast`);
  const resolved=resolve.events?.spellResolved?.find(entry=>entry.mempoolUid===sourceUid);
  assert.ok(resolved,`${card.id}: its owner-turn must resolve the exact queued entry`);
  assert.equal(resolved.cardId,card.id);
  assert.equal(resolved.owner,0);
  assert.equal(resolved.fizzled,false,`${card.id}: fixture should provide its required targets`);

  const effect=card.spell;
  if(!effect)return;
  const friendlyBefore=resolve.before.players[0],friendlyAfter=resolve.after.players[0];
  const enemyBefore=resolve.before.players[1],enemyAfter=resolve.after.players[1];
  const amount=effect.amount??0;
  switch(effect.kind){
    case 'damage-all-enemy-minions':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: AOE must have a source-keyed effect result`);
      assert.equal(result.kind,effect.kind);
      assert.deepEqual(result.targets.map(target=>target.uid),enemyBefore.board.map(minion=>minion.uid));
      enemyBefore.board.forEach(target=>assert.equal(enemyAfter.board.find(m=>m.uid===target.uid)?.health??0,Math.max(0,target.health-amount)));
      break;
    }
    case 'damage-random-enemy':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: random damage must have a source-keyed effect result`);
      assert.equal(result.targets.length,1);
      const target=result.targets[0];
      assert.ok(enemyBefore.board.some(minion=>minion.uid===target.uid));
      assert.equal(target.healthAfter,Math.max(0,target.healthBefore-amount));
      break;
    }
    case 'damage-enemy-treasury':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: treasury damage must have a source-keyed effect result`);
      assert.deepEqual(result.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter,target.maxHealth]),[['hero-1',enemyBefore.treasury,Math.max(0,enemyBefore.treasury-amount),30]]);
      break;
    }
    case 'heal-treasury':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: treasury healing must have a source-keyed effect result`);
      assert.deepEqual(result.targets.map(target=>[target.uid,target.healthBefore,target.healthAfter,target.maxHealth]),[['hero-0',friendlyBefore.treasury,Math.min(30,friendlyBefore.treasury+amount),30]]);
      break;
    }
    case 'heal-own-minions':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: minion healing must have a source-keyed effect result`);
      assert.ok(result.targets.some(target=>target.uid==='matrix-friendly-witness'&&target.healthAfter>target.healthBefore));
      assert.equal(friendlyAfter.board.find(minion=>minion.uid==='matrix-friendly-witness')?.health,3);
      break;
    }
    case 'weaken-random-enemy':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: weakening must have a source-keyed effect result`);
      assert.equal(result.targets.length,1);
      const target=result.targets[0];
      assert.ok(enemyBefore.board.some(minion=>minion.uid===target.uid));
      assert.equal(target.attackAfter,Math.max(0,target.attackBefore-amount));
      break;
    }
    case 'buff-own':{
      const result=resolve.events?.effectResults?.find(entry=>entry.mempoolUid===sourceUid);
      assert.ok(result,`${card.id}: buff must have a source-keyed effect result`);
      assert.ok(result.targets.some(target=>target.uid==='matrix-friendly-witness'&&target.attackAfter>target.attackBefore));
      assert.equal(friendlyAfter.board.find(minion=>minion.uid==='matrix-friendly-witness')?.attack,3);
      break;
    }
    case 'draw':
      // Owner-turn completion also performs the normal turn draw after the
      // queued effect and refill, so the delta is spell amount + one card.
      assert.equal(friendlyAfter.hand.length,friendlyBefore.hand.length+amount+1,`${card.id}: queued draw plus normal turn draw`);
      assert.equal(friendlyAfter.deck.length,friendlyBefore.deck.length-amount-1,`${card.id}: queued draw and normal turn draw consume deck cards`);
      break;
    case 'gain-gas':{
      // Delayed order rewards survive the base/stake refill at this turn start.
      const staked=friendlyAfter.board.filter(minion=>minion.staked).length;
      assert.equal(friendlyAfter.gas,friendlyAfter.maxGas+staked+amount,`${card.id}: queued gas reward must remain above base refill`);
      break;
    }
    case 'rugpull':
      assert.equal(friendlyAfter.board.length,0);
      assert.equal(enemyAfter.board.length,0);
      assert.equal(resolve.events?.rugPull,true,`${card.id}: resolution must publish rug-pull event`);
      break;
    case 'counter-mempool':
      assert.ok(mempoolOf(resolve.before,1).length>mempoolOf(resolve.after,1).length,`${card.id}: counter spell must remove enemy queue entry`);
      break;
    case 'summon':
      assert.ok(friendlyAfter.board.some(minion=>minion.cardId===effect.cardId),`${card.id}: spell must summon ${effect.cardId}`);
      break;
    default:
      assert.fail(`${card.id}: matrix has no spell contract for ${effect.kind}`);
  }
}

function createSession(cardId:string,enemyCards:string[]=[]):GameSession{
  return new GameSession(fixture(cardId,enemyCards));
}

// Individual creature plays exercise their actual content and deployment role.
const minionCards=cardIds.filter(id=>CARDS[id].type==='minion');
const spellCards=cardIds.filter(id=>CARDS[id].type==='spell');
minionCards.forEach((cardId,index)=>{
  const card=CARDS[cardId];
  const priorityCount=cardId==='frontrun-bot'?2:card.priority?1:0;
  const enemyCards=priorityCount===2?['rug-pull','flash-loan']:priorityCount===1?['rug-pull']:[];
  const game=createSession(cardId,enemyCards);
  if(priorityCount)seedEnemyQueue(game,cardId,priorityCount);

  const batch=dispatch(game,cardId,'play',action=>action.type==='play-minion'&&action.uid===game.snapshot().state.players[0].hand[0].uid);
  assert.equal(batch.events?.play?.cardId,cardId,`${cardId}: actual play event must identify its card`);
  assert.equal(batch.events?.play?.fromHandUid,batch.before.players[0].hand[0].uid);
  const played=batch.after.players[0].board.find(minion=>!batch.before.players[0].board.some(old=>old.uid===minion.uid)&&minion.cardId===cardId);
  assert.ok(played,`${cardId}: must create its own fighter`);
  const gasGain=card.battlecry?.kind==='gain-gas'?(card.battlecry.amount??1):0;
  assert.equal(batch.after.players[0].gas,batch.before.players[0].gas-card.cost+gasGain,`${cardId}: pays its printed cost, then applies battlecry gas`);
  assert.equal(played.taunt,Boolean(card.taunt),`${cardId}: Taunt keyword must match content`);
  assert.equal(played.rush,Boolean(card.rush),`${cardId}: Rush keyword must match content`);
  assert.equal(played.lifesteal,Boolean(card.lifesteal),`${cardId}: Lifesteal keyword must match content`);
  verifyBattlecry(card,batch,played.uid);

  const identity=cardIdentity(cardId);
  assert.equal((roles as Record<string,string>)[cardId],identity.role,`${cardId}: explicit role metadata must reach identity`);
  const deploy=videoCues(batch);
  assert.ok(deploy.length>=1&&deploy.length<=2,`${cardId}: deployment and actual outcomes share at most two sprite layers`);
  assert.equal(deploy.filter(c=>c.id.startsWith('10-deploy')||c.id.startsWith('11-deploy')||c.id.startsWith('12-deploy')||c.id.startsWith('13-deploy')||c.id.startsWith('14-deploy')||c.id.startsWith('15-deploy')).length,1,`${cardId}: played minion must get exactly one deployment clip`);
  assert.equal(deploy[0].anchor,played.uid,`${cardId}: deployment clip must follow the summoned fighter`);
  if(observedRoleAnimations.has(identity.role))assert.equal(observedRoleAnimations.get(identity.role),deploy[0].id,`${identity.role}: all cards in a role share its deployment cue`);
  else observedRoleAnimations.set(identity.role,deploy[0].id);

  if(card.halvingPeriod){
    const beforeTick={attack:played.attack,health:played.health,maxHealth:played.maxHealth};
    const targetBlock=(Math.floor(batch.after.block/card.halvingPeriod)+1)*card.halvingPeriod;
    let tick:PresentationBatch|undefined;
    while(game.snapshot().state.block<targetBlock)tick=endTurn(game,`${cardId}/halving-tick`);
    const afterTick=game.snapshot().state.players[0].board.find(minion=>minion.uid===played.uid);
    assert.ok(tick?.events?.halvings?.some(event=>event.uid===played.uid),`${cardId}: passive tick must report its exact fighter UID`);
    assert.equal(afterTick?.attack,beforeTick.attack+1,`${cardId}: halving attack increment`);
    assert.equal(afterTick?.health,beforeTick.health+1,`${cardId}: halving health increment`);
    assert.equal(afterTick?.maxHealth,beforeTick.maxHealth+1,`${cardId}: halving max-health increment`);
  }
});

// Every decree must be cast, remain queued for the opposing turn, and resolve
// on its owner's next turn from the exact mempool UID.
spellCards.forEach((cardId,index)=>{
  const card=CARDS[cardId];
  const enemyCards=card.priority?['rug-pull']:[];
  const game=createSession(cardId,enemyCards);
  if(card.priority)seedEnemyQueue(game,cardId,1);

  const handUid=game.snapshot().state.players[0].hand[0].uid;
  const cast=dispatch(game,cardId,'queue',action=>action.type==='cast-spell'&&action.uid===handUid);
  assert.equal(cast.events?.spellQueued?.cardId,cardId);
  assert.equal(cast.after.players[0].board.find(minion=>minion.uid==='matrix-friendly-witness')?.health,1,`${cardId}: spell effect must not happen while queued`);
  const sourceUid=cast.events?.spellQueued?.mempoolUid;
  assert.ok(sourceUid,`${cardId}: queued event must provide source UID`);
  if(card.priority){
    assert.equal(cast.events?.spellCountered?.cardId,'rug-pull',`${cardId}: Priority removes the highest-cost enemy decree`);
    assert.equal(mempoolOf(cast.after,1).length,0);
  }
  endTurn(game,`${cardId}/wait-for-enemy-turn`);
  const resolve=endTurn(game,`${cardId}/owner-turn-resolution`);
  verifySpell(card,cast,resolve,sourceUid);
});

// Exercise priority minions against more than one pending spell. The result
// records actual engine behavior instead of assuming a one-counter event shape.
{
  const game=createSession('frontrun-bot',['rug-pull','flash-loan']);
  seedEnemyQueue(game,'frontrun-bot',2);
  const before=mempoolOf(game.snapshot().state,1);
  const play=dispatch(game,'frontrun-bot','play',action=>action.type==='play-minion');
  const after=mempoolOf(play.after,1);
  const removed=before.filter(entry=>!after.some(next=>next.uid===entry.uid));
  assert.ok(removed.length>=1,'Priority minion must counter at least the highest-cost pending decree');
  assert.equal(play.events?.spellCountered?.cardId,'rug-pull','Structured counter event must name the highest-cost decree');
  assert.deepEqual(play.events?.spellCounters?.map(counter=>counter.cardId),['rug-pull','flash-loan'],'All counter triggers must publish each removed decree in engine order');
  assert.deepEqual(play.events?.spellCounters?.map(counter=>counter.mempoolUid),removed.map(entry=>entry.uid),'Counter events must retain each exact removed mempool UID');
  assert.equal(play.events?.spellCountered?.mempoolUid,play.events?.spellCounters?.[0]?.mempoolUid,'Legacy singular counter must remain the first counter');
  const counterCues=abilityCues(play).filter(cue=>cue.kind==='counter'&&cue.phase==='after');
  const played=play.after.players[0].board.find(m=>m.cardId==='frontrun-bot'&&!play.before.players[0].board.some(old=>old.uid===m.uid));
  assert.ok(played);
  assert.ok(counterCues.every(cue=>cue.from===played.uid),'Each actual cancellation must originate at the played fighter');
  assert.deepEqual(counterCues.map(cue=>cue.to).sort(),removed.map(entry=>`queued-${entry.uid}`).sort(),'Counter feedback must target the exact removed UID');
}

const minionRoles=Array.from(new Set(minionCards.map(id=>cardIdentity(id).role)));
assert.equal(minionRoles.length,6,'The catalog must exercise six distinct fighter roles');
assert.equal(observedRoleAnimations.size,6,'Every fighter role must have a deployment clip');
const deploymentCueIds=Array.from(new Set(observedRoleAnimations.values()));
assert.equal(deploymentCueIds.length,6,'Six fighter roles must map to six distinct deployment clips');
assert.equal(spellCards.length+minionCards.length,43);
for(const id of cardIds){
  assert.equal(CARDS[id].id,id,`${id}: map key and CardDef ID must agree`);
  assert.ok(Object.prototype.hasOwnProperty.call(roles,id),`${id}: every catalog card needs an explicit role`);
  assert.ok(CARDS[id].cost>=0&&CARDS[id].cost<=10,`${id}: cost must fit the ten-order base budget`);
}

console.log(`ARENA CARD MATRIX: ${cardIds.length} cards (${minionCards.length} minions, ${spellCards.length} spells) dispatched legally through GameSession.`);
console.log(`ROLES: ${minionRoles.join(', ')}; deployment cue IDs: ${deploymentCueIds.join(', ')}.`);
console.log(`CHECKED: minion cost/battlecry/keywords/priority/halving where defined; spell queue UID/owner-turn resolution/effect result; all emitted video IDs and cue/result target UIDs.`);
if(findings.length){
  console.log('FINDINGS');
  findings.forEach(finding=>console.log(`  - ${finding}`));
  process.exitCode=1;
}else console.log('FINDINGS: none.');
console.log(`MATRIX COMPLETE: ${covered.length} legal card actions/transitions checked; output includes ${covered.reduce((sum,row)=>sum+row.cueCount,0)} ability/video cues validated.`);
