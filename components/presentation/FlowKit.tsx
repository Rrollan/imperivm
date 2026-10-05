'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './FlowKit.module.css';

type FlowVideo = { id: string; title: string; duration: number; prompt: string };
const assetPath = '/ui/arena-lab/flow-kit';

export default function FlowKit({ items }: { items: FlowVideo[] }) {
  const [copied, setCopied] = useState('');
  async function copyPrompt(item: FlowVideo) {
    try { await navigator.clipboard.writeText(item.prompt); setCopied(item.id); }
    catch { setCopied('error'); }
  }
  return <main className={styles.page}>
    <header><Link href="/arena-lab">← Арена</Link><span>IMPERIVM / GOOGLE FLOW</span></header>
    <section className={styles.intro}>
      <p>9 видео · Готовые пары кадров</p><h1>Start. End. Промпт.</h1>
      <p>Для каждого видео — отдельная папка с двумя картинками и готовым текстом. Номер папки, картинок и промпта совпадает.</p>
      <a className={styles.download} href="/ui/arena-lab/imperivm-flow-vfx-pairs.zip" download>Скачать все 9 папок · ZIP</a>
    </section>
    <aside>
      <strong>16:9 · 720p · 4 секунды · First and last</strong>
      <ol>
        <li><b>Start / First frame:</b> прикрепи картинку <b>START</b> нужного номера.</li>
        <li><b>End / Last frame:</b> прикрепи чёрную картинку <b>END</b> того же номера.</li>
        <li><b>Промпт:</b> вставь весь текст из одноимённого <b>PROMPT.txt</b> или нажми «Копировать промпт» ниже.</li>
      </ol>
      <p>Всего две картинки. Дополнительный референс не нужен. End у всех видео чёрный: эффект исчезает.</p>
    </aside>
    <section className={styles.gallery} aria-label="Кадры и промпты для каждого видео">
      {items.map(item => {
        const number = item.id.split('-')[0];
        return <article key={item.id}>
          <div className={styles.heading}><span className={styles.number}>{number}</span><div><h2>{item.title}</h2><p>Одно видео · {item.duration} секунды</p></div></div>
          <div className={styles.pair}>
            {(['START', 'END'] as const).map(phase => {
              const filename = `${number}-${phase}.png`;
              return <figure key={phase}>
                <a href={`${assetPath}/${filename}`} download={filename} aria-label={`Скачать ${filename}`}><img src={phase === 'START' ? `${assetPath}/${item.id}.webp` : `${assetPath}/${filename}`} alt={phase === 'START' ? `${number} Start — ${item.title}` : `${number} End — полностью чёрный кадр`} loading="lazy" width={640} height={360}/></a>
                <figcaption><strong>{phase === 'START' ? 'Start / First frame' : 'End / Last frame'}</strong><a href={`${assetPath}/${filename}`} download={filename}>{filename} ↓</a></figcaption>
              </figure>;
            })}
          </div>
          <div className={styles.promptActions}><button onClick={() => copyPrompt(item)}>{copied === item.id ? 'Промпт скопирован' : 'Копировать промпт'}</button><a href={`${assetPath}/${number}-PROMPT.txt`} download={`${number}-PROMPT.txt`}>{number}-PROMPT.txt ↓</a></div>
          <details><summary>Показать готовый промпт {number}</summary><pre>{item.prompt}</pre></details>
          <p className={styles.output}>Сохрани результат как <b>{item.id}.mp4</b></p>
        </article>;
      })}
    </section>
    {copied === 'error' && <p role="status">Открой «Показать готовый промпт» и скопируй весь текст вручную.</p>}
    <footer>Кадры уже в формате 1280 × 720. В Flow их не нужно обрезать.<br/><a href="https://support.google.com/flow/answer/16352836?hl=en" target="_blank" rel="noreferrer">Возможности Flow ↗</a></footer>
  </main>;
}
