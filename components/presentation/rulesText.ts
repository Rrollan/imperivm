import { CARDS } from '../../lib/cards';
import { HEROES } from '../../lib/heroes';
import type { EffectDef } from '../../lib/engine/types';
import type { Locale } from '../../lib/locale';

/** UI rules come from the engine fields, keeping flavour text out of the action description. */
export function effectText(effect: EffectDef, locale: Locale): string {
  const ru = locale === 'ru', n = effect.amount ?? (effect.kind==='draw'||effect.kind==='gain-gas'?1:0);
  switch (effect.kind) {
    case 'damage-all-enemy-minions': return ru ? `${n} урона всем бойцам противника.` : `Deal ${n} damage to all enemy fighters.`;
    case 'damage-random-enemy': return ru ? `${n} урона случайному противнику.` : `Deal ${n} damage to a random enemy.`;
    case 'damage-enemy-treasury': return ru ? `${n} урона казне противника.` : `Deal ${n} damage to the enemy treasury.`;
    case 'heal-own-minions': return ru ? `Восстанавливает ${n} здоровья всем своим бойцам до их максимума.` : `Restore ${n} health to all friendly fighters, up to their maximum.`;
    case 'weaken-random-enemy': return ru ? `Случайному бойцу врага −${n} атаки, минимум 0.` : `Reduce a random enemy fighter’s attack by ${n}, minimum 0.`;
    case 'heal-treasury': return ru ? `Восстанавливает ${n} здоровья казне.` : `Restore ${n} treasury health.`;
    case 'draw': return ru ? `Добирает карты: ${n}.` : `Draw ${n} card${n === 1 ? '' : 's'}.`;
    case 'buff-own': return ru ? `Вашим бойцам +${effect.attack ?? 0}/+${effect.health ?? 0}.` : `Give your fighters +${effect.attack ?? 0}/+${effect.health ?? 0}.`;
    case 'gain-gas': return ru ? `Даёт ${n} приказов.` : `Gain ${n} orders.`;
    case 'counter-mempool': return ru ? 'Отменяет самое дорогое ожидающее заклинание противника.' : 'Counter the most expensive pending enemy spell.';
    case 'rugpull': return ru ? 'Уничтожает всех бойцов на поле.' : 'Destroy every fighter on the court.';
    case 'summon': return ru ? 'Призывает дополнительного бойца.' : 'Summon an additional fighter.';
  }
}

export function cardRules(id: string, locale: Locale) {
  const card = CARDS[id], ru = locale === 'ru', rules: string[] = [];
  if (card.taunt) rules.push(ru ? 'Провокация.' : 'Taunt.');
  if (card.rush) rules.push(ru ? 'Натиск: сразу атакует бойцов.' : 'Rush: can attack fighters immediately.');
  if (card.lifesteal) rules.push(ru ? 'Похищение жизни.' : 'Lifesteal.');
  if (card.priority) rules.push(ru ? 'Приоритет.' : 'Priority.');
  if (card.battlecry) rules.push(`${ru ? 'При выходе:' : 'On arrival:'} ${effectText(card.battlecry, locale)}`);
  if (card.spell) rules.push(effectText(card.spell, locale));
  if (card.halvingPeriod) rules.push(ru ? `Каждые ${card.halvingPeriod} блока: +1/+1.` : `Every ${card.halvingPeriod} blocks: +1/+1.`);
  return rules.join(' ') || (ru ? 'Боец без дополнительных способностей.' : 'A fighter with no additional abilities.');
}

export function powerRules(id: string, locale: Locale) {
  const ru = locale === 'ru';
  switch (HEROES[id].power) {
    case 'heal-treasury': return ru ? 'Восстанавливает 3 здоровья вашей казне.' : 'Restore 3 health to your treasury.';
    case 'gain-gas': return ru ? 'Даёт 2 приказа в этом ходу.' : 'Gain 2 orders this turn.';
    case 'draw-burn': return ru ? 'Добирает карту. Ваша казна получает 2 урона.' : 'Draw a card. Your treasury takes 2 damage.';
    case 'damage-random-enemy': return ru ? '2 урона случайному бойцу противника. Если бойцов нет — казне.' : 'Deal 2 damage to a random enemy fighter, or the treasury if none remain.';
  }
}
