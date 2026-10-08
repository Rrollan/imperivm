'use client';
import Link from 'next/link';
import {useState} from 'react';
import {CARDS} from '../../../lib/cards';
import type {Rarity} from '../../../lib/engine/types';
import {PackOpening} from '../../../components/home/PackOpening';
import {CardDialog} from '../../../components/home/CardDialog';
import {SiteHeader} from '../../../components/home/SiteChrome';
import {useLocale} from '../../../components/LocaleContext';
import styles from '../../../components/home/Home.module.css';

const rarities:Rarity[]=['common','rare','epic','legendary','legendary'];
const cards=rarities.map((rarity,index)=>Object.values(CARDS).filter(card=>card.rarity===rarity)[index===4?1:0]);
/** Isolated visual review, with no collection gateway or purchase side effects. */
export default function Page(){
  const {t}=useLocale();
  const [inspected,setInspected]=useState<string|null>(null);
  return <div className={styles.shell}><SiteHeader active="packs"/><main className={styles.hubMain} style={{maxWidth:1000,margin:'auto',padding:'24px'}}><p style={{color:'#f4d8a4',textAlign:'center'}}>{t('Предпросмотр анимации · без покупки и выдачи карт','Animation preview · no purchase or card grant')}</p><PackOpening preview cards={cards} duplicates={[]} onInspect={setInspected} onComplete={()=>{}} onReplayStart={()=>{}}/><Link className={styles.secondaryLink} href="/packs">{t('Вернуться к настоящим пакам →','Back to real packs →')}</Link></main>{inspected&&<CardDialog id={inspected} onClose={()=>setInspected(null)}/>}</div>;
}
