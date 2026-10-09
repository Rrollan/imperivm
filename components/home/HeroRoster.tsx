'use client';

import Link from 'next/link';
import { HEROES } from '../../lib/heroes';
import { FREE_DECKS as DECKS } from '../../lib/collection/starterDecks';
import { useLocale } from '../LocaleContext';
import { heroPortraitPath } from '../presentation/heroPortrait';
import { powerRules } from '../presentation/rulesText';
import styles from './Home.module.css';
import {useCollection} from '../CollectionContext';
import {isFreeHero} from '../../lib/heroes';


export function HeroRoster({ selected, onSelect, compact=false }: { selected: string; onSelect: (id: string) => void; compact?:boolean }) {
  const { t, locale, heroName, powerName } = useLocale();
  const collection=useCollection();
  return <div className={`${styles.heroRoster} ${compact?styles.compactRoster:''}`}>
    <div className={styles.heroOptions} role="group" aria-label={t('Выбор правителя', 'Choose your ruler')}>
      {Object.values(HEROES).map(hero => <button key={hero.id} type="button" className={styles.heroChoice} disabled={!isFreeHero(hero.id)&&!collection.snapshot?.heroes?.includes(hero.id)} aria-pressed={hero.id === selected} onClick={() => onSelect(hero.id)}>
        <span className={styles.coin}><img src={heroPortraitPath(hero.id)} alt="" width="128" height="128" draggable={false} /></span>
        <strong>{heroName(hero.id)}</strong>
        {hero.access==='case'&&<small>{collection.snapshot?.heroes?.includes(hero.id)?t('Открыт','Unlocked'):t('Из кейса','From cases')}</small>}
        {!compact&&<span>{hero.style[locale === 'ru' ? 0 : 1]}</span>}
      </button>)}
    </div>
    {compact?<details className={styles.compactPower} key={selected}><summary>{powerName(selected)} · {HEROES[selected].powerCost} {t('приказа','orders')}</summary><p>{powerRules(selected,locale)}</p><Link href="/library#rulers">{t('Все способности →','All abilities →')}</Link></details>:<div className={styles.heroBrief} aria-live="polite" aria-atomic="true">
      <div><span className={styles.kicker}>{t('Сила правителя', 'Ruler power')}</span><h3>{powerName(selected)}</h3></div>
      <p>{powerRules(selected, locale)}</p>
      <span className={styles.powerCost}>{HEROES[selected].powerCost} {t('приказа', 'orders')}<small>{t('Один раз за ход', 'Once per turn')}</small></span>
    </div>}
  </div>;
}

export function RulerLibrary() {
  const { t, locale, heroName, heroTitle, powerName } = useLocale();
  const collection=useCollection();
  return <div className={styles.rulerLibrary}>{Object.values(HEROES).map(hero => <article className={styles.rulerEntry} key={hero.id}>
    <div className={styles.rulerHeading}><span className={styles.coin}><img src={heroPortraitPath(hero.id)} alt="" width="160" height="160" loading="lazy" /></span><div><span className={styles.kicker}>{heroTitle(hero.id)}</span><h2>{heroName(hero.id)}</h2><p>{hero.style[locale === 'ru' ? 0 : 1]}</p></div></div>
    <div className={styles.rulerPower}><h3>{powerName(hero.id)} <span>{hero.powerCost} {t('приказа', 'orders')}</span></h3><p>{powerRules(hero.id, locale)}</p><small>{t('Сила доступна один раз за свой ход.', 'Use this power once on each of your turns.')}</small></div>
    <div className={styles.rulerBottom}><span>{DECKS[hero.id].length} {t('карт в готовой колоде', 'cards in the starter deck')}</span><Link href={isFreeHero(hero.id)||collection.snapshot?.heroes?.includes(hero.id)?`/arena?hero=${hero.id}`:'/packs#rulers'} className={styles.textLink}>{isFreeHero(hero.id)||collection.snapshot?.heroes?.includes(hero.id)?t('Играть', 'Play'):t('Из кейса','From cases')} <span aria-hidden="true">→</span></Link></div>
  </article>)}</div>;
}
