'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useLocale} from '../LocaleContext';
import styles from './ArenaLab.module.css';

export function ArenaOrientationHint({status}: {status?: string}) {
  const {t}=useLocale();
  const [fullscreenFailed,setFullscreenFailed]=useState(false);
  const expand=async()=>{
    try {
      if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
      const orientation=screen.orientation as ScreenOrientation & {lock?: (mode: string) => Promise<void>};
      if(orientation.lock)await orientation.lock('landscape');
    } catch {setFullscreenFailed(true);}
  };
  return <aside className={styles.orientationHint} aria-label={t('Горизонтальный режим боя','Landscape battle mode')}>
    <div className={styles.orientationPhone} aria-hidden="true"><span>IV</span></div>
    <h2>{t('Поверните телефон','Rotate your phone')}</h2>
    <p>{t('Арена играется горизонтально: так видны обе армии, рука и все действия. Меню и библиотека работают в любом положении.','Battles use landscape so both armies, your hand and all actions remain visible. Menus and the library work in either orientation.')}</p>
    {status&&<p className={styles.orientationStatus}>{status}</p>}
    <button type="button" onClick={()=>void expand()}>{t('Развернуть игру','Enter fullscreen')}</button>
    {fullscreenFailed&&<p role="status">{t('Поверните телефон вручную и отключите блокировку ориентации.','Rotate your phone manually and turn off orientation lock.')}</p>}
    <Link href="/arena">{t('К режимам игры','Back to game modes')}</Link>
  </aside>;
}
