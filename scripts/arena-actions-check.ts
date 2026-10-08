import {installDelayedSpellFixtures} from './delayed-spell-fixtures';
/**
 * Focused, headless coverage for every Action variant and its presentation cues.
 * Run with: node --import tsx scripts/arena-actions-check.ts
 *
 * Every dispatched action is selected from GameSession.legal(); fixtures only
 * arrange a small board/hand so each legal branch is reachable deterministically.
 */
import assert from 'node:assert/strict';
import {applyAction,createGame,mempoolOf} from '../lib/engine/engine';
import type {Action,GameState,Minion} from '../lib/engine/types';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {abilityCues} from '../components/presentation/abilityCues';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';
import {videoCues} from '../components/presentation/videoCue';
import registry from '../public/ui/arena-lab/fx/manifest.json';

const meleeImpact=Object.prototype.hasOwnProperty.call(registry.clips,'22-titan-cleave')?'22-titan-cleave':'01-impact';

const restoreDelayedFixtures=installDelayedSpellFixtures(['senate-censure', 'restoration-rite']);

const coverage:{type:Action['type'];label:string}[]=[];
const gaps:string[]=[];

function fighter(uid:string,cardId='amm-centurion',overrides:Partial<Minion>={}):Minion{
  const card=CARDS[cardId];
  assert.equal(card?.type,'minion',`${cardId} must be a minion fixture`);
  const health=overrides.health??card.health??1;
  return {
    uid,cardId,name:card.name,attack:overrides.attack??card.attack??1,
    health,maxHealth:overrides.maxHealth??health,canAttack:overrides.canAttack??true,
    staked:overrides.staked??false,taunt:card.taunt??false,rush:card.rush??false,
    lifesteal:card.lifesteal??false,fresh:false,...overrides,
  };
}

function fixture(
  hero='builder',
  hand:string[]=[],
  own:Minion[]=[],
  enemy:Minion[]=[],
  seed=731,
):GameState{
  const foe=hero==='degen'?'whale':'degen';
  const state=createGame(hero,DECKS[hero],foe,DECKS[foe],seed);
  state.players[0].hand=hand.map((cardId,index)=>({uid:`fixture-${cardId}-${index}`,cardId}));
  state.players[0].gas=state.players[0].maxGas=10;
  state.players[0].board=own;
  state.players[1].board=enemy;
  state.players[0].heroPowerUsed=false;
  return state;
}

function session(state:GameState){return new GameSession(state);}

function dispatch(
  game:GameSession,
  label:string,
  matches:(action:Action)=>boolean,
):PresentationBatch{
  const before=game.snapshot().state;
  const action=game.legal().find(matches);
  assert.ok(action,`${label}: action must be legal in this fixture`);
  const expected=applyAction(before,action);
  const batch=game.dispatch(action);
  assert.ok(batch,`${label}: GameSession must dispatch the legal action`);
  assert.deepEqual(batch.after,expected,`${label}: GameSession rules must match applyAction`);
  coverage.push({type:action.type,label});
  game.impact(batch.id);
  game.complete(batch.id);
  assert.equal(game.snapshot().shown,batch.after,`${label}: completed presentation must expose the resulting state`);
  assert.equal(game.snapshot().busy,false,`${label}: completed transition must release input`);
  return batch;
}

function actionType(type:Action['type']):(action:Action)=>boolean{
  return action=>action.type===type;
}

function cues(batch:PresentationBatch){return {native:abilityCues(batch),video:videoCues(batch)};}
function cueIds(batch:PresentationBatch){return videoCues(batch).map(({id,anchor})=>({id,anchor}));}
function noCues(batch:PresentationBatch,label:string){
  assert.deepEqual(abilityCues(batch),[],`${label}: no native effect cue expected`);
  assert.deepEqual(videoCues(batch),[],`${label}: no video effect cue expected`);
}

function passTurn(game:GameSession,label:string){
  return dispatch(game, label, actionType('end-turn'));
}

