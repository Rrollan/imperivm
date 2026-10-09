'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useLocale} from './LocaleContext';
import {useCollection} from './CollectionContext';
import {isFreeHero,HEROES} from '../lib/heroes';
import {heroPortraitPath} from './presentation/heroPortrait';
import {powerRules} from './presentation/rulesText';
import {PaintedIcon} from './PaintedIcon';
import {ImperivmLogo} from './ImperivmLogo';
import styles from './ArenaGates.module.css';

export default function ArenaGates(){
  const params=useSearchParams(),locale=useLocale(),collection=useCollection();
  const [hero,setHero]=useState('builder');
  useEffect(()=>{const id=params.get('hero');if(id&&Object.hasOwn(HEROES,id))setHero(id);},[params]);
  const modes=[
    {id:'ai',title:locale.t('Против ИИ','Against AI'),text:locale.t('Освойте колоду и пробуйте связки без ожидания соперника.','Learn your deck and test combos without waiting for an opponent.'),detail:locale.t('Готовая колода · замена стартовой руки','Starter deck · opening hand replacement'),image:'training',action:locale.t('Начать тренировку','Start training'),href:`/arena-lab?hero=${hero}&opening=1`},
    {id:'friend',title:locale.t('С другом','With a friend'),text:locale.t('Создайте комнату и отправьте другу код или ссылку. Оба играют своими колодами.','Create a room and send your friend its code or link. Each player has their own deck.'),detail:locale.t('Код из 6 символов · 75 секунд на ход','6-character code · 75 seconds per turn'),image:'custom',action:locale.t('Создать или войти','Create or join'),href:`/play?mode=friend&hero=${hero}`},
    {id:'random',title:locale.t('Случайный соперник','Random opponent'),text:locale.t('Встаньте в очередь. Бой начнётся, когда найдётся другой игрок.','Join the queue. Battle starts when another player is found.'),detail:locale.t('Живой игрок · без рейтинга','Live player · unranked'),image:'duel',action:locale.t('Найти соперника','Find an opponent'),href:`/play?mode=random&hero=${hero}`},
  ];
  return <main className={styles.page}>
    <nav className={styles.navigation} aria-label={locale.t('Навигация','Navigation')}><Link href="/" aria-label="IMPERIVM"><ImperivmLogo/></Link><Link href="/library"><PaintedIcon name="library" size={30}/>{locale.t('Карты и правители','Cards and rulers')}</Link><button onClick={()=>locale.setLocale(locale.locale==='ru'?'en':'ru')} aria-label={locale.t('Switch to English','Переключить на русский')}>{locale.locale==='ru'?'EN':'РУ'}</button></nav>
    <header className={styles.heading}><p>{locale.t('Врата империи','Gates of the empire')}</p><h1>{locale.t('Выберите свой бой','Choose your battle')}</h1><span>{locale.t('Приказы — ваш ресурс. Поле — ваша территория. Решение — за вами.','Orders are your resource. The court is your territory. The decision is yours.')}</span></header>
    <section className={styles.heroes} aria-labelledby="ruler-choice">
      <div className={styles.heroHeading}><h2 id="ruler-choice">{locale.t('Ваш правитель','Your ruler')}</h2><p>{locale.t('Выберите стиль своей колоды','Choose your deck’s playstyle')}</p></div>
      <div className={styles.heroOptions}>{(['free','case'] as const).map(access=><div key={access} className={styles.heroGroup} data-access={access}>
        <h3>{access==='free'?locale.t('Стартовые · 5','Starters · 5'):locale.t('Из кейсов · 4','From cases · 4')}</h3>
        <div>{Object.values(HEROES).filter(h=>h.access===access).map(h=>{
          const locked=!isFreeHero(h.id)&&!collection.snapshot?.heroes?.includes(h.id);
          return <button key={h.id} className={styles.hero} disabled={locked} aria-pressed={hero===h.id} aria-label={`${locale.heroName(h.id)}${locked?locale.t(' · из кейса',' · from cases'):''}`} onClick={()=>setHero(h.id)}><img src={heroPortraitPath(h.id)} alt=""/><strong>{locale.heroName(h.id)}</strong></button>;
        })}</div>
      </div>)}</div>
      <div className={styles.heroBrief} aria-live="polite"><img src={heroPortraitPath(hero)} alt=""/><div><strong>{locale.powerName(hero)} <span>· {HEROES[hero].powerCost} {locale.t('приказа','orders')}</span></strong><p>{powerRules(hero,locale.locale)} {locale.t('Один раз за ход.','Once per turn.')}</p></div></div>
    </section>
    <section className={styles.modes} aria-label={locale.t('Режимы игры','Game modes')}>{modes.filter(mode=>process.env.NEXT_PUBLIC_IDOS_STATIC_BUILD!=='true'||mode.id!=='random').map(mode=><article key={mode.id} className={styles.mode}><div className={styles.modeArt} style={{backgroundImage:`url('/ui/portals/${mode.image}.webp')`}} aria-hidden="true"/><div className={styles.modeCopy}><span className={styles.modeNumber}>{mode.id==='ai'?'I':mode.id==='friend'?'II':'III'}</span><h2>{mode.title}</h2><p>{mode.text}</p><small>{mode.detail}</small><Link href={mode.href}>{mode.action}<PaintedIcon name="play" size={32}/></Link></div></article>)}</section>
    <footer className={styles.footer}><p>{locale.t('Стартовые колоды доступны бесплатно. Кошелёк и паки не нужны, чтобы сыграть.','Starter decks are free. You do not need a wallet or packs to play.')}</p><Link href="/library#rules"><PaintedIcon name="library" size={30}/>{locale.t('Как играть','How to play')}</Link></footer>
  </main>;
}
