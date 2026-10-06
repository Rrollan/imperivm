'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { CARDS } from '../../lib/cards';
import { HEROES } from '../../lib/heroes';
import { useLocale } from '../LocaleContext';
import { ArenaCardPreview } from '../presentation/ArenaCardPreview';
import { HeroRoster } from './HeroRoster';
import { RulesGuide } from './RulesGuide';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { CardDialog } from './CardDialog';
import styles from './Home.module.css';

const PREVIEW_CARDS = ['solar-sapper', 'imperator-liquidus', 'restoration-rite'];
const HERO_KEY = 'imperivm.home.hero';

export default function HomeScreen() {
  const { t, locale, cardName, heroName } = useLocale();
  const [hero, setHero] = useState('builder'), [inspected, setInspected] = useState<string | null>(null);
  useEffect(() => { try { const saved = localStorage.getItem(HERO_KEY); if (saved && HEROES[saved]) setHero(saved); } catch {} }, []);
  function selectHero(id: string) { setHero(id); try { localStorage.setItem(HERO_KEY, id); } catch {} }
  return <div className={styles.shell}>
    <SiteHeader />
    <main className={styles.main}>
      <section className={styles.introduction} aria-labelledby="home-title">
        <div className={styles.introCopy}>
          <p className={styles.kicker}>{t('Тактическая карточная игра', 'A tactical card battler')} <span aria-hidden="true">·</span> Roman / Crypto</p>
          <h1 id="home-title">{t('Империя начинается', 'An empire begins')}<em>{t('с твоего хода.', 'with your turn.')}</em></h1>
          <p className={styles.introDescription}>{t('Возглавь легион. Разыгрывай заклинания, предугадывай чужие указы и решай, когда ударить, а когда сохранить силы.', 'Lead a legion. Cast spells, anticipate enemy edicts, and decide when to strike or hold your ground.')}</p>
          <div className={styles.mainActions}><Link href={`/arena?hero=${hero}`} className={styles.playButton}>{t('Играть', 'Play')} <span aria-hidden="true">→</span><small>{t('Выбрать режим', 'Choose a mode')}</small></Link><Link href="/library" className={styles.secondaryLink}>{t('Изучить карты', 'Explore the cards')} <span aria-hidden="true">↗</span></Link></div>
          <p className={styles.freeNote}>{t('Готовые колоды доступны сразу. Кошелёк и покупка карт для боя не нужны.', 'Starter decks are ready to play. No wallet or card purchases required.')}</p>
          <div className={styles.gameFacts}><span><b>{Object.keys(CARDS).length}</b>{t('карты', 'cards')}</span><span><b>{Object.keys(HEROES).length}</b>{t('правителя', 'rulers')}</span><span><b>30</b>{t('карт в колоде', 'cards per deck')}</span></div>
        </div>
        <div className={styles.tableau}>
          <div className={styles.tableauArch} aria-hidden="true" />
          <span className={styles.tableauInscription} aria-hidden="true">SENATVS · MEMES · POPVLVS</span>
          <div className={styles.cardFan}>{PREVIEW_CARDS.map((id, index) => <button type="button" key={id} className={styles.fanCard} style={{ '--card-index': index } as CSSProperties} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setInspected(id); }} aria-label={t(`Рассмотреть карту «${cardName(id)}»`, `Inspect ${cardName(id)}`)}><ArenaCardPreview id={id} locale={locale} label={cardName(id)} /></button>)}</div>
          <p className={styles.tableauCaption}>{t('Каждая карта — свой ход в истории.', 'Every card makes its own history.')}<small>{t('Нажми на карту, чтобы рассмотреть.', 'Select a card to inspect it.')}</small></p>
        </div>
      </section>

      <section className={styles.rulerSection} aria-labelledby="choose-ruler">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>{t('Твой первый легион', 'Your first legion')}</p><h2 id="choose-ruler">{t('Кто поведёт тебя в бой?', 'Who will lead you into battle?')}</h2></div><Link href="/library#rulers" className={styles.textLink}>{t('Все способности', 'All abilities')} <span aria-hidden="true">↗</span></Link></div>
        <HeroRoster selected={hero} onSelect={selectHero} />
        <div className={styles.rulerSelectionNote}><span>{t('Выбран правитель:', 'Selected ruler:')} <strong>{heroName(hero)}</strong></span><Link href={`/arena?hero=${hero}`} className={styles.textLink}>{t('Продолжить', 'Continue')} <span aria-hidden="true">→</span></Link></div>
      </section>

      <section className={styles.rulesSection} aria-labelledby="how-to-play"><div className={styles.sectionHeading}><div><p className={styles.kicker}>{t('Понятно за минуту', 'Learn in a minute')}</p><h2 id="how-to-play">{t('Три решения. Один победитель.', 'Three decisions. One victor.')}</h2></div><Link href="/library#rules" className={styles.textLink}>{t('Все правила', 'All rules')} <span aria-hidden="true">↗</span></Link></div><RulesGuide compact /></section>

      <section className={styles.collectionSection} aria-labelledby="collect-title"><div><p className={styles.kicker}>{t('За пределами арены', 'Beyond the arena')}</p><h2 id="collect-title">{t('Пополняй коллекцию.', 'Grow your collection.')}</h2><p>{t('Открывай паки из пяти карт, собирай коллекцию и настраивай собственную колоду. Это отдельная часть игры — готовые боевые колоды доступны бесплатно.', 'Open five-card packs, grow your collection, and tune your own deck. Collecting is a separate part of the game — starter battle decks are always free.')}</p><small>{t('Демо-паки используют локальные $RUG без денежной стоимости. NFT-функции в devnet доступны отдельно.', 'Demo packs use local $RUG with no cash value. Devnet NFT features are available separately.')}</small></div><div className={styles.collectionActions}><Link href="/packs" className={styles.secondaryButton}>{t('Открыть паки', 'Open packs')} <span aria-hidden="true">↗</span></Link><Link href="/collection" className={styles.textLink}>{t('Моя коллекция', 'My collection')} <span aria-hidden="true">→</span></Link></div></section>
    </main>
    <SiteFooter />
    {inspected && <CardDialog id={inspected} onClose={() => setInspected(null)} />}
  </div>;
}
