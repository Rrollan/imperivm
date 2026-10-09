'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CARDS } from '../../lib/cards';
import { isInstantSpell } from '../../lib/engine/spellTiming';
import { useLocale } from '../../components/LocaleContext';
import { cardRules } from '../../components/presentation/rulesText';
import { roleName } from '../../components/presentation/cardIdentity';
import { CardDialog } from '../../components/home/CardDialog';
import {CardFacts} from '../../components/home/CardFacts';
import { LibraryCardFace } from '../../components/home/LibraryCardFace';
import { RulerLibrary } from '../../components/home/HeroRoster';
import { RulesGuide } from '../../components/home/RulesGuide';
import { SiteFooter, SiteHeader } from '../../components/home/SiteChrome';
import {PaintedIcon} from '../../components/PaintedIcon';
import {RomanIcon} from '../../components/presentation/RomanIcon';
import {HEROES} from '../../lib/heroes';
import styles from '../../components/home/Home.module.css';

const ALL_CARDS = Object.values(CARDS).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
const ABILITY_SEARCH: Record<string, string> = {
  'heal-own-minions': 'лечение исцеление восстановление heal healing restoration',
  'heal-treasury': 'лечение исцеление восстановление heal healing restoration',
  'draw': 'добор карты draw cards',
  'weaken-random-enemy': 'дебаф ослабление debuff weaken',
  'buff-own': 'баф усиление buff boost',
  'damage-all-enemy-minions': 'урон зачистка aoe damage clear',
  'damage-random-enemy': 'урон damage',
  'damage-enemy-treasury': 'урон damage face',
  'counter-mempool': 'отмена counter',
  'gain-gas': 'приказы ресурс orders resource',
  'rugpull': 'зачистка уничтожение clear destroy',
  'summon': 'призыв summon',
};
type Section = 'cards' | 'rulers' | 'rules';

