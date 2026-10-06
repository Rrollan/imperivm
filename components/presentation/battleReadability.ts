import {CARDS} from '../../lib/cards';
import {legalActions,mulliganAvailable} from '../../lib/engine/engine';
import type {Action,GameState,Minion,PlayerId} from '../../lib/engine/types';
import type {Locale} from '../../lib/locale';

export type FighterReadiness='ready'|'rush'|'fresh'|'exhausted'|'garrison'|'waiting'|'no-target'|'over';
export type BattleCommand='own'|'done'|'enemy'|'busy'|'over';

/** Explain the existing legal actions; presentation must not invent restrictions. */
export function fighterReadiness(state:GameState,owner:PlayerId,fighter:Minion,actions:Action[]=legalActions(state)):FighterReadiness{
  if(state.winner!==null)return 'over';
  if(fighter.staked)return 'garrison';
  if(state.turn!==owner)return 'waiting';
  if(actions.some(action=>action.type==='attack'&&action.attackerUid===fighter.uid))return fighter.fresh&&fighter.rush?'rush':'ready';
  if(fighter.fresh&&!fighter.rush)return 'fresh';
  if(!fighter.canAttack)return 'exhausted';
  return 'no-target';
}

export function readinessText(readiness:FighterReadiness,locale:Locale):string{
  const text:Record<FighterReadiness,[string,string]>={
    ready:['Готов атаковать.','Ready to attack.'],
    rush:['Натиск: может атаковать бойца прямо сейчас.','Rush: can attack a fighter now.'],
    fresh:['Вступил в строй. Атакует со следующего хода владельца.','Just deployed. Can attack on the owner’s next turn.'],
    exhausted:['Действие потрачено. Готовность вернётся в следующий ход владельца.','Action spent. Readiness returns on the owner’s next turn.'],
    garrison:['Гарнизон: +1 приказ в начале хода. Не атакует.','Garrison: +1 order at turn start. Cannot attack.'],
    waiting:['Ждёт хода владельца.','Waiting for the owner’s turn.'],
    'no-target':['Сейчас нет допустимой цели для атаки.','No legal attack target right now.'],
    over:['Бой завершён.','The battle is over.'],
  };
  return text[readiness][locale==='ru'?0:1];
}

/** Garrison remains optional, not a reason to keep the turn lit forever. */
export function battleCommand(state:GameState,actions:Action[]=legalActions(state)):BattleCommand{
  if(state.winner!==null)return 'over';
  if(state.turn!==0)return 'enemy';
  if(mulliganAvailable(state))return 'busy';
  return actions.some(action=>['play-minion','cast-spell','attack','hero-power'].includes(action.type))?'own':'done';
}

export function unavailableCardText(state:GameState,cardId:string,locale:Locale,busy=false):string{
  const ru=locale==='ru',card=CARDS[cardId],player=state.players[0];
  if(state.winner!==null)return ru?'Бой завершён':'Battle over';
  if(busy)return ru?'Действие выполняется':'Action resolving';
  if(state.turn!==0)return ru?'Ход соперника':'Opponent’s turn';
  if(mulliganAvailable(state))return ru?'Сначала выберите стартовую руку':'Choose the opening hand first';
  if(player.gas<card.cost)return ru?`Не хватает приказов: ${card.cost-player.gas}`:`Need ${card.cost-player.gas} more orders`;
  if(card.type==='minion'&&player.board.length>=7)return ru?'Строй заполнен: 7 бойцов':'Court full: 7 fighters';
  return ru?'Розыгрыш недоступен':'Cannot play this card';
}

export function nextHalvingBlock(block:number,period:number):number{
  return (Math.floor(block/period)+1)*period;
}
