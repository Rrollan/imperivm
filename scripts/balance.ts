/** Reproducible diagnostics, not a claim that self-play establishes a human PvP meta. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {FREE_DECKS} from '../lib/collection/starterDecks';
import {DECKS} from '../lib/decks';
import {CARDS} from '../lib/cards';
import {HEROES} from '../lib/heroes';
import {deckError} from '../lib/deckbuilder';
import {mechanicalTwins,probeMatch,type ProbePolicy} from '../lib/balance/simulation';
import type {RulesetId} from '../lib/engine/ruleset';

const seedsFlag=process.argv.indexOf('--seeds');
const seeds=Number(seedsFlag===-1?150:process.argv[seedsFlag+1]);
if(!Number.isInteger(seeds)||seeds<1||seeds>10000)throw new Error('--seeds must be an integer in 1..10000');
const rulesetFlag=process.argv.indexOf('--ruleset');
const ruleset=(rulesetFlag===-1?'classic-v1':process.argv[rulesetFlag+1]) as RulesetId;
if(ruleset!=='classic-v1'&&ruleset!=='validator-investment-v1')throw new Error('Unknown --ruleset');
const out=process.argv.includes('--out')?resolve(process.argv[process.argv.indexOf('--out')+1]):resolve(`docs/balance/${ruleset==='classic-v1'?'baseline':'validator-investment'}-20261006.json`);
const heroes=Object.keys(HEROES),pool=process.argv.includes('--free')?FREE_DECKS:DECKS;
interface PairResult {a:string;b:string;wins:number;losses:number;draws:number;incomplete:number;winRate:number;interval95:number[]}
for(const hero of heroes)if(deckError(pool[hero]))throw new Error(`${hero}: invalid deck`);
const suites=[
  {id:'starters-greedy',sameDeck:false,policies:['greedy','greedy'] as [ProbePolicy,ProbePolicy]},
  {id:'starters-pressure',sameDeck:false,policies:['pressure','pressure'] as [ProbePolicy,ProbePolicy]},
  {id:'shared-deck-greedy',sameDeck:true,policies:['greedy','greedy'] as [ProbePolicy,ProbePolicy]},
];
const quantile=(xs:number[],p:number)=>[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*p)];
const wilson=(wins:number,n:number)=>{
  const p=wins/n,z=1.96,den=1+z*z/n,centre=(p+z*z/(2*n))/den,margin=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return [Number((100*(centre-margin)).toFixed(1)),Number((100*(centre+margin)).toFixed(1))];
};
const results=suites.map(suite=>{
  let firstWins=0,draws=0,incomplete=0,casts=0,counters=0,stakes=0,refunds=0;
  const blocks:number[]=[],powers=Object.fromEntries(heroes.map(h=>[h,{uses:0,neutral:0}]));
  const cells:PairResult[]=[];
  for(const a of heroes)for(const b of heroes){
    const count={a,b,wins:0,losses:0,draws:0,incomplete:0,winRate:0,interval95:[0,0]};
    for(let i=0;i<seeds;i++){
      const seed=(104729+7919*i)|0;
      const game=probeMatch(a,pool[suite.sameDeck?'builder':a],b,pool[suite.sameDeck?'builder':b],seed,suite.policies,ruleset);
      if(game.winner===0){count.wins++;firstWins++;}else if(game.winner===1)count.losses++;
      else if(game.winner==='draw'){count.draws++;draws++;}else{count.incomplete++;incomplete++;}
      if(game.winner!==null)blocks.push(game.blocks);
      casts+=game.casts;counters+=game.counters;stakes+=game.stakes;refunds+=game.factionRefunds;
      [a,b].forEach((hero,seat)=>{powers[hero].uses+=game.powers[seat];powers[hero].neutral+=game.neutralPowers[seat];});
    }
    const decisive=count.wins+count.losses;
    count.winRate=decisive?Number((100*count.wins/decisive).toFixed(1)):0;
    count.interval95=decisive?wilson(count.wins,decisive):[0,100];cells.push(count);
  }
  const matches=seeds*heroes.length**2;
  const heroRates=heroes.map(hero=>{
    let wins=0,losses=0;
    for(const cell of cells){if(cell.a===hero){wins+=cell.wins;losses+=cell.losses;}if(cell.b===hero){wins+=cell.losses;losses+=cell.wins;}}
    return {hero,wins,losses,winRate:Number((100*wins/(wins+losses)).toFixed(1))};
  });
  console.log(`${suite.id}: ${matches} matches; first seat ${(100*firstWins/(matches-draws-incomplete)).toFixed(1)}%; median block ${quantile(blocks,.5)}; incomplete ${incomplete}`);
  console.log(heroRates.map(h=>`${h.hero} ${h.winRate}%`).join(' · '));
  return {...suite,matches,firstWins,firstWinRate:Number((100*firstWins/(matches-draws-incomplete)).toFixed(1)),draws,incomplete,blocks:{p10:quantile(blocks,.1),median:quantile(blocks,.5),p90:quantile(blocks,.9)},casts,counters,stakes,factionRefunds:refunds,powers,heroRates,cells};
});
const sourceDigest=createHash('sha256');
for(const path of ['lib/engine/engine.ts','lib/engine/ruleset.ts','lib/engine/spellTiming.ts','lib/engine/types.ts','lib/cards.ts','lib/heroes.ts','lib/decks.ts','lib/collection/starterDecks.ts','lib/ai.ts','lib/balance/simulation.ts'])sourceDigest.update(path+'\0').update(readFileSync(path));
const report={schema:1,ruleset,deckPool:process.argv.includes('--free')?'free':'all-owned',sourceDigest:sourceDigest.digest('hex'),engineCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),seedsPerOrderedPair:seeds,seedFormula:'104729 + 7919 * i; i = 0..seeds-1',mulligan:true,scope:'All 81 ordered pairs including mirrors. Both seats are counted. Shared-deck suite uses Builder deck for every hero. No hidden-state lookahead. Automated policies are probes, not estimates of human PvP win rates. Wilson intervals are descriptive per cell; hero aggregate samples include correlated same-match seats.',cardCount:Object.keys(CARDS).length,mechanicalTwins:mechanicalTwins(),results};
mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`Saved ${out}`);
