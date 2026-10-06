'use client';

import {CARDS} from '../../lib/cards';
import {useLocale} from '../LocaleContext';
import {cardRules} from '../presentation/rulesText';
import {roleName} from '../presentation/cardIdentity';
import styles from './Home.module.css';

/** Catalogue text stays in normal document flow; no stat ornaments over the name or rules. */
export function CardFacts({id}: {id: string}) {
  const {t, locale, cardName, rarityName} = useLocale(), card = CARDS[id];
  return <span className={styles.cardFacts}>
    <strong className={styles.factName}>{cardName(id)}</strong>
    <span className={styles.factRole}>{card.faction} · {roleName(id, locale)} · {rarityName(card.rarity)}</span>
    <span className={styles.factStats}>
      <span><span>{t('Приказы', 'Orders')}</span><b>{card.cost}</b></span>
      {card.type === 'minion' && <><span><span>{t('Атака', 'Attack')}</span><b>{card.attack}</b></span><span><span>{t('Здоровье', 'Health')}</span><b>{card.health}</b></span></>}
    </span>
    <span className={styles.factRules}>{cardRules(id, locale)}</span>
  </span>;
}
