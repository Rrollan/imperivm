'use client';
import {useEffect,useState} from 'react';
import {useLocale} from '../LocaleContext';
import {useAnimationPreference} from '../../lib/prefersReducedMotion';
import {hapticsEnabled,setHapticsEnabled} from '../../lib/haptics';
export function ArenaFeedbackSettings(){
  const {t}=useLocale();
  const [animations,setAnimations]=useAnimationPreference();
  const [vibration,setVibration]=useState(false),[supported,setSupported]=useState(false);
  useEffect(()=>{setSupported(typeof navigator.vibrate==='function');setVibration(hapticsEnabled());},[]);
  return <>
    <button type="button" aria-pressed={animations} onClick={()=>setAnimations(!animations)}>{t('Анимации:','Animations:')} {animations?t('включены','on'):t('выключены','off')}</button>
    {supported&&<button type="button" aria-pressed={vibration} onClick={()=>{setHapticsEnabled(!vibration);setVibration(!vibration);}}>{t('Вибрация:','Haptics:')} {vibration?t('включена','on'):t('выключена','off')}</button>}
  </>;
}
