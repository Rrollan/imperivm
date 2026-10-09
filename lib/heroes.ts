/**
 * IMPERIVM — hero content v1.
 *
 * Nine rulers. Case rulers have conditional peaks and explicit costs,
 * rather than more health or a passive paid advantage.
 * Power kinds are exactly those from lib/engine/types.ts.
 */
import type { HeroDef } from './engine/types';

export const HEROES: Record<string, HeroDef> = {
  whale: {
    access:'free',faction:'DeFi',style:['Давление и зачистки','Pressure & clears'],
    id: 'whale',
    name: 'Whale',
    title: 'The Market Mover',
    powerName: 'Market Dump',
    powerText:
      'Deal 2 damage to a random enemy minion — or to the enemy treasury if none stand. The market gives, and the Whale takes.',
    powerCost: 3,
    power: 'damage-random-enemy',
  },
  builder: {
    access:'free',faction:'NFT',style:['Восстановление и защита','Recovery & defense'],
    id: 'builder',
    name: 'Builder',
    title: 'The Shipwright',
    powerName: 'Deploy Patch',
    powerText:
      'Restore 2 to your treasury and 2 to your most wounded fighter. Ship fixes, not excuses.',
    powerCost: 2,
    power: 'heal-treasury',
  },
  degen: {
    access:'free',faction:'Meme',style:['Риск и добор','Risk & card draw'],
    id: 'degen',
    name: 'Degen',
    title: 'The Aped',
    powerName: 'Aped In',
    powerText:
      'Draw a card and take 2 damage. Due diligence is for cowards.',
    powerCost: 2,
    power: 'draw-burn',
  },
  validator: {
    access:'free',faction:'DePIN',style:['Инвестиции в следующий ход','Invest in the next turn'],
    id: 'validator',
    name: 'Validator',
    title: 'The Block Keeper',
    powerName: 'Validate',
    powerText:
      'Reserve 2 orders for the start of your next turn, above capacity. The chain remembers the faithful.',
    powerCost: 1,
    power: 'gain-gas',
  },
  strategist:{id:'strategist',name:'Strategist',title:'The Legion Marshal',powerName:'Rally the Legion',powerText:'Summon a Pixel Squire 1/1 in an empty slot. No arrival effect.',powerCost:2,power:'rally-squire',access:'free',faction:'NFT',style:['Широкий строй и усиления','Wide formations & buffs']},
  athena:{id:'athena',name:'Athena',title:'The Diamond Strategist',powerName:'Diamond Aegis',powerText:'Give your lowest-health fighter +1/+1 and Taunt; +1/+2 if another established NFT ally stands. Requires a fighter; formation order breaks ties.',powerCost:3,power:'athena-aegis',access:'case',faction:'NFT',style:['Укрепление уязвимого бойца','Fortify a vulnerable fighter']},
  hermes:{id:'hermes',name:'Hermes',title:'The Alpha Relayer',powerName:'Deliver Alpha',powerText:'Draw a card and take 3 damage. After playing a DePIN card this turn, take no damage instead.',powerCost:2,power:'hermes-relay',access:'case',faction:'DePIN',style:['Цепочки DePIN и добор','DePIN sequences & draw']},
  hephaestus:{id:'hephaestus',name:'Hephaestus',title:'The Protocol Smith',powerName:'Forge the Reserve',powerText:'Summon a Lending Legionnaire 2/2. If another established fighter is staked, summon it as 3/3. Requires an empty slot.',powerCost:3,power:'hephaestus-forge',access:'case',faction:'DeFi',style:['Стейкинг и резервный легион','Staking & reserve fighters']},
  poseidon:{id:'poseidon',name:'Poseidon',title:'The Deep Liquidity',powerName:'Liquidation Tide',powerText:'Deal 1 damage to every enemy fighter. After playing two DeFi cards this turn, deal 2 instead. Requires an enemy fighter.',powerCost:4,power:'poseidon-tide',access:'case',faction:'DeFi',style:['Зачистки через связки DeFi','DeFi setup & board clears']},
};
export const FREE_HERO_IDS=Object.values(HEROES).filter(hero=>hero.access==='free').map(hero=>hero.id);
export const CASE_HERO_IDS=Object.values(HEROES).filter(hero=>hero.access==='case').map(hero=>hero.id);
export const isFreeHero=(id:string)=>HEROES[id]?.access==='free';
