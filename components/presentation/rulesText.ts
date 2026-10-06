import { CARDS } from '../../lib/cards';
import { HEROES } from '../../lib/heroes';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import type { EffectDef } from '../../lib/engine/types';
import type { Locale } from '../../lib/locale';
import type {RulesetId} from '../../lib/engine/ruleset';

/** UI rules come from the engine fields, keeping flavour text out of the action description. */
export function effectText(effect: EffectDef, locale: Locale): string {
  const ru = locale === 'ru', n = effect.amount ?? (effect.kind==='draw'||effect.kind==='gain-gas'?1:0);
  switch (effect.kind) {
    case 'damage-all-enemy-minions': return ru ? `${n} урона всем бойцам противника.` : `Deal ${n} damage to all enemy fighters.`;
    case 'damage-random-enemy': return ru ? `${n} урона случайному бойцу противника. Если бойцов нет — казне.` : `Deal ${n} damage to a random enemy fighter, or the treasury if none remain.`;
    case 'damage-enemy-treasury': return ru ? `${n} урона казне противника.` : `Deal ${n} damage to the enemy treasury.`;
    case 'heal-own-minions': return ru ? `Восстанавливает ${n} здоровья всем своим бойцам до их максимума.` : `Restore ${n} health to all friendly fighters, up to their maximum.`;
    case 'weaken-random-enemy': return ru ? `Случайному бойцу врага −${n} атаки, минимум 0.` : `Reduce a random enemy fighter’s attack by ${n}, minimum 0.`;
    case 'heal-treasury': return ru ? `Восстанавливает ${n} здоровья казне.` : `Restore ${n} treasury health.`;
    case 'draw': return ru ? `Добирает карты: ${n}.` : `Draw ${n} card${n === 1 ? '' : 's'}.`;
    case 'buff-own': return ru ? `Вашим бойцам +${effect.attack ?? 0}/+${effect.health ?? 0}.` : `Give your fighters +${effect.attack ?? 0}/+${effect.health ?? 0}.`;
    case 'gain-gas': return ru ? `Даёт ${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'приказов' : n % 10 === 1 ? 'приказ' : n % 10 >= 2 && n % 10 <= 4 ? 'приказа' : 'приказов'}.` : `Gain ${n} ${n === 1 ? 'order' : 'orders'}.`;
    case 'counter-mempool': return ru ? 'Отменяет самое дорогое ожидающее заклинание противника.' : 'Counter the most expensive pending enemy spell.';
    case 'rugpull': return ru ? 'Уничтожает всех бойцов на поле.' : 'Destroy every fighter on the court.';
    case 'summon': return ru ? 'Призывает дополнительного бойца.' : 'Summon an additional fighter.';
  }
}

export function cardKeywords(id:string,locale:Locale){
  const card=CARDS[id],ru=locale==='ru';
  return [
    card.taunt&&{name:ru?'Провокация':'Taunt',description:ru?'Противник сначала должен атаковать бойцов с Провокацией.':'Enemies must attack fighters with Taunt first.'},
    card.rush&&{name:ru?'Натиск':'Rush',description:ru?'Атакует бойцов сразу после выхода. Правителя — со следующего хода владельца.':'Can attack fighters immediately. Can attack the ruler on the owner’s next turn.'},
    card.lifesteal&&{name:ru?'Похищение жизни':'Lifesteal',description:ru?'Восстанавливает казну владельца на величину фактически нанесённого урона.':'Restore the owner’s treasury by the actual damage dealt.'},
    card.priority&&{name:ru?'Приоритет':'Priority',description:ru?'При розыгрыше отменяет самый дорогой указ противника в очереди.':'On play, counter the most expensive queued enemy edict.'},
  ].filter((value):value is {name:string;description:string}=>!!value);
}

export function cardRules(id: string, locale: Locale,includeKeywords=true) {
  const card = CARDS[id], ru = locale === 'ru', rules: string[] = [];
  if(includeKeywords){
    if (card.taunt) rules.push(ru ? 'Провокация.' : 'Taunt.');
    if (card.rush) rules.push(ru ? 'Натиск: сразу атакует бойцов.' : 'Rush: can attack fighters immediately.');
    if (card.lifesteal) rules.push(ru ? 'Похищение жизни.' : 'Lifesteal.');
    if (card.priority) rules.push(ru ? 'Приоритет.' : 'Priority.');
  }
  if (card.battlecry) rules.push(`${ru ? 'При выходе:' : 'On arrival:'} ${effectText(card.battlecry, locale)}`);
  if (card.spell) rules.push(`${isInstantSpell(card)?(ru?'Мгновенно:':'Instant:'):(ru?'В начале следующего своего хода:':'At the start of your next turn:')} ${effectText(card.spell, locale)}`);
  if (card.halvingPeriod) rules.push(ru ? `Каждые ${card.halvingPeriod} блока: +1/+1.` : `Every ${card.halvingPeriod} blocks: +1/+1.`);
  return rules.join(' ') || (!includeKeywords&&cardKeywords(id,locale).length?'':ru ? 'Боец без дополнительных способностей.' : 'A fighter with no additional abilities.');
}

export function powerRules(id: string, locale: Locale,ruleset:RulesetId='classic-v1') {
  const ru = locale === 'ru';
  switch (HEROES[id].power) {
    case 'heal-treasury': return ru ? 'Восстанавливает 3 здоровья вашей казне.' : 'Restore 3 health to your treasury.';
    case 'gain-gas': return ruleset==='validator-investment-v1'?(ru?'Потратьте приказы сейчас. В начале следующего своего хода получите +2 приказа сверх запаса, после исполнения указов.':'Spend orders now. Gain +2 orders above capacity at the start of your next turn, after edicts resolve.'):(ru ? 'Даёт 2 приказа в этом ходу.' : 'Gain 2 orders this turn.');
    case 'draw-burn': return ru ? 'Добирает карту. Ваша казна получает 2 урона.' : 'Draw a card. Your treasury takes 2 damage.';
    case 'damage-random-enemy': return ru ? '2 урона случайному бойцу противника. Если бойцов нет — казне.' : 'Deal 2 damage to a random enemy fighter, or the treasury if none remain.';
  }
}
