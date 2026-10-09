'use client';

import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {useCollection} from '../CollectionContext';
import {useLocale} from '../LocaleContext';
import {CARDS} from '../../lib/cards';
import {isFreeHero,HEROES} from '../../lib/heroes';
import {DECKS} from '../../lib/decks';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {deckCardCounts,freeCardCounts,isFreeCard,needsCollection} from '../../lib/collection/access';
import {deckError,loadCustomDeck,saveCustomDeck} from '../../lib/deckbuilder';
import {completeOwnedDeck,costCurve,deckCounts} from '../../lib/deckWorkshop';
import {cardArtPath} from '../../lib/cardArt';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {cardRules,powerRules} from '../presentation/rulesText';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import {PaintedIcon} from '../PaintedIcon';
import {RomanIcon} from '../presentation/RomanIcon';
import {LibraryCardFace} from './LibraryCardFace';
import styles from './DeckWorkshop.module.css';

const accents={common:'#b6b9b6',rare:'#48c6ff',epic:'#c581ff',legendary:'#ffba49'};
export function DeckWorkshop({onClose,onInspect}:{onClose:()=>void;onInspect:(id:string)=>void}){
  const {t,locale,cardName,cardText,heroName,rarityName,powerName,errorText}=useLocale(),collection=useCollection();
  const owned=collection.snapshot?.owned??freeCardCounts(),limits=deckCardCounts(owned);
  const [hero,setHero]=useState('whale'),[deck,setDeck]=useState<string[]>([]),[ready,setReady]=useState(false);
  const [query,setQuery]=useState(''),[faction,setFaction]=useState('All'),[cost,setCost]=useState<number|null>(null),[kind,setKind]=useState('all'),[all,setAll]=useState(false),[sort,setSort]=useState('cost');
  const [notice,setNotice]=useState(''),[saved,setSaved]=useState(false),[drawer,setDrawer]=useState(false),[replacing,setReplacing]=useState<string|null>(null);
  const drafts=useRef<Record<string,string[]>>({}),history=useRef<string[][]>([]),drawerRoot=useRef<HTMLElement>(null);
  function readDraft(id:string){try{const raw:unknown=JSON.parse(localStorage.getItem(`imperivm.deck-draft.${id}`)||'null');if(Array.isArray(raw)&&raw.length<=30&&raw.every(x=>typeof x==='string'&&Object.hasOwn(CARDS,x))&&Object.entries(deckCounts(raw)).every(([key,count])=>count<=(CARDS[key].rarity==='legendary'?1:2)))return raw as string[];}catch{}return null;}
  useEffect(()=>{setDeck(readDraft('whale')??loadCustomDeck('whale')??[...FREE_DECKS.whale]);setReady(true);},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem(`imperivm.deck-draft.${hero}`,JSON.stringify(deck));}catch{/* Explicit save still reports unavailable storage. */}},[hero,deck,ready]);
  useEffect(()=>{
    if(!drawer)return;
    const previous=document.activeElement as HTMLElement|null,root=drawerRoot.current;
    root?.querySelector<HTMLElement>('button')?.focus();
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    function key(e:KeyboardEvent){if(e.key==='Escape'){setDrawer(false);return;}if(e.key!=='Tab'||!root)return;const nodes=Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=before;previous?.focus();};
  },[drawer]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
  const counts=useMemo(()=>deckCounts(deck),[deck]),curve=useMemo(()=>costCurve(deck),[deck]);
  const error=deckError(deck,limits), missing=deck.filter(id=>!limits[id]),average=deck.length?(deck.reduce((n,id)=>n+CARDS[id].cost,0)/deck.length).toFixed(1):'0.0';
  const visible=Object.values(CARDS).filter(c=>(all||!!limits[c.id])&&(faction==='All'||c.faction===faction)&&(cost===null||Math.min(7,c.cost)===cost)&&(kind==='all'||(kind==='minion'?c.type==='minion':kind==='instant'?isInstantSpell(c):c.type==='spell'&&!isInstantSpell(c)))&&`${cardName(c.id)} ${cardText(c.id)} ${c.name} ${c.text}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='name'?cardName(a.id).localeCompare(cardName(b.id),locale):sort==='rarity'?Object.keys(accents).indexOf(b.rarity)-Object.keys(accents).indexOf(a.rarity)||a.cost-b.cost:a.cost-b.cost||cardName(a.id).localeCompare(cardName(b.id),locale));
  function edit(next:string[]){history.current=[...history.current.slice(-19),deck];setDeck(next);setSaved(false);setNotice('');setReplacing(null);}
  function inspect(id:string){setDrawer(false);onInspect(id);}
  function changeHero(id:string){drafts.current[hero]=deck;setHero(id);setDeck(drafts.current[id]??readDraft(id)??loadCustomDeck(id)??[...FREE_DECKS[id]]);history.current=[];setSaved(false);setReplacing(null);setNotice('');}
  function add(id:string){if((counts[id]??0)>=(limits[id]??0))return;if(deck.length===30){setReplacing(id);setDrawer(true);setNotice(t('Выберите в списке карту, которую заменим.', 'Choose a card in your deck to replace.'));}else edit([...deck,id]);}
  function remove(id:string){const next=[...deck];next.splice(next.lastIndexOf(id),1);if(replacing){next.push(replacing);setDrawer(false);}edit(next);}
  function save(){try{saveCustomDeck(hero,deck,owned);setSaved(true);setNotice(collection.snapshot?.mode!=='idos'&&needsCollection(deck)?t('Сохранено для тренировок. Для паковых карт в PvP нужен аккаунт iDos.','Saved for training. Pack-only cards in PvP require an iDos account.'):t('Сохранено. Эта колода выбрана для тренировок и своей игры.','Saved. This deck is selected for training and custom games.'));}catch(e){setNotice(errorText(e instanceof Error?e.message:'Browser storage is unavailable.'));}}
  const content=<>
    <div className={styles.deckHeading}><div><span>{t('Ваш легион','Your legion')}</span><h2>{heroName(hero)}</h2></div><strong>{deck.length}<small>/ 30</small></strong></div>
    <div className={styles.progress} role="progressbar" aria-label={t('Карт в колоде','Cards in deck')} aria-valuemin={0} aria-valuemax={30} aria-valuenow={deck.length}><i style={{width:`${deck.length/30*100}%`}}/></div>
    <div className={styles.power}><img src={heroPortraitPath(hero)} alt=""/><div><strong>{powerName(hero)} · {HEROES[hero].powerCost}</strong><p>{powerRules(hero,locale)}</p></div></div>
    <div className={styles.curveHeading}><span><RomanIcon name="curve" size={18}/>{t('Кривая приказов','Order curve')}</span><b>Ø {average}</b></div>
    <div className={styles.curve} aria-label={t('Количество карт по стоимости','Card counts by cost')}>{curve.map((count,i)=><button key={i} title={`${i===7?'7+':i}: ${count}`} aria-label={t(`Стоимость ${i===7?'7+':i}: ${count} карт. Фильтр`, `Cost ${i===7?'7+':i}: ${count} cards. Filter`)} aria-pressed={cost===i} onClick={()=>setCost(cost===i?null:i)}><b>{count||'·'}</b><i style={{height:`${count/Math.max(1,...curve)*38}px`}}/><span>{i===7?'7+':i}</span></button>)}</div>
    <div className={styles.deckTools}><button onClick={()=>edit(completeOwnedDeck(deck,hero,owned))} disabled={deck.length===30&&!missing.length}><RomanIcon name="spark" size={17}/>{missing.length?t('Заменить недостающие','Replace missing'):t('Дополнить до 30','Complete to 30')}</button><button onClick={()=>{const prev=history.current.pop();if(prev){setDeck(prev);setSaved(false);setNotice('');setReplacing(null);}}} disabled={!history.current.length} aria-label={t('Отменить последнее изменение','Undo last edit')}><RomanIcon name="back" size={18}/></button></div>
    {replacing&&<div className={styles.swap} role="status"><strong>{t('Заменяем на','Replace with')}: {cardName(replacing)}</strong><button onClick={()=>{setReplacing(null);setNotice('');}}>{t('Отмена','Cancel')}</button></div>}
    <div className={styles.deckList}>{Object.entries(counts).sort(([a],[b])=>CARDS[a].cost-CARDS[b].cost||cardName(a).localeCompare(cardName(b),locale)).map(([id,count])=><div key={id} className={`${styles.row} ${!limits[id]?styles.missing:''}`} style={{'--rarity':accents[CARDS[id].rarity]} as CSSProperties}><button className={styles.rowName} onClick={()=>inspect(id)} aria-label={t(`Рассмотреть ${cardName(id)}`,`Inspect ${cardName(id)}`)}><span className={styles.cost}>{CARDS[id].cost}</span><img src={cardArtPath(id)} alt="" loading="lazy"/><span>{cardName(id)}{!limits[id]&&<small>{t('Нет в коллекции','Not owned')}</small>}</span></button><b>×{count}</b><button className={styles.remove} onClick={()=>remove(id)} aria-label={replacing?t(`Заменить ${cardName(id)} на ${cardName(replacing)}`,`Replace ${cardName(id)} with ${cardName(replacing)}`):t(`Убрать одну ${cardName(id)}`,`Remove one ${cardName(id)}`)}><RomanIcon name={replacing?'refresh':'minus'} size={18}/></button></div>)}</div>
    {!deck.length&&<p className={styles.emptyDeck}>{t('Выберите карты слева или начните со стартовой колоды.','Pick cards from the collection or load a starter deck.')}</p>}
    <div className={styles.saveArea}><p>{missing.length?t(`В рецепте не получено карт: ${missing.length}. Замените их или откройте паки.`,`Missing cards in this recipe: ${missing.length}. Replace them or open packs.`):error?errorText(error):t('Готово к бою · 2 копии, легендарная — 1.','Battle ready · 2 copies; legendary — 1.')}</p><button className={styles.save} disabled={!!error||!ready} onClick={save}><RomanIcon name={saved?'check':'save'} size={20}/>{saved?t('Сохранено','Saved'):t('Сохранить колоду','Save deck')}</button>{saved&&!error&&<Link href={`/arena?hero=${hero}`}><PaintedIcon name="play" size={28}/>{t('Выбрать бой','Choose battle')}<RomanIcon name="next" size={18}/></Link>}</div>
  </>;
  return <section className={styles.workshop} aria-label={t('Сборщик колоды','Deckbuilder')}>
    <div className={styles.heading}><div><span>{t('Арсенал империи','Imperial arsenal')}</span><h1>{t('Собери свой легион.','Build your legion.')}</h1></div><button onClick={onClose}><RomanIcon name="back" size={20}/>{t('Коллекция','Collection')}</button></div>
    <div className={styles.heroes} role="group" aria-label={t('Колода правителя','Ruler deck')}>{Object.values(HEROES).map(h=><button key={h.id} disabled={!isFreeHero(h.id)&&!collection.snapshot?.heroes?.includes(h.id)} aria-pressed={hero===h.id} onClick={()=>changeHero(h.id)}><img src={heroPortraitPath(h.id)} alt=""/><span>{heroName(h.id)}</span>{hero===h.id&&<RomanIcon name="check" size={18}/>}</button>)}</div>
    <div className={styles.workspace}><div className={styles.catalogue}>
      <div className={styles.presets}><button onClick={()=>edit([...FREE_DECKS[hero]])}><PaintedIcon name="heroes" size={30}/>{t('Бесплатная колода','Free starter')}</button><button onClick={()=>{edit([...DECKS[hero]]);setAll(true);}}><PaintedIcon name="rules" size={30}/>{t('Рецепт со связками','Synergy recipe')}</button><button onClick={()=>edit([])}><PaintedIcon name="cards" size={30}/>{t('С чистого листа','Start fresh')}</button></div>
      <div className={styles.filters}><label className={styles.search}><RomanIcon name="search" size={20}/><input aria-label={t('Поиск карт и способностей','Search cards and abilities')} placeholder={t('Название, способность, мем…','Name, ability, meme…')} value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label={t('Тип карты','Card type')} value={kind} onChange={e=>setKind(e.target.value)}><option value="all">{t('Все типы','All types')}</option><option value="minion">{t('Бойцы','Fighters')}</option><option value="instant">{t('Мгновенные','Instant spells')}</option><option value="edict">{t('Указы','Edicts')}</option></select><select aria-label={t('Сортировка','Sort cards')} value={sort} onChange={e=>setSort(e.target.value)}><option value="cost">{t('По стоимости','By cost')}</option><option value="rarity">{t('По редкости','By rarity')}</option><option value="name">{t('По названию','By name')}</option></select></div>
      <div className={styles.factions} role="group" aria-label={t('Фракция','Faction')}>{['All','DeFi','NFT','DePIN','Meme'].map(f=><button key={f} aria-pressed={f===faction} onClick={()=>setFaction(f)}>{f==='All'?t('Все','All'):f}</button>)}</div>
      <div className={styles.costFilters}><span><PaintedIcon name="orders" size={26}/>{t('Стоимость','Cost')}</span><button aria-pressed={cost===null} onClick={()=>setCost(null)}>{t('Все','All')}</button>{Array.from({length:8},(_,i)=><button key={i} aria-pressed={cost===i} onClick={()=>setCost(cost===i?null:i)}>{i===7?'7+':i}</button>)}</div>
      <div className={styles.results}><span>{visible.length} {t('карт','cards')}</span><label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>{t('Показать неполученные','Show unowned')}</label></div>
      <div className={styles.cards}>{visible.map(card=>{const count=counts[card.id]??0,limit=limits[card.id]??0;return <article key={card.id} className={`${styles.card} ${!limit?styles.locked:''} ${count?styles.inDeck:''}`} style={{'--rarity':accents[card.rarity]} as CSSProperties}><button className={styles.inspect} onClick={()=>limit&&count<limit&&ready?add(card.id):inspect(card.id)} aria-label={limit&&count<limit?t(`Добавить ${cardName(card.id)} в колоду`,`Add ${cardName(card.id)} to deck`):t(`Рассмотреть ${cardName(card.id)}`,`Inspect ${cardName(card.id)}`)}><LibraryCardFace id={card.id}/></button><div className={styles.cardCopy}><h3><button className={styles.infoButton} onClick={()=>inspect(card.id)} aria-label={t(`Способности ${cardName(card.id)}`,`Abilities of ${cardName(card.id)}`)}>{cardName(card.id)}<RomanIcon name="scroll" size={16}/></button></h3><span>{card.faction} · {rarityName(card.rarity)}</span><p>{cardRules(card.id,locale)}</p></div><div className={styles.cardAction}>{limit?<><button disabled={!count} aria-label={t(`Убрать одну ${cardName(card.id)}`,`Remove one ${cardName(card.id)}`)} onClick={()=>{setReplacing(null);const next=[...deck];next.splice(next.lastIndexOf(card.id),1);edit(next);}}><RomanIcon name="minus" size={18}/></button><span>{count} / {limit}</span><button disabled={count>=limit||!ready} aria-label={t(`Добавить ${cardName(card.id)} в колоду`,`Add ${cardName(card.id)} to deck`)} onClick={()=>add(card.id)}><RomanIcon name={deck.length===30?'refresh':'plus'} size={18}/></button></>:<Link href="/packs"><RomanIcon name="lock" size={16}/>{t('Из паков','From packs')}<PaintedIcon name="pack" size={25}/></Link>}</div>{isFreeCard(card.id)&&<small className={styles.free}>{t('Бесплатно','Free')}</small>}</article>;})}</div>
      {!visible.length&&<div className={styles.noResults}><RomanIcon name="search" size={36}/><p>{t('Ничего не найдено.','No matching cards.')}</p><button onClick={()=>{setQuery('');setFaction('All');setCost(null);setKind('all');}}>{t('Сбросить фильтры','Reset filters')}</button></div>}
    </div><aside className={styles.deckPanel}>{content}</aside></div>
    <div className={styles.mobileBar}><button onClick={()=>setDrawer(true)}><PaintedIcon name="cards" size={34}/><span>{heroName(hero)}<small>{deck.length}/30 · Ø {average}</small></span><RomanIcon name="next" size={20}/></button><button className={styles.save} disabled={!!error||!ready} onClick={save}><RomanIcon name={saved?'check':'save'} size={20}/>{t('Сохранить','Save')}</button></div>
    {drawer&&<div className={styles.drawerBackdrop} onClick={()=>setDrawer(false)}><aside ref={drawerRoot} className={styles.drawer} role="dialog" aria-modal="true" aria-label={t('Ваша колода','Your deck')} onClick={e=>e.stopPropagation()}><button className={styles.drawerClose} onClick={()=>setDrawer(false)} aria-label={t('Закрыть колоду','Close deck')}><RomanIcon name="close"/></button>{content}</aside></div>}
    {notice&&<div className={styles.toast} role="status">{notice}</div>}
  </section>;
}
