'use client';
import {useState} from 'react';
import {useCollection} from '../CollectionContext';
import {useLocale} from '../LocaleContext';
import {CASE_HERO_IDS} from '../../lib/heroes';
import {RULER_CASE_COST,IDOS_CONFIG,type RulerCaseResult} from '../../lib/collection/gateway';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {powerRules} from '../presentation/rulesText';
import {PaintedIcon} from '../PaintedIcon';
import styles from './RulerCase.module.css';
export function RulerCase(){
  const collection=useCollection(),{t,locale,heroName,powerName}=useLocale();const [result,setResult]=useState<RulerCaseResult|null>(null),[revealed,setRevealed]=useState(false),[error,setError]=useState('');
  async function open(){setError('');try{const drop=await collection.openRulerCase();setResult(drop);setRevealed(false);}catch(e){setError(e instanceof Error?e.message:t('Кейс недоступен','Case unavailable'));}}
  return <section id="rulers" className={styles.case} aria-label={t('Кейсы предводителей','Ruler cases')}><h2><PaintedIcon name="heroes" size={42}/>{t('Предводители Олимпа','Rulers of Olympus')}</h2><p>{t('Сильные связки. Новые способы побеждать.','Powerful combinations. New ways to win.')}</p>
    <div className={styles.roster}>{CASE_HERO_IDS.map(id=><div key={id}><img src={heroPortraitPath(id)} alt="" loading="lazy"/><strong>{heroName(id)}</strong><small>{collection.snapshot?.heroes?.includes(id)?t('Открыт','Unlocked'):'25%'}</small></div>)}</div>
    {result&&<div className={styles.result}>{revealed?<><img src={heroPortraitPath(result.heroId)} alt="" className={styles.revealed}/><h3>{heroName(result.heroId)}</h3><strong>{powerName(result.heroId)}</strong><p>{powerRules(result.heroId,locale)}</p><small>{result.duplicate?t('Повтор · +100 валюты коллекции','Duplicate · +100 collection currency'):t('Правитель открыт для ваших колод','Ruler unlocked for your decks')}</small></>:<button onClick={()=>setRevealed(true)} className={styles.reveal}><PaintedIcon name="heroes" size={90}/>{t('Раскрыть предводителя','Reveal your ruler')}</button>}</div>}
    <button className={styles.buy} onClick={()=>void open()} disabled={collection.snapshot?.mode==='idos'&&!IDOS_CONFIG.rulerCasesEnabled||collection.busy||!collection.snapshot||collection.snapshot.rug<RULER_CASE_COST||!!result&&!revealed}><PaintedIcon name="pack" size={32}/>{collection.snapshot?.mode==='idos'&&!IDOS_CONFIG.rulerCasesEnabled?t('Скоро в iDos','Coming to iDos'):collection.busy?t('Проверяем кейс…','Checking case…'):t('Открыть кейс · 200 $IMP','Open case · 200 $IMP')}</button>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <details><summary>{t('Условия и шансы','Conditions & odds')}</summary><p>{t('Один из четырёх правителей с равными шансами 25%. Повтор даёт 100 валюты коллекции, а не IMP. Пять основных правителей бесплатны. Все начинают с 30 здоровья.','One of four rulers, each at 25%. A duplicate grants 100 collection currency, not IMP. Five base rulers are free. Everyone starts at 30 health.')}</p><p>{collection.snapshot?.mode==='local'?t('Демо-кейсы сохраняются только в этом браузере. Для правителей из кейсов в PvP нужна подтверждённая коллекция iDos.','Demo cases are local to this browser. Case rulers in PvP require verified iDos ownership.'):t('iDos проверяет цену и выдаёт правителя на сервере. Если кейс ещё не настроен, покупка отклоняется до оплаты.','iDos verifies the price and grants the ruler on the server. Unconfigured cases are blocked before payment.')}</p></details>
  </section>;
}
