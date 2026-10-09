'use client';
import {useEffect,useState} from 'react';
import {useIDos} from '../IDosContext';
import {useCollection} from '../CollectionContext';
import {useLocale} from '../LocaleContext';
import {CASE_HERO_IDS} from '../../lib/heroes';
import {collectionPrice,IDOS_CONFIG,type RulerCaseResult} from '../../lib/collection/gateway';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {powerRules} from '../presentation/rulesText';
import {PaintedIcon} from '../PaintedIcon';
import styles from './RulerCase.module.css';
import {PurchaseConfirm} from './PurchaseConfirm';
import {cryptoAffordable, COMMERCE_CONFIG} from '../../lib/idos/commerce';
export function RulerCase(){
  const collection=useCollection(),{t,locale,heroName,powerName}=useLocale();const [result,setResult]=useState<RulerCaseResult|null>(null),[revealed,setRevealed]=useState(false),[error,setError]=useState('');
  const [confirm,setConfirm]=useState(false);
  const idos=useIDos();
  useEffect(()=>{setConfirm(false);setResult(null);setRevealed(false);setError('');},[idos.session.revision]);
  const paid=collection.snapshot?.mode==='idos',cost=collectionPrice(collection.snapshot?.mode,'ruler'),price=new Intl.NumberFormat('ru-RU').format(cost);
  const affordable=!!collection.snapshot&&cryptoAffordable(collection.snapshot.exactBalance??String(collection.snapshot.rug),String(cost));
  async function open(){setError('');try{const drop=await collection.openRulerCase();setResult(drop);setRevealed(false);}catch(e){setError(e instanceof Error?e.message:t('Кейс недоступен','Case unavailable'));}}
  return <section id="rulers" className={styles.case} aria-label={t('Кейсы предводителей','Ruler cases')}><h2><PaintedIcon name="heroes" size={42}/>{t('Предводители Олимпа','Rulers of Olympus')}</h2><p>{t('Сильные связки. Новые способы побеждать.','Powerful combinations. New ways to win.')}</p>
    <div className={styles.roster}>{CASE_HERO_IDS.map(id=><div key={id}><img src={heroPortraitPath(id)} alt="" loading="lazy"/><strong>{heroName(id)}</strong><small>{collection.snapshot?.heroes?.includes(id)?t('Открыт','Unlocked'):'25%'}</small></div>)}</div>
    {result&&<div className={styles.result}>{revealed?<><img src={heroPortraitPath(result.heroId)} alt="" className={styles.revealed}/><h3>{heroName(result.heroId)}</h3><strong>{powerName(result.heroId)}</strong><p>{powerRules(result.heroId,locale)}</p><small>{result.duplicate?t('Повтор · +100 валюты коллекции','Duplicate · +100 collection currency'):t('Правитель открыт для ваших колод','Ruler unlocked for your decks')}</small></>:<button onClick={()=>setRevealed(true)} className={styles.reveal}><PaintedIcon name="heroes" size={90}/>{t('Раскрыть предводителя','Reveal your ruler')}</button>}</div>}
    <button className={styles.buy} onClick={()=>paid?setConfirm(true):void open()} disabled={collection.snapshot?.mode==='idos'&&!IDOS_CONFIG.rulerCasesEnabled||collection.busy||!collection.snapshot||!affordable||!!collection.snapshot.purchaseBlocked||(paid&&!COMMERCE_CONFIG.enabled)||!!result&&!revealed}><PaintedIcon name="pack" size={32}/>{collection.snapshot?.mode==='idos'&&!IDOS_CONFIG.rulerCasesEnabled?t('Скоро в iDos','Coming to iDos'):collection.busy?t('Проверяем кейс…','Checking case…'):`${t('Открыть кейс','Open case')} · ${price} ${paid?'IMP':t('демо IMP','demo IMP')}`}</button>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <details><summary>{t('Условия и шансы','Conditions & odds')}</summary><p>{t('Один из четырёх правителей с равными шансами 25%. Повтор даёт 100 валюты коллекции, а не IMP. Пять основных правителей бесплатны. Все начинают с 30 здоровья.','One of four rulers, each at 25%. A duplicate grants 100 collection currency, not IMP. Five base rulers are free. Everyone starts at 30 health.')}</p><p>{collection.snapshot?.mode==='local'?t('Демо-кейсы сохраняются только в этом браузере. Для правителей из кейсов в PvP нужна подтверждённая коллекция iDos.','Demo cases are local to this browser. Case rulers in PvP require verified iDos ownership.'):t('iDos проверяет цену и выдаёт правителя на сервере. Если кейс ещё не настроен, покупка отклоняется до оплаты.','iDos verifies the price and grants the ruler on the server. Unconfigured cases are blocked before payment.')}</p></details>
    {confirm&&<PurchaseConfirm kind="ruler" amount={cost} onClose={()=>setConfirm(false)} onConfirm={()=>{setConfirm(false);void open();}}/>}
  </section>;
}