// play-minion: a real battlecry damages exactly one enemy while deployment
// video remains anchored to the newly played minister.
{
  const state=fixture('builder',['liquidation-officer'],[],[fighter('battlecry-target','pixel-squire',{health:4,maxHealth:4})]);
  const game=session(state);
  const batch=dispatch(game,'play-minion with random-damage battlecry',action=>action.type==='play-minion'&&action.uid===state.players[0].hand[0].uid);
  const played=batch.after.players[0].board.find(minion=>minion.cardId==='liquidation-officer');
  assert.ok(played,'The minion must enter its owner board');
  assert.equal(batch.events?.play?.cardId,'liquidation-officer');
  assert.equal(batch.events?.damages?.find(d=>d.uid==='battlecry-target')?.health,3,'Battlecry damage must appear in the real event diff');
  assert.deepEqual(cueIds(batch),[{id:'30-mosaic-landing',anchor:played.uid},{id:'07-spell-impact',anchor:'battlecry-target'}]);
  assert.deepEqual(abilityCues(batch).map(c=>[c.kind,c.from,c.to]),[['steel',played.uid,'battlecry-target']]);
  assert.equal(abilityCues(batch)[0].phase,'after','The source must land before its Battlecry feedback');
  assert.equal(abilityCues(batch).some(c=>c.kind==='heal'),false,'A non-healing battlecry must not emit a heal cue');
}

// attack against a fighter and the opposing ruler use legal targets and exact
// event/video anchors; ordinary attacks must not imply spell or healing FX.
{
  const state=fixture('builder',[],[fighter('attacker','amm-centurion',{attack:2,health:4,maxHealth:4})],[fighter('defender','pixel-squire',{attack:1,health:4,maxHealth:4})]);
  const game=session(state);
  const batch=dispatch(game,'attack enemy fighter',action=>action.type==='attack'&&action.target==='defender');
  assert.equal(batch.events?.attack?.targetUid,'defender');
  assert.equal(batch.events?.damages?.find(d=>d.uid==='defender')?.health,2);
  assert.deepEqual(cueIds(batch),[{id:meleeImpact,anchor:'defender'}]);
  assert.deepEqual(abilityCues(batch),[],'A regular trade has no extra ability accent');
}
{
  const state=fixture('builder',[],[fighter('face-attacker','amm-centurion',{attack:2,health:4,maxHealth:4})]);
  const game=session(state);
  const batch=dispatch(game,'attack enemy ruler',action=>action.type==='attack'&&action.target==='hero');
  assert.equal(batch.events?.attack?.targetUid,'hero');
  assert.equal(batch.after.players[1].treasury,batch.before.players[1].treasury-2);
  assert.deepEqual(cueIds(batch),[{id:meleeImpact,anchor:'hero-1'}]);
  assert.deepEqual(abilityCues(batch),[],'A regular face attack must not imply lifesteal');
}

