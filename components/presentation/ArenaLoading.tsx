'use client';
import {useEffect,useState} from 'react';
import {useLocale} from '../LocaleContext';
import styles from './ArenaLoading.module.css';
import {useReducedMotion} from '../../lib/prefersReducedMotion';

const tips=[
  ['Вторая карта одной фракции за ход возвращает 1 приказ.','Your second card of the same faction refunds 1 order.'],
  ['Бирюзовые уголки: боец готов атаковать. Нажмите на него и выберите цель.','Teal corners: a fighter is ready. Tap it, then choose a target.'],
  ['Мгновенные заклинания действуют сразу. Указы — в начале следующего вашего хода.','Instant spells resolve now. Edicts resolve at the start of your next turn.'],
  ['Провокация защищает правителя. Сначала уберите бойцов со щитом.','Taunt protects the ruler. Remove the shielded fighters first.'],
  ['Стейкинг приносит приказы, но боец временно не атакует.','Staking earns orders, but the fighter cannot attack.'],
  ['Второй игрок получает 1 дополнительный приказ в первом ходу.','The second player gets 1 extra order on their first turn.'],
  ['Колода пуста? Нажмите на книгу: дополнительная карта стоит 2 приказа.','Empty deck? Tap the book: a reserve card costs 2 orders.'],
] as const;
export function ArenaLoading({preview=false}:{preview?:boolean}){
  const {t}=useLocale(),reduced=useReducedMotion();const [tip,setTip]=useState(0),[videoReady,setVideoReady]=useState(false),[videoFailed,setVideoFailed]=useState(false);
  useEffect(()=>{const timer=setInterval(()=>setTip(value=>(value+1)%tips.length),6500);return()=>clearInterval(timer);},[]);
  return <div className={styles.loading} data-reduced={reduced} role="status" aria-live="polite">
    <img className={styles.scene} src="/ui/loading/arena-gates-v1/START.webp" alt="" fetchPriority="high"/>
    {!reduced&&!videoFailed&&<video className={`${styles.scene} ${styles.video}`} data-playing={videoReady} src="/ui/loading/arena-gates-v1/loop-v1.mp4" poster="/ui/loading/arena-gates-v1/START.webp" autoPlay muted playsInline loop preload="auto" aria-hidden="true" onPlaying={()=>setVideoReady(true)} onError={()=>{setVideoFailed(true);setVideoReady(false);}}/>}
    {!videoReady&&<div className={styles.motes} aria-hidden="true"><i/><i/><i/><i/><i/></div>}
    <div className={styles.copy}><img src="/ui/menu/imperivm-wordmark-v1.png" alt="IMPERIVM" className={styles.logo}/><p className={styles.label}>{preview?t('Врата арены','Arena gates'):t('Готовим поле боя…','Preparing the battlefield…')}</p><span className={styles.progress} aria-hidden="true"/><p className={styles.tip} key={tip}>{t(tips[tip][0],tips[tip][1])}</p></div>
  </div>;
}