export default function LibraryPage() {
  const { t, locale, cardName, rarityName } = useLocale();
  const [section, setSection] = useState<Section>('cards'), [query, setQuery] = useState(''), [faction, setFaction] = useState('all'), [kind, setKind] = useState('all'), [rarity, setRarity] = useState('all'), [inspected, setInspected] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => { const hash = window.location.hash.slice(1); const value = hash.startsWith('/') ? hash.split('#')[1] : hash; if (value === 'rulers' || value === 'rules' || value === 'cards') setSection(value); };
    sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);
  function selectSection(value: Section) { setSection(value); window.history.replaceState(null, '', process.env.NEXT_PUBLIC_IDOS_STATIC_BUILD === 'true' ? `#/library#${value}` : `#${value}`); }
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase(locale);
    return ALL_CARDS.filter(card => {
      const matchesKind = kind === 'all' || (kind === 'minion' && card.type === 'minion') || (kind === 'instant' && isInstantSpell(card)) || (kind === 'edict' && card.type === 'spell' && !isInstantSpell(card));
      const synonyms = [card.spell?.kind, card.battlecry?.kind].map(effect => effect ? ABILITY_SEARCH[effect] ?? '' : '').join(' ');
      const haystack = `${cardName(card.id)} ${card.name} ${cardRules(card.id, locale)} ${roleName(card.id, locale)} ${card.faction} ${synonyms}`.toLocaleLowerCase(locale);
      return (faction === 'all' || card.faction === faction) && (rarity === 'all' || card.rarity === rarity) && matchesKind && haystack.includes(search);
    });
    // Locale functions are derived from locale and do not need to invalidate on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, faction, kind, rarity, locale]);
  function reset() { setQuery(''); setFaction('all'); setKind('all'); setRarity('all'); }
  const filtered = query !== '' || faction !== 'all' || kind !== 'all' || rarity !== 'all';
  return <div className={styles.shell}>
    <SiteHeader active="library" />
    <main className={`${styles.main} ${styles.libraryMain}`}>
      <header className={styles.libraryHeading}><div><p className={styles.kicker}>{t('Знай свой легион', 'Know your legion')}</p><h1>{t('Библиотека', 'The library')}</h1><p>{t('Нажми на карту — изучи способности.', 'Tap a card to explore its abilities.')}</p></div><Link href="/arena?hero=builder" className={styles.secondaryButton}>{t('На арену', 'To the arena')} <PaintedIcon name="play" size={38}/></Link></header>
      <div className={styles.libraryTabs} role="group" aria-label={t('Раздел библиотеки', 'Library section')}>{(['cards', 'rulers', 'rules'] as const).map(value => <button key={value} type="button" aria-pressed={value === section} onClick={() => selectSection(value)}><PaintedIcon name={value==='cards'?'cards':value==='rulers'?'heroes':'rules'} size={34}/>{value === 'cards' ? t('Карты', 'Cards') : value === 'rulers' ? t('Правители', 'Rulers') : t('Правила', 'Rules')}<small>{value === 'cards' ? ALL_CARDS.length : value === 'rulers' ? Object.keys(HEROES).length : 'I–III'}</small></button>)}</div>

      {section === 'cards' && <section aria-label={t('Каталог карт', 'Card catalogue')}>
        <div className={styles.libraryFilters}>
          <label className={styles.searchLabel}><span>{t('Поиск карт', 'Search cards')}</span><input type="search" placeholder={t('Например: лечение, Натиск…', 'Try: heal, Rush…')} value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label><span>{t('Фракция', 'Faction')}</span><select value={faction} onChange={event => setFaction(event.target.value)}><option value="all">{t('Все фракции', 'All factions')}</option>{['DeFi', 'NFT', 'DePIN', 'Meme'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
          <label><span>{t('Тип карты', 'Card type')}</span><select value={kind} onChange={event => setKind(event.target.value)}><option value="all">{t('Все типы', 'All types')}</option><option value="minion">{t('Бойцы', 'Fighters')}</option><option value="instant">{t('Мгновенные', 'Instant spells')}</option><option value="edict">{t('Указы', 'Edicts')}</option></select></label>
          <label><span>{t('Редкость', 'Rarity')}</span><select value={rarity} onChange={event => setRarity(event.target.value)}><option value="all">{t('Все редкости', 'All rarities')}</option>{(['common', 'rare', 'epic', 'legendary'] as const).map(value => <option value={value} key={value}>{rarityName(value)}</option>)}</select></label>
        </div>
        <div className={styles.catalogueStatus}><p role="status" aria-live="polite">{t(`Показано ${visible.length} из ${ALL_CARDS.length} карт`, `Showing ${visible.length} of ${ALL_CARDS.length} cards`)}<span>{t('По возрастанию стоимости', 'Sorted by cost')}</span></p>{filtered && <button type="button" onClick={reset}>{t('Сбросить фильтры', 'Reset filters')}</button>}</div>
        {visible.length > 0 ? <div className={styles.cardGrid}>{visible.map(card => <button key={card.id} className={styles.catalogueCard} type="button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setInspected(card.id); }} aria-label={t(`Рассмотреть карту «${cardName(card.id)}»`, `Inspect ${cardName(card.id)}`)}><LibraryCardFace id={card.id} /><CardFacts compact id={card.id} /></button>)}</div> : <div className={styles.emptyState}><h2>{t('Такой карты пока нет.', 'No cards match.')}</h2><p>{t('Попробуй другое название или убери часть фильтров.', 'Try a different name or remove some filters.')}</p><button type="button" className={styles.secondaryButton} onClick={reset}>{t('Показать все карты', 'Show all cards')}</button></div>}
        <p className={styles.catalogueNote}>{t('Библиотека показывает полный набор карт. Владение картами и сохранённая колода находятся в ', 'The library shows the full card set. Ownership and your saved deck live in the ')}<Link href="/collection">{t('коллекции', 'collection')}</Link>.</p>
      </section>}
      {section === 'rulers' && <section aria-label={t('Все правители', 'All rulers')}><RulerLibrary /><p className={styles.catalogueNote}>{t('У каждого правителя своя сила и готовая колода из 30 карт. Силу можно применить один раз за свой ход.', 'Every ruler has a unique power and a 30-card starter deck. Use the power once on each of your turns.')}</p></section>}
      {section === 'rules' && <section aria-label={t('Правила игры', 'Game rules')}><RulesGuide /></section>}
    </main>
    <SiteFooter />
    {inspected && <CardDialog id={inspected} onClose={() => setInspected(null)} />}
  </div>;
}