// All four hero powers: each state transition is real and each cue matches its
// actual target/owner. The capped-heal probe below records a confirmed gap.
{
  const state=fixture('builder');state.players[0].gas=5;state.players[0].maxGas=5;state.players[0].treasury=20;
  const batch=dispatch(session(state),'Builder heal-treasury power',actionType('hero-power'));
  assert.equal(batch.after.players[0].treasury,23);
  assert.deepEqual(cueIds(batch),[{id:'02-builder-heal',anchor:'hero-0'}]);
  assert.deepEqual(abilityCues(batch).map(c=>[c.kind,c.to]),[['heal','hero-0']]);
}
{
  const state=fixture('whale',[],[],[fighter('whale-target','pixel-squire',{health:4,maxHealth:4})]);
  state.players[0].gas=5;state.players[0].maxGas=5;
  const batch=dispatch(session(state),'Whale damage power',actionType('hero-power'));
  assert.equal(batch.after.players[1].board[0].health,2);
  assert.deepEqual(cueIds(batch),[{id:'03-whale-impact',anchor:'whale-target'}]);
  assert.deepEqual(abilityCues(batch).map(c=>[c.kind,c.to]),[['steel','whale-target']]);
}
{
  const state=fixture('degen');state.players[0].gas=5;state.players[0].maxGas=5;state.players[0].treasury=20;
  const handBefore=state.players[0].hand.length;
  const batch=dispatch(session(state),'Degen draw-burn power',actionType('hero-power'));
  assert.equal(batch.after.players[0].treasury,18);
  assert.equal(batch.after.players[0].hand.length,handBefore+1);
  assert.deepEqual(cueIds(batch),[{id:'04-degen-draw',anchor:'hero-0'}]);
  assert.deepEqual(abilityCues(batch).map(c=>[c.kind,c.to]),[['dice','hero-0']]);
}
{
  const state=fixture('validator');state.players[0].gas=3;state.players[0].maxGas=5;
  const batch=dispatch(session(state),'Validator gain-orders power',actionType('hero-power'));
  assert.equal(batch.after.players[0].gas,3,'Power cost 2 and gain 2 both apply');
  assert.deepEqual(cueIds(batch),[{id:'05-validator-gas',anchor:'gas-counter'}]);
  assert.deepEqual(abilityCues(batch).map(c=>[c.kind,c.to]),[['seal','gas-counter']]);
}
{
  const state=fixture('builder');state.players[0].gas=5;state.players[0].maxGas=5;state.players[0].treasury=30;
  const batch=dispatch(session(state),'Builder power at treasury cap (no-op probe)',actionType('hero-power'));
  assert.equal(batch.after.players[0].treasury,30,'Capped healing makes no state change');
  const observed=cues(batch);
  if(observed.native.some(c=>c.kind==='heal')||observed.video.some(c=>c.id==='02-builder-heal')){
    gaps.push('Builder power at 30 treasury still emits heal cues although the capped action restores 0. BattleEvents has no treasury-delta field to let the cue adapter distinguish this no-op.');
  }
}

