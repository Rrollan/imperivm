'use client';

import {CARDS} from '../../lib/cards';
import {useLocale} from '../LocaleContext';
import {cardKeywords,cardRules} from '../presentation/rulesText';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import {roleName} from '../presentation/cardIdentity';
import styles from './Home.module.css';

/** Catalogue text stays in normal document flow; no stat ornaments over the name or rules. */
export function CardFacts({id,compact=false}: {id: string;compact?:boolean}) {
  const {t, locale, cardName, rarityName} = useLocale(), card = CARDS[id];
  const brief=card.type==='spell'?isInstantSpell(card)?t('Мгновенно','Instant'):t('Указ','Edict'):cardKeywords(id,locale).slice(0,2).map(k=>k.name).join(' · ');
  return <span className={`${styles.cardFacts} ${compact?styles.compactFacts:''}`}>
    <strong className={styles.factName}>{cardName(id)}</strong>
    <span className={styles.factRole}>{card.faction} · {compact?rarityName(card.rarity):`${roleName(id,locale)} · ${rarityName(card.rarity)}`}</span>
    {!compact&&<span className={styles.factStats}>
      <span><span>{t('Приказы', 'Orders')}</span><b>{card.cost}</b></span>
      {card.type === 'minion' && <><span><span>{t('Атака', 'Attack')}</span><b>{card.attack}</b></span><span><span>{t('Здоровье', 'Health')}</span><b>{card.health}</b></span></>}
    </span>}
    {(!compact||brief)&&<span className={styles.factRules}>{compact?brief:cardRules(id,locale)}</span>}
  </span>;
}
