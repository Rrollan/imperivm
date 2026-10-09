/** Engine-level acceptance checks for the fifty playable Agora characters.
 * Run: node --import tsx scripts/character-expansion-check.ts
 * Add --report to refresh the measured starter-deck probe in the handoff doc.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {CARDS} from '../lib/cards';
import {CHARACTER_CARDS} from '../lib/characterCards';
import {cardArtPath} from '../lib/cardArt';
import {DECKS} from '../lib/decks';
import {applyAction,createGame,legalActions,mempoolOf} from '../lib/engine/engine';
import {boardCapacity,ultimateReady} from '../lib/engine/tactics';
import {chooseProbeAction,type ProbePolicy} from '../lib/balance/simulation';
import type {Action,CardDef,EffectDef,Faction,GameState,Minion,PlayerId} from '../lib/engine/types';

const ids=Object.keys(CHARACTER_CARDS);
const heroes=Object.keys(DECKS);
const originalCards=Object.fromEntries(Object.entries(CARDS).filter(([id])=>!ids.includes(id)));
assert.equal(ids.length,50);
assert.equal(Object.keys(originalCards).length,49);
assert.equal(createHash('sha256').update(JSON.stringify(originalCards)).digest('hex'),'b0bab08927d110522559333733de5af119a0a20e690aa1453363bb0c2592e162','The original 49 definitions must remain unchanged');
assert.equal(new Set(ids).size,50);

const factionHero:Record<Faction,string>={DeFi:'whale',NFT:'builder',DePIN:'validator',Meme:'degen'};
const mainDeckCards=new Set(Object.values(DECKS).flat());
for(const id of ['hermes-relayer','athena-diamond-guard','zeus-liquidator','hades-rugkeeper','agora-expansion','diamond-aegis','senate-censure','restoration-rite','flash-loan','trait-reroll','solar-sapper']){
  assert.ok(mainDeckCards.has(id),`${id}: original Olympus payoff or tactical spell remains in a main deck`);
}
for(const hero of heroes){
  const deck=DECKS[hero];assert.equal(deck.length,30,`${hero}: thirty cards`);
  const count=new Map<string,number>();
  for(const id of deck){assert.ok(CARDS[id],`${hero}: known card ${id}`);count.set(id,(count.get(id)??0)+1);}
  count.forEach((copies,id)=>assert.ok(copies<=(CARDS[id].rarity==='legendary'?1:2),`${hero}: copy limit for ${id}`));
  assert.ok(deck.filter(id=>CARDS[id].cost<=3).length>=16,`${hero}: enough affordable opening plays`);
  assert.ok(deck.filter(id=>CARDS[id].cost>=7).length<=4,`${hero}: finishers cannot flood the starting hand`);
}
for(const id of ids){
  const card=CARDS[id];assert.deepEqual(card,CHARACTER_CARDS[id]);
  assert.ok(DECKS[factionHero[card.faction]].includes(id),`${id}: included in its main faction deck`);
  assert.deepEqual(readFileSync(`public/cards/${id}.webp`),readFileSync(`public${cardArtPath(id)}`),`${id}: protected legacy CardView receives the exact approved artwork`);
  assert.ok(existsSync(`public${cardArtPath(id)}`),`${id}: the actual card-art route exists`);
  assert.equal(card.type,'minion');
  assert.ok(Number.isInteger(card.cost)&&card.cost>=1&&card.cost<=8,`${id}: cost within the intended curve`);
  assert.ok(Number.isInteger(card.attack)&&card.attack!>=0&&Number.isInteger(card.health)&&card.health!>0,`${id}: valid fighter stats`);
  assert.ok(card.battlecry||card.ultimate||card.taunt||card.rush||card.lifesteal||card.priority||card.halvingPeriod,`${id}: a real rule rather than decorative flavor alone`);
}

function fighter(uid:string,cardId:string,changes:Partial<Minion>={}):Minion{
  return {uid,cardId,name:CARDS[cardId].name,attack:3,health:3,maxHealth:10,canAttack:false,staked:false,fresh:false,arrivedBlock:9,...changes};
}
function fixture(card:CardDef,active=false,almost=false):GameState{
  const state=createGame('builder',DECKS.builder,'degen',DECKS.degen,1973);
  state.block=9;
  for(const player of state.players){player.hand=[];player.board=[];player.gas=player.maxGas=10;player.treasury=15;player.deck=Array(25).fill('pixel-squire');player.factionPlaysThisTurn={};player.pavilionBonuses=[];}
  state.players[0].hand=[{uid:'character-under-test',cardId:card.id}];
  state.players[0].board=[fighter('friendly-witness',card.id)];
  state.players[1].board=[fighter('enemy-witness','pixel-squire',{attack:6,health:20,maxHealth:20})];
  const ultimate=card.ultimate;
  if(ultimate&&(active||almost)){
    const count=active?ultimate.count:Math.max(0,ultimate.count-1);
    if(ultimate.condition==='faction-plays'){
      const faction=ultimate.faction??card.faction;
      state.players[0].factionPlaysThisTurn={[faction]:count};
      if(count>=2)state.players[0].pavilionBonuses=[faction];
    }else{
      const faction=ultimate.faction??card.faction;
      const ally=Object.values(CHARACTER_CARDS).find(candidate=>candidate.faction===faction)!;
      state.players[0].board=Array.from({length:count},(_,index)=>fighter(`prepared-${index}`,ally.id,{arrivedBlock:7,staked:ultimate.condition==='staked'}));
    }
  }
  if(card.priority||card.battlecry?.kind==='counter-mempool'||card.ultimate?.effect.kind==='counter-mempool'){
    mempoolOf(state,1).push({uid:'queued-high',cardId:'rug-pull',name:CARDS['rug-pull'].name,owner:1},{uid:'queued-low',cardId:'priority-fee',name:CARDS['priority-fee'].name,owner:1});
  }
  return state;
}

function assertEffect(card:CardDef,before:GameState,after:GameState,effect:EffectDef|undefined):void{
  const me=before.players[0],next=after.players[0],foe=before.players[1],enemy=after.players[1];
  const priorPlays=me.factionPlaysThisTurn?.[card.faction]??0;
  const refund=priorPlays>=1&&!me.pavilionBonuses?.includes(card.faction)?1:0;
  assert.equal(next.gas,me.gas-card.cost+refund+(effect?.kind==='gain-gas'?(effect.amount??1):0),`${card.id}: exact payment, existing faction rebate and resource reward`);
  assert.equal(next.hand.some(hand=>hand.uid==='character-under-test'),false,`${card.id}: card leaves the hand`);
  const arrived=next.board.find(minion=>!me.board.some(previous=>previous.uid===minion.uid)&&minion.cardId===card.id);
  assert.ok(arrived,`${card.id}: its original card becomes a board fighter`);
  assert.equal(arrived.taunt??false,card.taunt??false);
  assert.equal(arrived.rush??false,card.rush??false);
  assert.equal(arrived.lifesteal??false,card.lifesteal??false);
  assert.equal(arrived.fresh,true);
  assert.equal(arrived.canAttack,card.rush??false);
  if(card.rush){
    assert.ok(!legalActions(after).some(action=>action.type==='attack'&&action.attackerUid===arrived.uid&&action.target==='hero'),`${card.id}: Rush cannot hit a ruler on arrival`);
  }
  const counterCount=(card.priority?1:0)+(effect?.kind==='counter-mempool'?1:0);
  assert.equal(mempoolOf(after,1).length,Math.max(0,mempoolOf(before,1).length-counterCount),`${card.id}: counter removes existing enemy orders`);
  if(!effect)return;
  const amount=effect.amount??0;
  switch(effect.kind){
    case 'damage-random-enemy':
    case 'damage-all-enemy-minions':
      assert.equal(enemy.board[0].health,foe.board[0].health-amount,`${card.id}: actual enemy receives the damage`);break;
    case 'damage-enemy-treasury':
      assert.equal(enemy.treasury,foe.treasury-amount);break;
    case 'heal-treasury':
      assert.equal(next.treasury,Math.min(30,me.treasury+amount));break;
    case 'weaken-random-enemy':
      assert.equal(enemy.board[0].attack,Math.max(0,foe.board[0].attack-amount));assert.equal(enemy.board[0].health,foe.board[0].health);break;
    case 'heal-own-minions':
      me.board.forEach(target=>assert.equal(next.board.find(minion=>minion.uid===target.uid)?.health,Math.min(target.maxHealth,target.health+amount)));
      assert.equal(arrived.health,card.health);break;
    case 'draw':
      assert.equal(next.hand.length,me.hand.length-1+amount);assert.equal(next.deck.length,me.deck.length-amount);break;
    case 'buff-own':
      me.board.forEach(target=>{
        const changed=next.board.find(minion=>minion.uid===target.uid)!;
        assert.equal(changed.attack,target.attack+(effect.attack??0));assert.equal(changed.health,target.health+(effect.health??0));assert.equal(changed.maxHealth,target.maxHealth+(effect.health??0));
      });
      assert.equal(arrived.attack,card.attack!+(effect.attack??0));assert.equal(arrived.health,card.health!+(effect.health??0));break;
    case 'summon':{
      const token=next.board.find(minion=>minion.cardId===effect.cardId&&minion.uid!==arrived.uid&&!me.board.some(previous=>previous.uid===minion.uid));
      assert.ok(token,`${card.id}: summoned helper has its own identity`);assert.equal(token.attack,CARDS[effect.cardId!].attack);assert.equal(next.board.length,me.board.length+2);break;
    }
    case 'expand-board':
      assert.equal(boardCapacity(next),Math.min(7,boardCapacity(me)+amount));break;
    case 'gain-gas':
    case 'counter-mempool':break; // exact resource / order deltas checked above
    default:assert.fail(`${card.id}: expansion effect ${effect.kind} needs an explicit outcome contract`);
  }
}

let transitions=0,conditionalCases=0;
for(const card of Object.values(CHARACTER_CARDS)){
  const cases=card.ultimate?['inactive','almost','active'] as const:['inactive'] as const;
  for(const branch of cases){
    const state=fixture(card,branch==='active',branch==='almost');
    assert.equal(ultimateReady(state,0,card),branch==='active');
    const initial=JSON.stringify(state),action:Action={type:'play-minion',uid:'character-under-test'};
    assert.ok(legalActions(state).some(legal=>JSON.stringify(legal)===JSON.stringify(action)));
    const after=applyAction(state,action);transitions++;
    assert.equal(JSON.stringify(state),initial,`${card.id}/${branch}: source state stays immutable`);
    assert.equal(after.log.some(entry=>entry.includes('ultimate:')),branch==='active',`${card.id}: an arrival cannot satisfy its own preparation`);
    assertEffect(card,state,after,branch==='active'?card.ultimate!.effect:card.battlecry);
    assert.ok(after.players.every(player=>player.board.length<=boardCapacity(player)&&player.board.length<=7));
    if(card.ultimate)conditionalCases++;
  }
  const poor=fixture(card);poor.players[0].gas=card.cost-1;
  assert.ok(!legalActions(poor).some(action=>action.type==='play-minion'&&action.uid==='character-under-test'),`${card.id}: insufficient orders cannot be spent`);
  assert.throws(()=>applyAction(poor,{type:'play-minion',uid:'character-under-test'}));
  const full=fixture(card);full.players[0].board=Array.from({length:5},(_,index)=>fighter(`full-${index}`,card.id));
  assert.ok(!legalActions(full).some(action=>action.type==='play-minion'&&action.uid==='character-under-test'),`${card.id}: even an expansion fighter needs a free place to arrive`);
  if(card.halvingPeriod){
    const growth=fixture(card);growth.block=card.halvingPeriod*2-1;
    const placed=applyAction(growth,{type:'play-minion',uid:'character-under-test'});
    const newcomer=placed.players[0].board.find(minion=>!growth.players[0].board.some(old=>old.uid===minion.uid))!;
    const tick=applyAction(placed,{type:'end-turn'}),grown=tick.players[0].board.find(minion=>minion.uid===newcomer.uid)!;
    assert.equal(grown.attack,newcomer.attack+1);assert.equal(grown.health,newcomer.health+1);assert.equal(grown.maxHealth,newcomer.maxHealth+1);transitions+=2;
  }
  for(const effect of [card.battlecry,card.ultimate?.effect])if(effect?.kind==='summon'){
    const crowded=fixture(card,effect===card.ultimate?.effect);crowded.players[0].boardCapacity=7;
    while(crowded.players[0].board.length<6)crowded.players[0].board.push(fighter(`crowded-${crowded.players[0].board.length}`,card.id));
    const after=applyAction(crowded,{type:'play-minion',uid:'character-under-test'});
    assert.equal(after.players[0].board.length,7,`${card.id}: summon cannot make an eighth fighter`);transitions++;
  }
}

interface Sample {a:string;b:string;seed:number;policy:ProbePolicy;winner:PlayerId|'draw';blocks:number;actions:number;ultimates:number;reservePurchases:number}
const samples:Sample[]=[];
const seeds=Array.from({length:24},(_,index)=>104729+index*7919);
for(const a of heroes)for(const b of heroes){
  if(a===b)continue;
  for(const seed of seeds){
    const policy:ProbePolicy=seed%2?'greedy':'pressure';
    let state=createGame(a,DECKS[a],b,DECKS[b],{enableMulligan:true},seed),actions=0,ultimates=0,reservePurchases=0;
    const seen=new Set<string>();
    while(state.winner===null&&actions<2000){
      const serialized=JSON.stringify(state),key=createHash('sha256').update(serialized).digest('hex');
      assert.ok(!seen.has(key),`${a}/${b}/${seed}: action policy must not loop within a state`);seen.add(key);
      const action=chooseProbeAction(state,policy);
      assert.ok(legalActions(state).some(legal=>JSON.stringify(legal)===JSON.stringify(action)),`${a}/${b}: policy only chooses legal actions`);
      const after=applyAction(state,action);
      assert.equal(JSON.stringify(state),serialized,`${a}/${b}: full-match action is immutable`);
      assert.ok(after.players.every(player=>player.hand.length<=10&&player.board.length<=boardCapacity(player)&&player.board.length<=7));
      if(action.type==='play-minion'&&ultimateReady(state,state.turn,CARDS[state.players[state.turn].hand.find(hand=>hand.uid===action.uid)!.cardId]))ultimates++;
      if(action.type==='buy-card')reservePurchases++;
      state=after;actions++;
    }
    assert.notEqual(state.winner,null,`${a}/${b}/${seed}: a full match must finish within 2,000 transitions`);
    samples.push({a,b,seed,policy,winner:state.winner!,blocks:state.block,actions,ultimates,reservePurchases});
  }
}
function rate(wins:number,count:number){return Math.round(wins/count*1000)/10;}
const measured=heroes.map(hero=>{
  const first=samples.filter(sample=>sample.a===hero),second=samples.filter(sample=>sample.b===hero);
  const firstWins=first.filter(sample=>sample.winner===0).length,secondWins=second.filter(sample=>sample.winner===1).length;
  const count=first.length+second.length,wins=firstWins+secondWins;
  return {hero,matches:count,wins,winRate:rate(wins,count),firstWinRate:rate(firstWins,first.length),secondWinRate:rate(secondWins,second.length)};
});
const blocks=samples.map(sample=>sample.blocks).sort((a,b)=>a-b);
const matchups=heroes.flatMap((hero,index)=>heroes.slice(index+1).map(opponent=>{
  const pair=samples.filter(sample=>sample.a===hero&&sample.b===opponent||sample.a===opponent&&sample.b===hero);
  const wins=pair.filter(sample=>sample.a===hero&&sample.winner===0||sample.b===hero&&sample.winner===1).length;
  return {hero,opponent,matches:pair.length,heroWinRate:rate(wins,pair.length)};
}));
const curves=heroes.map(hero=>({hero,averageCost:Math.round(DECKS[hero].reduce((sum,id)=>sum+CARDS[id].cost,0)/30*100)/100,costThreeOrLess:DECKS[hero].filter(id=>CARDS[id].cost<=3).length,costSevenOrMore:DECKS[hero].filter(id=>CARDS[id].cost>=7).length}));
const report={scope:`${samples.length} seeded greedy/pressure AI matches, both seats, optional mulligans. A smoke/balance probe, not measured human PvP or elapsed match minutes.`,matches:samples.length,draws:samples.filter(sample=>sample.winner==='draw').length,medianBlocks:blocks[Math.floor(blocks.length/2)],minBlocks:blocks[0],maxBlocks:blocks.at(-1),firstSeatWinRate:rate(samples.filter(sample=>sample.winner===0).length,samples.length),conditionalCases,ultimates:samples.reduce((sum,sample)=>sum+sample.ultimates,0),reservePurchases:samples.reduce((sum,sample)=>sum+sample.reservePurchases,0),heroes:measured,matchups,curves};
console.log(JSON.stringify(report,null,2));
for(const hero of measured)if(hero.winRate<40||hero.winRate>60)console.warn(`BALANCE REVIEW: ${hero.hero} ${hero.winRate}% under this policy mix; inspect the matchup, not just its hero power.`);
if(report.firstSeatWinRate>60||report.firstSeatWinRate<40)console.warn(`BALANCE REVIEW: first seat ${report.firstSeatWinRate}% under this policy mix; inspect opening tempo in human PvP.`);
if(process.argv.includes('--report')){
  const path='docs/character-expansion-20261008.md',document=readFileSync(path,'utf8');
  const content=`<!-- MEASURED-START -->\n\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n\n<!-- MEASURED-END -->`;
  assert.match(document,/<!-- MEASURED-START -->[\s\S]*<!-- MEASURED-END -->/);
  writeFileSync(path,document.replace(/<!-- MEASURED-START -->[\s\S]*<!-- MEASURED-END -->/,content));
}
console.log(`CHARACTERS OK: all 50 playable, unchanged 49 originals, actual art files, ${heroes.length} legal deck recipes, ${transitions} focused transitions, ${conditionalCases} ultimate branches and ${samples.length} complete bounded matches.`);
