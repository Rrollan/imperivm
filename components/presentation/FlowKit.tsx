'use client';
import Link from 'next/link';
import { useState } from 'react';
import styles from './FlowKit.module.css';

export default function FlowKit({items}:{items:{id:string;title:string;duration:number;prompt:string}[]}){
  const [copied,setCopied]=useState('');
  return <main className={styles.page}>
    <header><Link href="/arena-lab">← Арена</Link><span>IMPERIVM / MOTION ART</span></header>
    <section className={styles.intro}><p>Пакет 02 · Google Flow</p><h1>Каждое действие<br/>имеет свой характер.</h1><p>Девять коротких акцентов: удар, четыре силы героя, три семейства заклинаний и победа. Сталь, бронза, слоновая кость — сдержанные эффекты в римском сеттинге.</p><a className={styles.download} href="/ui/arena-lab/imperivm-flow-vfx-v2.zip" download>Скачать кадры и ТЗ · ZIP</a></section>
    <aside><strong>Omni Flash 1.1 · 720p · 16:9 · First and last · 4 секунды</strong><p>Для каждого ролика: его PNG с окончанием -v2 → общий black-end.png. В архиве — все кадры и полные промпты. Камера неподвижна, фон чёрный, эффект исчезает целиком. Поле и цифры в видео не рисуем.</p><p>Сначала 01 и 02: проверим стиль при игровом размере, затем остальные. Движение карт, добор из колоды, стрелки, часы и газ уже анимируются самой игрой.</p></aside>
    <section className={styles.gallery}>{items.map((item,index)=><article key={item.id}><div className={styles.image}><img src={`/ui/arena-lab/flow-kit/${item.id}.webp`} alt={`Стартовый кадр: ${item.title}`}/><span>{String(index+1).padStart(2,'0')}</span></div><div className={styles.copy}><p>{item.duration} секунд в Flow</p><h2>{item.title}</h2><button onClick={async()=>{try{await navigator.clipboard.writeText(item.prompt);setCopied(item.id);}catch{setCopied('error');}}}>{copied===item.id?'Промпт скопирован':'Копировать промпт'}</button><details><summary>Читать промпт</summary><pre>{item.prompt}</pre></details></div></article>)}</section>
    {copied==='error'&&<p role="status">Выделите и скопируйте текст из «Читать промпт».</p>}
    <footer>Свечение накладываем поверх сцены. Управление, здоровье и правила остаются живыми.<br/><a href="https://support.google.com/flow/answer/16352836?hl=en" target="_blank" rel="noreferrer">Официальные возможности Flow ↗</a></footer>
  </main>;
}
