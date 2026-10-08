'use client';
import Link from 'next/link';
import {useEffect,useState,type CSSProperties} from 'react';
import {HEROES} from '../../lib/heroes';
import {useLocale} from '../LocaleContext';
import {ArenaCardPreview} from '../presentation/ArenaCardPreview';
import {HeroRoster} from './HeroRoster';
import {SiteFooter,SiteHeader} from './SiteChrome';
import {CardDialog} from './CardDialog';
import {PaintedIcon} from '../PaintedIcon';
import {RomanIcon} from '../presentation/RomanIcon';
import styles from './Home.module.css';
import menu from './HomeMenu.module.css';

const PREVIEW_CARDS=['solar-sapper','imperator-liquidus','restoration-rite'];
const HERO_KEY='imperivm.home.hero';
export default function HomeScreen(){
  const {t,locale,cardName}=useLocale();
  const [hero,setHero]=useState('builder'),[inspected,setInspected]=useState<string|null>(null);
  useEffect(()=>{try{const saved=localStorage.getItem(HERO_KEY);if(saved&&HEROES[saved])setHero(saved);}catch{}},[]);
  function selectHero(id:string){setHero(id);try{localStorage.setItem(HERO_KEY,id);}catch{}}
  return <div className={styles.shell}><SiteHeader/><main className={menu.main}>
    <section className={menu.hero} aria-labelledby="home-title">
      <div className={menu.copy}><p className={menu.kicker}>Roman · Crypto · Tactics</p><h1 id="home-title">{t('Твой легион.','Your legion.')}<span>{t('Твой ход.','Your move.')}</span></h1><p>{t('Собери связку. Перехитри соперника.','Build a combo. Outplay your opponent.')}</p><Link href={`/arena?hero=${hero}`} className={menu.play}><PaintedIcon name="play" size={42}/>{t('Играть','Play')}<RomanIcon name="next" size={22}/></Link><small>{t('Бесплатная колода уже готова.','Your free starter deck is ready.')}</small></div>
      <div className={menu.fan}>{PREVIEW_CARDS.map((id,index)=><button type="button" key={id} className={menu.fanCard} style={{'--card-index':index} as CSSProperties} onClick={event=>{event.currentTarget.focus({preventScroll:true});setInspected(id);}} aria-label={t(`Рассмотреть карту «${cardName(id)}»`,`Inspect ${cardName(id)}`)}><ArenaCardPreview id={id} locale={locale} label={cardName(id)}/></button>)}<span className={menu.fanHint}>{t('Нажми на карту — узнай её силу.','Tap a card to discover its power.')}</span></div>
    </section>
    <section className={menu.rulers} aria-labelledby="choose-ruler"><h2 id="choose-ruler">{t('Выбери правителя','Choose your ruler')}</h2><HeroRoster compact selected={hero} onSelect={selectHero}/></section>
    <nav className={menu.shortcuts} aria-label={t('Подготовка к бою','Prepare for battle')}>
      <Link href="/library"><PaintedIcon name="library" size={56}/><span><strong>{t('Карты','Cards')}</strong><small>{t('Способности','Abilities')}</small></span></Link>
      <Link href="/collection"><PaintedIcon name="cards" size={56}/><span><strong>{t('Колоды','Decks')}</strong><small>{t('Собери свою связку','Build your combo')}</small></span></Link>
      <Link href="/packs"><PaintedIcon name="pack" size={56}/><span><strong>{t('Паки','Packs')}</strong><small>{t('Пять новых карт','Five new cards')}</small></span></Link>
    </nav>
    <details className={menu.help}><summary>{t('Первый раз в игре?','New to the game?')}</summary><p>{t('Выбери правителя и нажми «Играть». Начни с тренировки или позови друга. Кошелёк для бесплатного боя не нужен.','Choose a ruler and tap Play. Train or invite a friend. Free matches do not require a wallet.')}</p><Link href="/library#rules">{t('Короткие правила →','Quick rules →')}</Link></details>
  </main><SiteFooter/>{inspected&&<CardDialog id={inspected} onClose={()=>setInspected(null)}/>}</div>;
}
