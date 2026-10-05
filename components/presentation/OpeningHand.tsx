import {CARDS} from '../../lib/cards';
import {cardName,type Locale} from '../../lib/locale';
import {cardArtPath} from '../../lib/cardArt';
import type {HandCard} from '../../lib/engine/types';
import styles from './ArenaLab.module.css';

/** A deliberate opening choice, using the existing legal mulligan action. */
export function OpeningHand({hand,selected,locale,onToggle,onConfirm}: {
  hand:HandCard[];selected:string[];locale:Locale;onToggle:(uid:string)=>void;onConfirm:()=>void;
}) {
  const ru=locale==='ru';
  return <>
    <h2 id="opening-hand-title">{ru?'Начальный строй':'Your opening hand'}</h2>
    <p>{ru?'Выберите карты для замены или оставьте руку.':'Choose cards to replace, or keep your hand.'}</p>
    <div className={styles.openingCards}>
      {hand.map(entry=>{
        const card=CARDS[entry.cardId],name=cardName(card.id,locale),marked=selected.includes(entry.uid);
        return <button key={entry.uid} className={`${styles.openingCard} ${marked?styles.openingCardSelected:''}`} aria-pressed={marked} aria-label={`${name}: ${marked?(ru?'оставить в руке':'keep in hand'):(ru?'выбрать для замены':'select to replace')}`} onClick={()=>onToggle(entry.uid)}>
          <span className={styles.openingCost} title={ru?'Стоимость':'Cost'}>{card.cost}</span>
          <img src={cardArtPath(card.id)} alt="" />
          <strong>{name}</strong>
          <span className={styles.openingStats}>{card.type==='minion'?<><span title={ru?'Атака':'Attack'}>{card.attack}</span><span title={ru?'Здоровье':'Health'}>{card.health}</span></>:<span>{ru?'Указ':'Edict'}</span>}</span>
          <span className={styles.openingDecision}>{marked?(ru?'На замену':'Replace'):(ru?'Оставляем':'Keep')}</span>
        </button>;
      })}
    </div>
    <button className={styles.primary} onClick={onConfirm}>{selected.length?(ru?`Заменить ${selected.length}`:`Replace ${selected.length}`):(ru?'Оставить все':'Keep all')}</button>
  </>;
}
