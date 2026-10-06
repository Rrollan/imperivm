'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useLocale} from './LocaleContext';
import {HEROES} from '../lib/heroes';
import {heroPortraitPath} from './presentation/heroPortrait';
import {powerRules} from './presentation/rulesText';
import styles from './ArenaGates.module.css';

export default function ArenaGates(){
  const params=useSearchParams(),locale=useLocale();
  const [hero,setHero]=useState('builder');
  useEffect(()=>{const id=params.get('hero');if(id&&Object.hasOwn(HEROES,id))setHero(id);},[params]);
  const modes=[
    {id:'ai',title:locale.t('Против ИИ','Against AI'),text:locale.t('Освойте колоду и пробуйте связки без ожидания соперника.','Learn your deck and test combos without waiting for an opponent.'),detail:locale.t('Готовая колода · замена стартовой руки','Starter deck · opening hand replacement'),image:'training',action:locale.t('Начать тренировку','Start training'),href:`/arena-lab?hero=${hero}&opening=1`},
    {id:'friend',title:locale.t('С другом','With a friend'),text:locale.t('Создайте комнату и отправьте другу код или ссылку. Оба играют своими колодами.','Create a room and send your friend its code or link. Each player has their own deck.'),detail:locale.t('Код из 6 символов · 75 секунд на ход','6-character code · 75 seconds per turn'),image:'custom',action:locale.t('Создать или войти','Create or join'),href:`/play?mode=friend&hero=${hero}`},
    {id:'random',title:locale.t('Случайный соперник','Random opponent'),text:locale.t('Встаньте в очередь. Бой начнётся, когда найдётся другой игрок.','Join the queue. Battle starts when another player is found.'),detail:locale.t('Живой игрок · без рейтинга','Live player · unranked'),image:'duel',action:locale.t('Найти соперника','Find an opponent'),href:`/play?mode=random&hero=${hero}`},
  ];
  return <main className={styles.page}>
    <nav className={styles.navigation} aria-label={locale.t('Навигация','Navigation')}><Link href="/">IMPERIVM</Link><Link href="/library">{locale.t('Карты и правители','Cards and rulers')}</Link><button onClick={()=>locale.setLocale(locale.locale==='ru'?'en':'ru')} aria-label={locale.t('Switch to English','Переключить на русский')}>{locale.locale==='ru'?'EN':'РУ'}</button></nav>
    <header className={styles.heading}><p>{locale.t('Врата империи','Gates of the empire')}</p><h1>{locale.t('Выберите свой бой','Choose your battle')}</h1><span>{locale.t('Приказы — ваш ресурс. Поле — ваша территория. Решение — за вами.','Orders are your resource. The court is your territory. The decision is yours.')}</span></header>
    <section className={styles.heroes} aria-labelledby="ruler-choice"><div><h2 id="ruler-choice">{locale.t('Ваш правитель','Your ruler')}</h2><p>{locale.t('Четыре силы. Четыре стартовые колоды.','Four powers. Four starter decks.')}</p></div><div className={styles.heroOptions}>{Object.values(HEROES).map(h=><button key={h.id} className={styles.hero} aria-pressed={hero===h.id} onClick={()=>setHero(h.id)}><img src={heroPortraitPath(h.id)} alt=""/><strong>{locale.heroName(h.id)}</strong></button>)}</div><div className={styles.heroBrief} aria-live="polite"><strong>{locale.powerName(hero)} · {HEROES[hero].powerCost} {locale.t('приказа','orders')}</strong><p>{powerRules(hero,locale.locale)} {locale.t('Один раз за ход.','Once per turn.')}</p></div></section>
    <section className={styles.modes} aria-label={locale.t('Режимы игры','Game modes')}>{modes.map(mode=><article key={mode.id} className={styles.mode}><div className={styles.modeArt} style={{backgroundImage:`url('/ui/portals/${mode.image}.webp')`}} aria-hidden="true"/><div className={styles.modeCopy}><span className={styles.modeNumber}>{mode.id==='ai'?'I':mode.id==='friend'?'II':'III'}</span><h2>{mode.title}</h2><p>{mode.text}</p><small>{mode.detail}</small><Link href={mode.href}>{mode.action}<span aria-hidden="true">→</span></Link></div></article>)}</section>
    <footer className={styles.footer}><p>{locale.t('Стартовые колоды доступны бесплатно. Кошелёк и паки не нужны, чтобы сыграть.','Starter decks are free. You do not need a wallet or packs to play.')}</p><Link href="/library#rules">{locale.t('Как играть','How to play')} →</Link></footer>
  </main>;
}
