import {CARDS} from '../../lib/cards';
import {cardArtPath} from '../../lib/cardArt';
import type {Locale} from '../../lib/locale';
import type {HistoryChange,HistoryEntry,PublicPiece} from './battleHistory';
import styles from './ArenaLab.module.css';

export function BattleChronicle({entries,locale,cardName,heroName,powerName,onCard}:{entries:readonly HistoryEntry[];locale:Locale;cardName:(id:string)=>string;heroName:(id:string)=>string;powerName:(id:string)=>string;onCard:(id:string,owner:0|1)=>void}){
  const ru=locale==='ru',t=(a:string,b:string)=>ru?a:b;
  const owner=(id:number)=>id===0?t('Вы','You'):t('Соперник','Opponent');
  const label=(piece:PublicPiece)=>`${owner(piece.owner)}: ${piece.cardId?cardName(piece.cardId):heroName(piece.heroId!)}`;
  const changes=(items:HistoryChange[])=><ul className={styles.historyChanges}>{items.map((change,index)=><li key={index}>
    <span>{label(change.piece)}</span>
    {(change.removed||change.arrived)&&<strong>{change.removed?t('погиб','defeated'):t('вступил в строй','deployed')}</strong>}
    {change.attack&&<span>{t('Атака','Attack')}: {change.attack[0]} → {change.attack[1]}</span>}
    {change.health&&!change.removed&&<span>{t('Здоровье','Health')}: {change.health[0]} → {change.health[1]}</span>}
  </li>)}</ul>;
  const title=(entry:HistoryEntry)=>{
    switch(entry.kind){
      case 'play-minion':return t('Розыгрыш бойца','Fighter played');
      case 'cast-spell':return entry.details.some(d=>d.kind==='immediate')?t('Мгновенное заклинание','Instant spell'):t('Указ в очереди','Edict queued');
      case 'attack':return t('Атака','Attack');
      case 'hero-power':return entry.source?.heroId?powerName(entry.source.heroId):t('Сила правителя','Ruler power');
      case 'buy-card':return t('Подкрепление · 2 приказа','Reinforcement · 2 orders');
      case 'stake':return t('Отправлен в гарнизон','Sent to garrison');
      case 'unstake':return t('Возвращён в бой','Returned to battle');
      case 'end-turn':return entry.owner===0?t('Начало вашего хода','Your turn starts'):t('Начало хода соперника','Opponent’s turn starts');
      case 'mulligan':return entry.replaced?t(`Заменено карт: ${entry.replaced}`,`Cards replaced: ${entry.replaced}`):t('Стартовая рука оставлена','Opening hand kept');
    }
  };
  return <>
    <h2>{t('История боя','Battle history')}</h2>
    <p className={styles.historyIntro}>{t('Бой на паузе. Последние действия, свежие сверху.','Battle paused. Recent actions, newest first.')}</p>
    {!entries.length&&<p>{t('Здесь появятся ваши действия и публичные действия соперника.','Your actions and public opponent actions will appear here.')}</p>}
    <ol className={styles.historyList}>{[...entries].reverse().map(entry=><li key={entry.id}>
      <header><span>{t('Ход','Turn')} {entry.block} · {owner(entry.owner)}</span><h3>{title(entry)}</h3></header>
      {entry.source&&<div className={styles.historySource}>
        {entry.source.cardId?<button onClick={()=>onCard(entry.source!.cardId!,entry.source!.owner)}><img src={cardArtPath(entry.source.cardId)} alt=""/><span>{cardName(entry.source.cardId)}<small>{t('Стоимость','Cost')}: {CARDS[entry.source.cardId].cost}</small></span></button>:entry.source.heroId?<p>{heroName(entry.source.heroId)}</p>:null}
        {entry.target&&<p>→ {label(entry.target)}</p>}
      </div>}
      {entry.orders&&<p>{t('Приказы','Orders')}: {entry.orders[0]} → {entry.orders[1]}</p>}
      {entry.details.filter(detail=>detail.kind!=='queued').map((detail,index)=><div className={styles.historyDetail} key={index}>
        {detail.kind==='immediate'||detail.kind==='resolved'||detail.kind==='countered'?<><p><strong>{cardName(detail.cardId)}</strong> · {detail.kind==='immediate'?t('Применено сразу','Applied immediately'):detail.kind==='countered'?t('Отменено','Countered'):detail.fizzled?t('Не исполнено','Fizzled'):t('Исполнено','Resolved')} · {owner(detail.owner)}</p>{detail.kind==='resolved'&&!!detail.changes?.length&&changes(detail.changes)}{detail.kind==='resolved'&&detail.noChange&&<p>{t('Характеристики не изменились.','Stats unchanged.')}</p>}</>:null}
        {detail.kind==='growth'&&<p>{label(detail.piece)} · {t('пассивное усиление +1/+1','passive growth +1/+1')}</p>}
        {detail.kind==='draw'&&<p>{owner(detail.owner)}{detail.received>0?` · ${t('Добрано','Drawn')}: ${detail.received}`:''}{detail.burned>0?` · ${t('Сожжено','Burned')}: ${detail.burned}`:''}{detail.fatigue>0?` · ${t('Истощение','Fatigue')}: ${detail.fatigue}`:''}</p>}
      </div>)}
      {!!entry.changes.length&&<details><summary>{t('Итог действия','Action outcome')}</summary>{changes(entry.changes)}</details>}
      {entry.winner!==null&&<p className={styles.fighterStatus}>{entry.winner==='draw'?t('Ничья','Draw'):entry.winner===0?t('Ваша победа','You won'):t('Победа соперника','Opponent won')}</p>}
    </li>)}</ol>
  </>;
}
