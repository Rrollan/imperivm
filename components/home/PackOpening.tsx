'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {CardDef} from '../../lib/engine/types';
import {cardArtPath} from '../../lib/cardArt';
import {useReducedMotion} from '../../lib/prefersReducedMotion';
import {cardFramePath} from '../presentation/cardFace';
import {useLocale} from '../LocaleContext';
import {PaintedIcon} from '../PaintedIcon';
import {RomanIcon} from '../presentation/RomanIcon';
import {cardRules} from '../presentation/rulesText';
import {LibraryCardFace} from './LibraryCardFace';
import {play} from '../../lib/audio/sfx';
import styles from './PackOpening.module.css';

export const PACK_SPIN_MS=2600;
export const PACK_FLIP_MS=1100;
const BACK='/ui/arena-lab/native/card-back-native.webp';
const SLOT='/ui/menu/imperivm-fortune-slot-v1.png';
const colors={common:'#d0b084',rare:'#26d5ff',epic:'#ce72ff',legendary:'#ffc64f'};
type Phase='cards'|'summary';
/** A presentation of an already confirmed grant. Spinning and replay never roll or buy cards. */
export function PackOpening({cards,duplicates,onInspect,onComplete,onReplayStart,preview=false}:{cards:CardDef[];duplicates:boolean[];onInspect:(id:string)=>void;onComplete:()=>void;onReplayStart:()=>void;preview?:boolean}){
  const {t,locale,cardName,rarityName}=useLocale();
  const root=useRef<HTMLElement>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]),completed=useRef(false),revealedCount=useRef(0),locked=useRef(true),pending=useRef<number|null>(null),preparing=useRef(true);
  const reduced=useReducedMotion();
  const [phase,setPhase]=useState<Phase>('cards'),[revealed,setRevealed]=useState(0),[busy,setBusy]=useState(true),[rolling,setRolling]=useState(false),[iteration,setIteration]=useState(0);
  function later(action:()=>void,delay:number){timers.current.push(setTimeout(action,delay));}
  function cancel(){timers.current.forEach(clearTimeout);timers.current=[];}
  function lock(value:boolean){locked.current=value;setBusy(value);}
  function complete(){if(!completed.current){completed.current=true;onComplete();}}
  function scrollStage(){root.current?.scrollIntoView({block:'start',behavior:'instant'});}
  function finishReveal(next:number){pending.current=null;revealedCount.current=next;setRolling(false);setRevealed(next);play('card-reveal');}
  function unlockReveal(next:number){lock(false);if(next===cards.length)complete();}
  function summary(){cancel();pending.current=null;revealedCount.current=cards.length;setRolling(false);setPhase('summary');setRevealed(cards.length);lock(false);complete();}
  useEffect(()=>{
    let live=true;
    completed.current=false;pending.current=null;preparing.current=true;revealedCount.current=0;setRevealed(0);setRolling(false);setPhase('cards');lock(true);
    root.current?.focus({preventScroll:true});scrollStage();
    // Warm the real grant's art and painted frames before the first flip.
    const sources=new Set([BACK,SLOT,...cards.flatMap(card=>[cardArtPath(card.id),cardFramePath(card.rarity)])]);
    const loads=Array.from(sources,src=>new Promise<void>(resolve=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>resolve();image.src=src;}));
    const ready=()=>{if(live&&preparing.current){preparing.current=false;cancel();lock(false);}};
    later(ready,2500);void Promise.all(loads).then(ready);
    return()=>{live=false;cancel();};
    // New grants remount this component; replay keeps the same cards and never calls purchase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[iteration]);
  useEffect(()=>{
    if(reduced){preparing.current=false;cancel();if(pending.current!==null){const next=pending.current;finishReveal(next);unlockReveal(next);}else lock(false);}
    // Device and saved app preferences share the same cancellation path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[reduced]);
  useEffect(()=>{
    // Changing copy length must not anchor the focused button below the card.
    const frame=requestAnimationFrame(scrollStage);
    return()=>cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rolling,revealed,phase]);
  function reveal(){
    if(locked.current||phase!=='cards'||revealedCount.current>=cards.length)return;
    const next=revealedCount.current+1;pending.current=next;lock(true);root.current?.focus({preventScroll:true});scrollStage();
    if(reduced){finishReveal(next);unlockReveal(next);return;}
    setRolling(true);play('pack-open');
    later(()=>finishReveal(next),PACK_SPIN_MS);
    const rarity=cards[next-1].rarity,hold=rarity==='legendary'?1000:rarity==='epic'?350:0;
    later(()=>unlockReveal(next),PACK_SPIN_MS+PACK_FLIP_MS+hold);
  }
  const current=!rolling&&revealed?cards[revealed-1]:null,accent=current?colors[current.rarity]:'#eab55f';
  return <section ref={root} tabIndex={-1} className={`${styles.stage} ${reduced?styles.reduced:''}`} data-phase={phase} data-rarity={current?.rarity??'common'} data-rolling={rolling} aria-label={t('Открытие пака Agora','Agora pack opening')} style={{'--accent':accent} as CSSProperties}>
    <header className={styles.heading}><span>AGORA · AFTER HOURS</span><h2>{phase==='summary'?preview?t('Образцы редкостей','Rarity samples'):t('Твой новый легион.','Your new legion.'):t('Слот Фортуны','Fortune’s vault')}</h2><p aria-live="polite">{phase==='summary'?preview?t('Предпросмотр не выдаёт карты.','The preview does not grant cards.'):t('Пять карт в твоей коллекции.','Five cards in your collection.'):rolling?t('Рубашки вращаются…','The card backs are spinning…'):t(`Открыто ${revealed} из ${cards.length}. Каждую карту открываешь сам.`,`${revealed} of ${cards.length} revealed. Reveal each card when you are ready.`)}</p></header>
    {phase==='summary'?<div className={styles.cards}>{cards.map((card,i)=><article key={`${card.id}-${i}`} style={{'--accent':colors[card.rarity]} as CSSProperties}><div className={styles.halo}/><button className={styles.face} onClick={()=>onInspect(card.id)} aria-label={t(`Рассмотреть карту «${cardName(card.id)}»`,`Inspect ${cardName(card.id)}`)}><LibraryCardFace id={card.id}/></button><span className={styles.rarity}>{rarityName(card.rarity)}</span><h3>{cardName(card.id)}</h3><small>{preview?t('Пример карты','Sample card'):duplicates[i]?t('Повтор','Duplicate'):t('В коллекции','In your collection')}</small></article>)}</div>:<div className={styles.experience}>
      <div className={styles.machine} data-revealed={!!current}>
        <div className={styles.halo}/>
        <div className={styles.window}>
          {rolling?<div className={styles.reel} key={`${iteration}-${revealed}`} aria-hidden="true">{Array.from({length:13},(_,i)=><img key={i} src={BACK} alt=""/>)}</div>:current?<div className={styles.flip} key={`${iteration}-${revealed}`}><img className={styles.flipBack} src={BACK} alt="" aria-hidden="true"/><button className={`${styles.face} ${styles.flipFront}`} disabled={busy} onClick={()=>onInspect(current.id)} aria-label={t(`Рассмотреть карту «${cardName(current.id)}»`,`Inspect ${cardName(current.id)}`)}><LibraryCardFace id={current.id}/></button></div>:<button className={styles.back} onClick={reveal} disabled={busy} aria-label={t('Открыть первую карту','Reveal first card')}><img src={BACK} alt=""/></button>}
          <div className={styles.recess} aria-hidden="true"/>
        </div>
        <img className={styles.cabinet} src={SLOT} alt="" aria-hidden="true"/>
        {current&&<div className={styles.burst} key={`${iteration}-${revealed}`} aria-hidden="true"><div className={styles.revealRing}/><div className={styles.orbit}/><div className={styles.orbitTwo}/>{Array.from({length:current.rarity==='legendary'?24:current.rarity==='epic'?16:current.rarity==='rare'?10:6},(_,i)=><i className={styles.shard} key={i} style={{'--angle':`${i*360/(current.rarity==='legendary'?24:current.rarity==='epic'?16:current.rarity==='rare'?10:6)}deg`,'--distance':`${115+i%4*24}px`,'--delay':`${i%3*35}ms`} as CSSProperties}/>)}{current.rarity==='legendary'&&<div className={styles.crown}><RomanIcon name="crown" size={76}/></div>}</div>}
      </div>
      <div className={styles.cardCopy}>
        <div className={styles.details} aria-live="polite">{current?<><span className={styles.rarity}>{rarityName(current.rarity)}</span><h3>{cardName(current.id)}</h3><p>{cardRules(current.id,locale)}</p><small>{preview?t('Предпросмотр · без выдачи','Preview · no grant'):duplicates[revealed-1]?t('Повтор · валюта коллекции в iDos','Duplicate · iDos collection currency'):t('Теперь в твоей коллекции','Now in your collection')}</small></>:<><PaintedIcon name="pack" size={66}/><h3>{rolling?t('Фортуна в движении','Fortune in motion'):t('Твой ход, Фортуна.','Your move, Fortune.')}</h3><p>{rolling?t('Слот замедляется. Затем — переворот и открытие карты.','The reel slows down. Then the card flips and reveals.'):t('Нажми «Открыть карту». Следующее открытие начнётся только по твоему нажатию.','Tap “Reveal card”. Each next reveal starts with your tap.')}</p></>}</div>
        <button className={styles.next} disabled={busy} onClick={revealed===cards.length?summary:reveal}><PaintedIcon name={revealed===cards.length?'cards':'pack'} size={32}/>{busy?rolling?t('Вращается…','Spinning…'):current?t('Раскрывается…','Revealing…'):t('Готовим слот…','Preparing the vault…'):revealed===cards.length?t('Посмотреть все пять карт','See all five cards'):t(`${revealed?'Следующая карта':'Открыть карту'} · ${revealed+1}/${cards.length}`,`${revealed?'Next card':'Reveal card'} · ${revealed+1}/${cards.length}`)}<RomanIcon name="next" size={19}/></button>
        <ol className={styles.progress} aria-label={t('Открытые карты','Revealed cards')}>{cards.map((card,i)=><li key={i} data-open={i<revealed} style={{'--slot-color':i<revealed?colors[card.rarity]:'#7b5a34'} as CSSProperties}><span>{i<revealed?<RomanIcon name="check" size={20}/>:i+1}</span></li>)}</ol>
      </div>
    </div>}
    <footer className={styles.controls}>{phase==='summary'?<><span><RomanIcon name="check" size={18}/>{preview?t('Предпросмотр','Preview'):t('Коллекция обновлена','Collection updated')}</span><button disabled={busy} onClick={()=>{if(locked.current)return;lock(true);onReplayStart();setIteration(i=>i+1);}}><RomanIcon name="refresh" size={17}/>{t('Повторить открытие · бесплатно','Replay opening · free')}</button></>:<button onClick={summary}><RomanIcon name="next" size={17}/>{t('Пропустить анимацию · показать всё','Skip animation · reveal all')}</button>}</footer>
  </section>;
}
