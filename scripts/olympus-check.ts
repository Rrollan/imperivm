import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {CARDS} from '../lib/cards';
import {DECKS} from '../lib/decks';
import {applyAction,createGame,legalActions,mempoolOf} from '../lib/engine/engine';
import {boardCapacity,ultimateProgress,ultimateReady} from '../lib/engine/tactics';
import {gameSnapshot} from '../lib/engine/network';
import {chooseAiAction} from '../lib/ai';
import {probeMatch} from '../lib/balance/simulation';
import {GameSession,type PresentationBatch} from '../components/presentation/GameSession';
import {directEffect} from '../components/presentation/directPlay';
import {battleFloats} from '../components/presentation/battleFloats';
import {abilityCues} from '../components/presentation/abilityCues';
import {drawPhase,publicPlayPhase} from '../components/presentation/motionSpec';
import type {GameState,Minion} from '../lib/engine/types';

const fighter=(uid:string,cardId='pixel-squire',extra:Partial<Minion>={}):Minion=>({uid,cardId,name:CARDS[cardId].name,attack:2,health:8,maxHealth:8,canAttack:true,staked:false,fresh:false,...extra});
function fixture(id:string):GameState{
 const s=createGame('builder',DECKS.builder,'degen',DECKS.degen,71);s.block=9;s.players.forEach(p=>{p.hand=[];p.board=[];p.gas=p.maxGas=10;});s.players[0].hand=[{uid:'test-card',cardId:id}];return s;
}
function play(s:GameState):PresentationBatch{
 const g=new GameSession(s),type=CARDS[s.players[0].hand[0].cardId].type==='minion'?'play-minion':'cast-spell';
 const b=g.dispatch({type,uid:s.players[0].hand[0].uid})!;assert.ok(b);g.impact(b.id);g.complete(b.id);return b;
}
{
 let s=fixture('pixel-squire');s.players[0].board=Array.from({length:5},(_,i)=>fighter(`b${i}`));
 assert.equal(boardCapacity(s.players[0]),5);assert.ok(!legalActions(s).some(a=>a.type==='play-minion'));assert.throws(()=>play(s));
 s.players[0].hand=[{uid:'test-card',cardId:'agora-expansion'}];const original=JSON.stringify(s),expanded=play(s);
 assert.equal(JSON.stringify(s),original);assert.equal(boardCapacity(expanded.after.players[0]),6);assert.equal(mempoolOf(expanded.after,0).length,0);
 assert.ok(abilityCues(expanded).some(c=>c.to==='row-0'));
 s=expanded.after;s.players[0].hand=[{uid:'sixth',cardId:'pixel-squire'}];assert.ok(legalActions(s).some(a=>a.type==='play-minion'));
 s=applyAction(s,{type:'play-minion',uid:'sixth'});assert.equal(s.players[0].board.length,6);
 for(let i=0;i<2;i++){s.players[0].gas=10;s.players[0].hand=[{uid:`expand${i}`,cardId:'agora-expansion'}];s=applyAction(s,{type:'cast-spell',uid:`expand${i}`});}
 assert.equal(boardCapacity(s.players[0]),7);assert.notEqual(chooseAiAction(s).type,'cast-spell');
}
{
 const s=fixture('minting-press');s.players[0].board=Array.from({length:4},(_,i)=>fighter(`b${i}`));
 const b=play(s);assert.equal(b.after.players[0].board.length,5,'Battlecry token cannot bypass capacity');
 s.players[0].boardCapacity=6;assert.equal(play(s).after.players[0].board.length,6);
}
for(const active of [false,true]){
 const s=fixture('zeus-liquidator');s.players[0].board=[fighter('stake-a','pixel-squire',{staked:true,arrivedBlock:7}),fighter('stake-b','amm-centurion',{staked:true,arrivedBlock:active?7:9})];s.players[1].board=[fighter('enemy')];
 assert.equal(ultimateReady(s,0,CARDS['zeus-liquidator']),active);const b=play(s);
 assert.equal(b.after.players[1].board[0].health,active?5:7);assert.equal(directEffect(b)?.targets[0].healthAfter,active?5:7);
 assert.ok(battleFloats(b).some(f=>f.anchor==='enemy'&&f.label===(active?'−3':'−1')));
 assert.equal(b.after.log.some(l=>l.includes('ultimate:')),active);
}
{
 let s=fixture('pixel-squire');s.players[0].board=[fighter('old','pixel-squire',{arrivedBlock:7})];
 s=applyAction(s,{type:'play-minion',uid:'test-card'});const uid=s.players[0].board[1].uid;
 s=applyAction(s,{type:'stake',uid});s=applyAction(s,{type:'unstake',uid});
 assert.equal(s.players[0].board[1].fresh,false,'Existing readiness rule remains intact');
 assert.equal(ultimateProgress(s,0,CARDS['athena-diamond-guard']),1,'Unstaking cannot fake survival');
 s=applyAction(s,{type:'end-turn'});s=applyAction(s,{type:'end-turn'});
 assert.equal(ultimateReady(s,0,CARDS['athena-diamond-guard']),true);
 s.players[0].board.pop();assert.equal(ultimateReady(s,0,CARDS['athena-diamond-guard']),false,'Opponent removal breaks the preparation');
}
{
 const s=fixture('athena-diamond-guard');s.players[0].board=[fighter('nft-a'),fighter('nft-b')];
 const b=play(s);assert.equal(b.after.players[0].board[0].attack,3);assert.equal(b.after.players[0].board[2].attack,4);
 assert.equal(directEffect(b)?.targets.length,3,'Buff includes its new fighter once');
 s.players[0].board.pop();assert.equal(play(s).after.players[0].board[0].attack,2,'Athena cannot count herself');
}
for(const count of [0,1,2]){
 const s=fixture('hades-rugkeeper');s.players[0].factionPlaysThisTurn={Meme:count};const b=play(s);
 assert.equal(b.after.players[1].treasury,count===2?26:29);
 assert.equal(ultimateProgress(b.before,0,CARDS['hades-rugkeeper']),count);
}
{
 const s=fixture('hermes-relayer');s.players[0].factionPlaysThisTurn={DePIN:1};const b=play(s);assert.equal(b.after.players[0].hand.length,2);
 s.players[0].factionPlaysThisTurn={};assert.equal(play(s).after.players[0].hand.length,1,'Hermes cannot count his own faction play');
 let next=applyAction(b.after,{type:'end-turn'});next=applyAction(next,{type:'end-turn'});assert.equal(ultimateProgress(next,0,CARDS['hermes-relayer']),0);
 const net=gameSnapshot(b.after,1,1000);assert.equal(net.players[0].hand,undefined);assert.equal(net.players[0].factionPlaysThisTurn?.DePIN,2);assert.equal(net.players[0].boardCapacity,5);assert.equal(net.players[0].board[0].arrivedBlock,9);
 assert.ok(!('deck' in net.players[0]));assert.ok(!('rngState' in net));
}
assert.deepEqual(drawPhase(0),{approach:0,landing:0,flip:0});assert.deepEqual(drawPhase(1),{approach:1,landing:1,flip:1});assert.equal(drawPhase(.48).landing,0);assert.equal(publicPlayPhase(.5).landing,0);
const matches=[];for(const a of Object.keys(DECKS))for(const b of Object.keys(DECKS))for(const seed of [21,375,2718,104729]){
 const result=probeMatch(a,DECKS[a],b,DECKS[b],seed);assert.notEqual(result.winner,null);matches.push({a,b,seed,...result});
}
const blocks=matches.map(m=>m.blocks).sort((a,b)=>a-b),report={scope:`${matches.length} deterministic greedy-AI matches; not human PvP balance or wall-clock duration`,medianBlocks:blocks[Math.floor(blocks.length/2)],minBlocks:blocks[0],maxBlocks:blocks.at(-1),matches};
writeFileSync('docs/research/olympus-simulation-20261007.json',JSON.stringify(report,null,2)+'\n');
console.log(`OLYMPUS OK: capacity, summon cap, immutable instant expansion, pre-play ultimates, unstake exploit, removal counterplay, same-turn faction setup, public metadata privacy, motion endpoints; ${matches.length} complete matches, median ${report.medianBlocks} blocks.`);
