'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './FlowKit.module.css';

type FlowVideo = { id: string; title: string; duration: number; prompt: string; omniPrompt:string;installed?:{preview:string;seconds:number} };
export default function FlowKit({ items, olympus=false }: { items: FlowVideo[]; olympus?:boolean }) {
  const assetPath=olympus?'/ui/arena-lab/olympus-kit':'/ui/arena-lab/flow-kit';
  const [copied, setCopied] = useState('');
  const [engine,setEngine]=useState<'omni'|'flow'>('omni');
  const installedCount=items.filter(item=>item.installed).length;
  async function copyPrompt(item: FlowVideo) {
    try { await navigator.clipboard.writeText(engine==='omni'?item.omniPrompt:item.prompt); setCopied(item.id); }
    catch { setCopied('error'); }
  }
  return <main className={styles.page}>
    <header><Link href="/arena-lab">← Арена</Link><span>IMPERIVM / АНИМАЦИИ</span><Link href="/arena-lab/balance">Баланс и материалы →</Link></header>
    <section className={styles.intro}>
      <p>{items.length} эффектов · {installedCount} подключено</p><h1>{olympus?'Олимп выходит на поле.':installedCount===items.length?'Эффекты в игре.':'Start. End. Промпт.'}</h1>
      <p>Для каждого видео — отдельная папка с двумя картинками и готовым текстом. Номер папки, картинок и промпта совпадает.</p>
      <p>{olympus?(installedCount===items.length?'Ролики 18–25 получены и подключены: молния, алмазная защита, разлом, тяжёлый удар и появления Зевса, Афины и Аида. Ниже — короткие принятые эффекты; исходный пак сохранён для новых вариантов.':'Новый пак 18–25: молния, алмазная защита, разлом, тяжёлый удар и три появления персонажей. Эти ролики ждут генерации. В игре уже работают процедурные эффекты и объёмный выход дорогих карт.'):installedCount===items.length?'Ролики 10–17 проверены и подключены: шесть ролей бойцов, ослабление и лечение. Ниже — принятый короткий результат и исходный пак для повторной генерации.':'Видео 01–09 уже подключены. Здесь только новые эффекты выхода бойцов, ослабления и лечения.'}</p>
      <div className={styles.promptActions} aria-label="Модель генерации">{(['omni','flow'] as const).map(mode=><button key={mode} aria-pressed={engine===mode} onClick={()=>{setEngine(mode);setCopied('');}}>{mode==='omni'?'Omni Flash':'Flow / Veo'}</button>)}</div>
      <a className={styles.download} href={olympus?'/ui/arena-lab/imperivm-omni-olympus-18-25.zip':engine==='omni'?'/ui/arena-lab/imperivm-omni-flash-vfx.zip':'/ui/arena-lab/imperivm-flow-vfx-phase2.zip'} download>Скачать {items.length} папок для {engine==='omni'?'Omni Flash':'Flow'} · ZIP</a>
    </section>
    <aside>
      <strong>16:9 · 720p · {engine==='omni'?'целевые 4 секунды · Image1 → Image2':'4 секунды · First and last'}</strong>
      <ol>
        <li><b>{engine==='omni'?'Image1 / первое изображение:':'Start / First frame:'}</b> прикрепи картинку <b>START</b> нужного номера.</li>
        <li><b>{engine==='omni'?'Image2 / второе изображение:':'End / Last frame:'}</b> прикрепи чёрную картинку <b>END</b> того же номера.</li>
        <li><b>Промпт:</b> вставь весь текст из одноимённого <b>PROMPT.txt</b> или нажми «Копировать промпт» ниже.</li>
      </ol>
      <p>Всего две картинки. Дополнительный референс не нужен. End у всех видео чёрный: эффект исчезает.</p>
      {engine==='omni'&&<p>Если 4 секунды недоступны, выбери короткую доступную длину. Эффект завершается в первые {olympus?'0,65–1,55':'0,42–0,65'} секунды, дальше только чёрный кадр. Звук добавляет игра.</p>}
    </aside>
    <section className={styles.gallery} aria-label="Кадры и промпты для каждого видео">
      {items.map(item => {
        const number = item.id.split('-')[0];
        return <article key={item.id}>
          <div className={styles.heading}><span className={styles.number}>{number}</span><div><h2>{item.title}</h2><p>Пак генерации · {item.duration} секунды</p></div></div>
          {item.installed&&<figure className={styles.accepted}><video controls playsInline muted preload="none" poster={`${assetPath}/${item.id}.webp`} aria-label={`${number} — принятый эффект: ${item.title}`} width={640} height={360}><source src={item.installed.preview} type="video/mp4"/></video><figcaption>В игре · {item.installed.seconds.toFixed(2)} с · короткий эффект без звука</figcaption></figure>}
          <div className={styles.pair}>
            {(['START', 'END'] as const).map(phase => {
              const filename = `${number}-${phase}.png`;
              return <figure key={phase}>
                <a href={`${assetPath}/${filename}`} download={filename} aria-label={`Скачать ${filename}`}><img src={phase === 'START' ? `${assetPath}/${item.id}.webp` : `${assetPath}/${filename}`} alt={phase === 'START' ? `${number} Start — ${item.title}` : `${number} End — полностью чёрный кадр`} loading="lazy" width={640} height={360}/></a>
                <figcaption><strong>{phase === 'START' ? 'Start / First frame' : 'End / Last frame'}</strong><a href={`${assetPath}/${filename}`} download={filename}>{filename} ↓</a></figcaption>
              </figure>;
            })}
          </div>
          <div className={styles.promptActions}><button onClick={() => copyPrompt(item)}>{copied === item.id ? 'Промпт скопирован' : 'Копировать промпт'}</button><a href={`${olympus?assetPath:engine==='omni'?'/ui/arena-lab/omni-kit':assetPath}/${number}-PROMPT.txt`} download={`${number}-PROMPT.txt`}>{number}-PROMPT.txt ↓</a></div>
          <details><summary>Показать готовый промпт {number}</summary><pre>{engine==='omni'?item.omniPrompt:item.prompt}</pre></details>
          <p className={styles.output}>Сохрани результат как <b>{item.id}.mp4</b></p>
        </article>;
      })}
    </section>
    {copied === 'error' && <p role="status">Открой «Показать готовый промпт» и скопируй весь текст вручную.</p>}
    <footer>{installedCount===items.length?'Все восемь MP4 получены. Исходный пак сохранён для новых вариантов.':'Кадры уже в формате 1280 × 720; загружай без обрезки. Пришли восемь MP4 одним ZIP, сохранив имена.'}<br/><Link href={olympus?'/arena-lab/animation-kit?pack=roles':'/arena-lab/animation-kit'}>{olympus?'Подключённые эффекты 10–17':'Новый пак Олимпа 18–25'} →</Link></footer>
  </main>;
}