// cast-spell is delayed: casting only queues it and produces no effect cue;
// the owner-turn resolution reports the exact debuff target through both cue
// systems. A full ally and a zero-attack target exercise no-op filtering.
{
  const state=fixture('builder',['delayed-fixture-senate-censure'],[],[
    fighter('weaken-target','pixel-squire',{attack:2,health:4,maxHealth:4}),
  ]);
  const game=session(state);
  const cast=dispatch(game,'cast delayed weaken edict',action=>action.type==='cast-spell');
  assert.equal(cast.events?.spellQueued?.cardId,'delayed-fixture-senate-censure');
  assert.equal(mempoolOf(cast.after,0).length,1);
  noCues(cast,'a queued edict must not show its resolution effect early');
  passTurn(game,'end turn before enemy response');
  const resolve=passTurn(game,'owner turn resolves weaken edict');
  const result=resolve.events?.effectResults?.[0];
  assert.equal(result?.targets[0]?.uid,'weaken-target');
  assert.equal(result?.targets[0]?.attackAfter,1);
  assert.deepEqual(abilityCues(resolve).map(c=>[c.kind,c.from,c.to]),[['weaken',`queued-${result?.mempoolUid}`,'weaken-target']]);
  assert.deepEqual(cueIds(resolve),[{id:'16-edict-weaken',anchor:'weaken-target'}]);
}
{
  const state=fixture('builder',['delayed-fixture-senate-censure'],[],[
    fighter('passive-ape','ape-praetorian',{attack:2,health:3,maxHealth:3}),
  ]);
  const game=session(state);
  dispatch(game,'queue weaken before Ape halving',action=>action.type==='cast-spell');
  passTurn(game,'Ape waits through enemy turn');
  const resolve=passTurn(game,'weaken offsets Ape halving attack');
  assert.deepEqual(resolve.events?.effectResults?.[0]?.targets.map(target=>[target.uid,target.attackBefore,target.attackAfter]),[['passive-ape',2,1]],'The exact weaken delta must survive even when later halving restores final attack');
  assert.equal(resolve.after.players[1].board[0].attack,2);
  assert.equal(resolve.after.players[1].board[0].health,4);
  if(!resolve.events?.halvings?.some(event=>event.uid==='passive-ape')){
    gaps.push('The debuff correctly records Ape Praetorian before halving, but the final +1/+1 offsets attack loss and the passive halving event has no UID.');
  }
}
{
  const state=fixture('builder',['delayed-fixture-restoration-rite'],[
    fighter('wounded-ally','amm-centurion',{health:1,maxHealth:4}),
    fighter('full-ally','pixel-squire',{health:1,maxHealth:1}),
  ],[fighter('enemy-unhealed','pixel-squire',{health:1,maxHealth:1})]);
  const game=session(state);
  const cast=dispatch(game,'cast delayed healing edict',action=>action.type==='cast-spell');
  noCues(cast,'healing must not animate on cast');
  passTurn(game,'healing edict waits through enemy turn');
  const resolve=passTurn(game,'healing edict resolves');
  assert.deepEqual(resolve.events?.effectResults?.[0]?.targets.map(target=>target.uid),['wounded-ally']);
  assert.deepEqual(abilityCues(resolve).filter(c=>c.kind==='heal').map(c=>c.to),['wounded-ally'],'Full allies and enemies must not receive false healing cues');
  assert.deepEqual(cueIds(resolve),[{id:'17-edict-heal',anchor:'wounded-ally'}]);
}
{
  const state=fixture('builder',['delayed-fixture-senate-censure'],[],[fighter('zero-attack','pixel-squire',{attack:0})]);
  const game=session(state);
  dispatch(game,'queue no-op weaken',action=>action.type==='cast-spell');
  passTurn(game,'pass before no-op weaken');
  const resolve=passTurn(game,'resolve no-op weaken');
  assert.equal(resolve.events?.effectResults?.[0]?.targets[0]?.uid,'zero-attack','The selected no-op target remains auditable');
  assert.equal(abilityCues(resolve).some(c=>c.kind==='weaken'),false,'A zero-to-zero attack result must not show a debuff');
  assert.equal(videoCues(resolve).some(c=>c.id==='16-edict-weaken'),false,'A zero-to-zero attack result must not show a debuff clip');
}

// A no-target buff is another confirmed no-op cue gap: Audit resolves with no
// minions, but both adapters currently animate a row-wide buff anyway.
{
  const state=fixture('builder',['audit']);
  const game=session(state);
  dispatch(game,'queue Audit buff spell',action=>action.type==='cast-spell');
  passTurn(game,'pass before empty-board Audit');
  const resolve=passTurn(game,'resolve Audit with empty board');
  assert.equal(resolve.after.players[0].board.length,0);
  assert.equal(resolve.events?.spellResolved?.[0]?.cardId,'audit');
  if(abilityCues(resolve).some(c=>c.kind==='buff')||videoCues(resolve).some(c=>c.id==='08-spell-buff')){
    gaps.push('Audit on an empty friendly board still emits a row-buff accent and video clip although no minion changes.');
  }
}

// stake and unstake are both legal state transitions and show only a self
// seal accent; neither should receive a combat clip.
{
  const state=fixture('builder',[],[fighter('staker','lending-legionnaire')]);
  const game=session(state);
  const stake=dispatch(game,'stake fighter',action=>action.type==='stake'&&action.uid==='staker');
  assert.equal(stake.after.players[0].board[0].staked,true);
  assert.deepEqual(abilityCues(stake).map(c=>[c.kind,c.from,c.to]),[['seal','staker','staker']]);
  assert.deepEqual(videoCues(stake),[]);
  const unstake=dispatch(game,'unstake fighter',action=>action.type==='unstake'&&action.uid==='staker');
  assert.equal(unstake.after.players[0].board[0].staked,false);
  assert.deepEqual(abilityCues(unstake).map(c=>[c.kind,c.from,c.to]),[['seal','staker','staker']]);
  assert.deepEqual(videoCues(unstake),[]);
}

