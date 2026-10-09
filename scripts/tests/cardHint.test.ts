import assert from 'node:assert/strict';
import {CARDS} from '../../lib/cards';
import {cardHint} from '../../components/presentation/cardHint';
import {retaliationDamage} from '../../lib/engine/combat';
import type {CardDef,EffectDef} from '../../lib/engine/types';

assert.deepEqual(cardHint(CARDS['node-sentinel'],'ru'),{title:'+1/+1',detail:'каждые 3 бл.'});
assert.deepEqual(cardHint(CARDS['hotspot-hoplite'],'ru'),{title:'Провокация',detail:'цель первой'});
assert.deepEqual(cardHint(CARDS['relay-runner'],'ru'),{title:'Добор 1',detail:'при выходе'});
assert.deepEqual(cardHint(CARDS['firmware-phalanx'],'ru'),{title:'+1/+1',detail:'всем · выход'});
assert.deepEqual(cardHint(CARDS['gps-gladiator'],'ru'),{title:'Урон 2',detail:'случ. · выход'});
assert.deepEqual(cardHint(CARDS['liquidation-officer'],'ru'),{title:'Лечение',detail:'за свой урон'});
const ordinary=CARDS['amm-centurion'];
assert.equal(cardHint(ordinary,'ru',{attack:5,health:2}).title,`Ответ ${retaliationDamage(5)}`,'Defence hint follows the actual buffed attack, rounded up');
assert.equal(cardHint(ordinary,'ru',{attack:2,health:2,taunt:true}).title,'Провокация','Granted keywords appear immediately');
assert.equal(cardHint(ordinary,'ru',{attack:2,health:2,rush:true}).detail,'сразу бойцу','Rush does not promise an immediate ruler attack');

const effects:EffectDef[]=[
 {kind:'draw',amount:2},{kind:'heal-treasury',amount:4},{kind:'heal-own-minions',amount:2},
 {kind:'damage-all-enemy-minions',amount:3},{kind:'damage-random-enemy',amount:2},{kind:'damage-enemy-treasury',amount:3},
 {kind:'weaken-random-enemy',amount:1},{kind:'buff-own',attack:1,health:2},{kind:'gain-gas',amount:2},
 {kind:'counter-mempool'},{kind:'rugpull'},{kind:'summon',cardId:'pixel-squire'},{kind:'expand-board',amount:1},
];
for(const effect of effects){
 const card:CardDef={...ordinary,battlecry:effect};
 for(const locale of ['ru','en'] as const){
  const hint=cardHint(card,locale);
  assert(hint.title.length>0&&hint.detail.includes(locale==='ru'?'выход':'arrival'),'Every arrival effect retains its trigger, even after it has resolved');
 }
}
const conditional:CardDef={...ordinary,ultimate:{condition:'staked',count:2,effect:{kind:'draw',amount:2},name:'Test',nameRu:'Проверка'}};
assert.equal(cardHint(conditional,'ru').detail,'если комбо','A conditional payoff never appears unconditional');
for(const card of Object.values(CARDS).filter(card=>card.type==='minion'))for(const locale of ['ru','en'] as const){
 const hint=cardHint(card,locale);assert(hint.title.trim()&&hint.detail.trim());
 assert(!hint.title.includes(card.faction),'The ability panel carries useful gameplay information rather than only a faction');
}
console.log('CARD HINTS OK: engine-derived abilities, exact growth intervals, arrival timing, target restrictions, conditional payoffs and live granted keywords/retaliation.');
