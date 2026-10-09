import type {CardDef,EffectDef,Minion} from '../../lib/engine/types';
import {retaliationDamage} from '../../lib/engine/combat';
import type {Locale} from '../../lib/locale';

export type CardFaceStats=Pick<Minion,'attack'|'health'> & Partial<Pick<Minion,'taunt'|'rush'|'lifesteal'>>;
export interface CardHint {title:string;detail:string}

/** The small face names one useful mechanic. The inspector keeps its full rules
 * and combo conditions; flavour copy never invents an ability here. */
function arrivalHint(effect:EffectDef,locale:Locale):CardHint{
  const ru=locale==='ru',n=effect.amount??(effect.kind==='draw'||effect.kind==='gain-gas'?1:0);
  const arrival=ru?'при выходе':'on arrival';
  switch(effect.kind){
    case 'draw':return {title:ru?`Добор ${n}`:`Draw ${n}`,detail:arrival};
    case 'heal-treasury':return {title:ru?`Казне +${n}`:`Heal ${n}`,detail:ru?'при выходе':'treasury · arrival'};
    case 'heal-own-minions':return {title:ru?`Лечение ${n}`:`Heal ${n}`,detail:ru?'всем · выход':'allies · arrival'};
    case 'damage-all-enemy-minions':return {title:ru?`Урон ${n}`:`Damage ${n}`,detail:ru?'ряду · выход':'row · arrival'};
    case 'damage-random-enemy':return {title:ru?`Урон ${n}`:`Damage ${n}`,detail:ru?'случ. · выход':'random · arrival'};
    case 'damage-enemy-treasury':return {title:ru?`Урон ${n}`:`Damage ${n}`,detail:ru?'казне · выход':'treasury · arrival'};
    case 'weaken-random-enemy':return {title:ru?`Атака −${n}`:`Attack −${n}`,detail:ru?'случ. · выход':'random · arrival'};
    case 'buff-own':return {title:`+${effect.attack??0}/+${effect.health??0}`,detail:ru?'всем · выход':'allies · arrival'};
    case 'gain-gas':return {title:ru?`Приказы +${n}`:`Orders +${n}`,detail:arrival};
    case 'counter-mempool':return {title:ru?'Контруказ':'Counter',detail:arrival};
    case 'rugpull':return {title:ru?'Снос поля':'Clear court',detail:arrival};
    case 'summon':return {title:ru?'Призыв 1':'Summon 1',detail:arrival};
    case 'expand-board':return {title:ru?`Места +${n}`:`Slots +${n}`,detail:arrival};
  }
}

export function cardHint(card:CardDef,locale:Locale,stats?:CardFaceStats):CardHint{
  const ru=locale==='ru';
  // Live keywords include buffs granted by a ruler or a spell. A printed
  // arrival effect stays labelled as arrival, never as an available action.
  if(stats?.taunt??card.taunt)return {title:ru?'Провокация':'Taunt',detail:ru?'цель первой':'attack first'};
  if(stats?.rush??card.rush)return {title:ru?'Натиск':'Rush',detail:ru?'сразу бойцу':'fighters now'};
  if(stats?.lifesteal??card.lifesteal)return {title:ru?'Лечение':'Lifesteal',detail:ru?'за свой урон':'damage heals'};
  if(card.halvingPeriod)return {title:'+1/+1',detail:ru?`каждые ${card.halvingPeriod} бл.`:`every ${card.halvingPeriod} blocks`};
  if(card.priority)return {title:ru?'Контруказ':'Counter',detail:ru?'дорогой указ':'costliest edict'};
  if(card.battlecry)return arrivalHint(card.battlecry,locale);
  if(card.ultimate){const hint=arrivalHint(card.ultimate.effect,locale);return {...hint,detail:ru?'если комбо':'with combo'};}
  return {title:ru?`Ответ ${retaliationDamage(stats?.attack??card.attack??0)}`:`Counter ${retaliationDamage(stats?.attack??card.attack??0)}`,detail:ru?'при защите':'on defence'};
}
