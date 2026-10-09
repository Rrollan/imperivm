import { CARDS } from '../../lib/cards';
import { HEROES } from '../../lib/heroes';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import type { EffectDef } from '../../lib/engine/types';
import {cardName, type Locale} from '../../lib/locale';
import {retaliationDamage} from '../../lib/engine/combat';
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
    case 'summon': {
      const summoned=CARDS[effect.cardId??''];
      if(!summoned)return ru?'Призывает дополнительного бойца при наличии свободного места.':'Summon an additional fighter if there is an empty slot.';
      const keywords=[summoned.taunt?(ru?'Провокация':'Taunt'):null,summoned.rush?(ru?'Натиск':'Rush'):null,summoned.lifesteal?(ru?'Похищение жизни':'Lifesteal'):null].filter(Boolean).join(', ');
      return `${ru?'Призывает':'Summon'} «${cardName(summoned.id,locale)}» ${summoned.attack}/${summoned.health}${keywords?` (${keywords})`:''}. ${ru?'Нужно свободное место; эффект выхода помощника не повторяется.':'Requires an empty slot; the helper’s arrival effect is not repeated.'}`;
    }
    case 'expand-board': return ru ? `Навсегда добавляет ${n} место в строю, максимум до 7.` : `Permanently add ${n} court slot, up to 7.`;
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
  if (card.ultimate) {
    const u=card.ultimate;
    const condition=u.condition==='staked'?(ru?u.count===1?'хотя бы один ваш боец пережил ход соперника и находится в стейкинге':`хотя бы ${u.count} ваших бойца пережили ход соперника и находятся в стейкинге`:`at least ${u.count} established friendly fighter${u.count===1?'':'s'} ${u.count===1?'is':'are'} staked`):u.condition==='faction-allies'?(ru?u.count===1?`хотя бы один другой боец ${u.faction??card.faction} пережил ход соперника`:`хотя бы ${u.count} других бойца ${u.faction??card.faction} пережили ход соперника`:`at least ${u.count} other ${u.faction??card.faction} fighter${u.count===1?'':'s'} survived the opponent’s turn`):(ru?u.count===1?`ранее в этом ходу разыграна хотя бы одна карта ${u.faction??card.faction}`:`ранее в этом ходу разыграны хотя бы ${u.count} карты ${u.faction??card.faction}`:`you already played at least ${u.count} ${u.faction??card.faction} card${u.count===1?'':'s'} this turn`);
    rules.push(`${ru?'Ультимейт':'Ultimate'} «${ru?u.nameRu:u.name}»: ${ru?'если':'if'} ${condition}, ${card.battlecry?(ru?'вместо обычного эффекта:':'replace the ordinary effect:'):''} ${effectText(u.effect,locale)}`);
  }
  if (card.spell) rules.push(`${isInstantSpell(card)?(ru?'Мгновенно:':'Instant:'):(ru?'В начале следующего своего хода:':'At the start of your next turn:')} ${effectText(card.spell, locale)}`);
  if (card.halvingPeriod) rules.push(ru ? `Каждые ${card.halvingPeriod} блока: +1/+1.` : `Every ${card.halvingPeriod} blocks: +1/+1.`);
  return rules.join(' ') || (!includeKeywords&&cardKeywords(id,locale).length?'':ru ? 'Боец без дополнительных способностей.' : 'A fighter with no additional abilities.');
}

export function retaliationRules(attack:number,locale:Locale){
  const damage=retaliationDamage(attack);
  return locale==='ru'?`При атаке наносит полный урон. Защищаясь, отвечает половиной текущей атаки с округлением вверх: ${damage}. Оба удара происходят одновременно.`:`Deals full damage when attacking. When defending, retaliates for half its current attack rounded up: ${damage}. Both strikes are simultaneous.`;
}

export function powerRules(id: string, locale: Locale,ruleset:RulesetId='classic-v1') {
  const ru = locale === 'ru';
  switch (HEROES[id].power) {
    case 'heal-treasury': return ru ? 'Восстанавливает 2 здоровья казне и 1 самому раненому своему бойцу. При равенстве — первому в строю.' : 'Restore 2 treasury health and 1 to your most wounded fighter; formation order breaks ties.';
    case 'gain-gas': return ru?'Потратьте приказы сейчас. В начале следующего своего хода получите +2 приказа сверх запаса, после исполнения указов.':'Spend orders now. Gain +2 orders above capacity at the start of your next turn, after edicts resolve.';
    case 'draw-burn': return ru ? 'Добирает карту. Ваша казна получает 2 урона.' : 'Draw a card. Your treasury takes 2 damage.';
    case 'damage-random-enemy': return ru ? '2 урона случайному бойцу противника. Если бойцов нет — казне.' : 'Deal 2 damage to a random enemy fighter, or the treasury if none remain.';
    case 'rally-squire':return ru?'Призывает Пиксельного оруженосца 1/1 в свободное место. Он сможет атаковать со следующего своего хода.':'Summon a Pixel Squire 1/1 in an empty slot. It can attack next own turn.';
    case 'athena-aegis':return ru?'Своему бойцу с наименьшим текущим здоровьем +1/+1 и Провокация. Если другой свой NFT-боец пережил ход соперника — +1/+2. При равенстве — первому в строю. Нужен свой боец.':'Give your lowest-health fighter +1/+1 and Taunt; +1/+2 if another established NFT ally stands. Formation order breaks ties. Requires a fighter.';
    case 'hermes-relay':return ru?'Добирает карту и наносит 3 урона вашей казне. Если ранее в этом ходу разыграна карта DePIN — без этого урона.':'Draw a card and take 3 treasury damage. After playing a DePIN card this turn, take no burn damage instead.';
    case 'hephaestus-forge':return ru?'Призывает Легионера кредитов 2/2. Если другой ваш боец пережил ход соперника и находится в стейкинге — призыв 3/3. Нужен свободный слот.':'Summon a Lending Legionnaire 2/2, or 3/3 if another established friendly fighter is staked. Requires an empty slot.';
    case 'poseidon-tide':return ru?'1 урон всем бойцам врага. Если ранее в этом ходу разыграны две карты DeFi — 2 урона. Нужен боец противника.':'Deal 1 damage to every enemy fighter, or 2 after playing two DeFi cards this turn. Requires an enemy fighter.';
  }
}