// end-turn with no pending effect changes the active player and must not
// invent any targeting cue.
{
  const game=session(fixture('builder'));
  const end=passTurn(game,'end turn with empty presentation effects');
  assert.equal(end.after.turn,1);
  noCues(end,'plain end-turn');
}

// Mulligan keep and swap (including P1's completion path) are legal session
// transitions and should not be mistaken for card-play/effect VFX.
function mulliganGame(seed:number){
  return session(createGame('builder',DECKS.builder,'degen',DECKS.degen,{enableMulligan:true},seed));
}
{
  const game=mulliganGame(91);
  const handCount=game.snapshot().state.players[0].hand.length;
  const keep=dispatch(game,'P0 mulligan keep',action=>action.type==='mulligan'&&action.uids.length===0);
  assert.equal(keep.after.players[0].hand.length,handCount);
  noCues(keep,'mulligan keep');
}
{
  const game=mulliganGame(92);
  const before=game.snapshot().state;
  const chosen=before.players[0].hand[0].uid;
  const swap=dispatch(game,'P0 mulligan swap',action=>action.type==='mulligan'&&action.uids.length===1&&action.uids[0]===chosen);
  assert.equal(swap.after.players[0].hand.length,before.players[0].hand.length);
  assert.equal(swap.after.players[0].deck.length,before.players[0].deck.length);
  noCues(swap,'mulligan swap');
}
{
  const game=mulliganGame(93);
  dispatch(game,'P0 keeps before P1 mulligan',action=>action.type==='mulligan'&&action.uids.length===0);
  passTurn(game,'enter P1 mulligan window');
  const before=game.snapshot().state;
  const chosen=before.players[1].hand[0].uid;
  const swap=dispatch(game,'P1 mulligan swap closes opening window',action=>action.type==='mulligan'&&action.uids.length===1&&action.uids[0]===chosen);
  assert.equal(swap.after.turn,1);
  assert.equal(swap.after.block,2);
  assert.equal(swap.after.players[1].hand.length,before.players[1].hand.length+1,'P1 swap closes the window and performs the normal start-turn draw');
  noCues(swap,'P1 mulligan swap');
}

const required:Action['type'][]=['play-minion','cast-spell','attack','hero-power','stake','unstake','end-turn','mulligan'];
const coveredTypes=Array.from(new Set(coverage.map(item=>item.type)));
assert.deepEqual(new Set(coveredTypes),new Set(required),'Every Action variant must be exercised through a legal GameSession dispatch');
assert.equal(coverage.filter(item=>item.type==='hero-power').length,5,'The four powers plus the capped-heal no-op probe must run');
assert.ok(coverage.some(item=>item.label==='attack enemy fighter')&&coverage.some(item=>item.label==='attack enemy ruler'));
assert.ok(coverage.some(item=>item.label==='P0 mulligan keep')&&coverage.some(item=>item.label==='P0 mulligan swap'));
assert.ok(coverage.some(item=>item.label==='P1 mulligan swap closes opening window'));

console.log('ARENA ACTION COVERAGE');
for(const type of required){
  const rows=coverage.filter(item=>item.type===type);
  console.log(`  ${type}: ${rows.length} — ${rows.map(row=>row.label).join('; ')}`);
}
console.log('CUE CHECKS: exact targets for battlecry, both attack targets, all four hero powers, delayed heal/weaken; no early cast, no-op weaken, stake, unstake, plain turn, or mulligan cues.');
if(gaps.length){
  console.log('OPEN PRESENTATION GAPS');
  gaps.forEach(gap=>console.log(`  - ${gap}`));
  process.exitCode=1;
}else console.log('OPEN PRESENTATION GAPS: none observed in the probed paths.');
console.log('LIMITS: fixtures use one enemy for random targeting; this verifies the legal target/event contract but not seed distribution, Babylon rendering, asset playback, or every card/effect combination.');
console.log(`ARENA ACTION AUDIT ${gaps.length?'FOUND GAPS':'PASSED'}: ${coverage.length} legal GameSession transitions checked.`);

restoreDelayedFixtures();
