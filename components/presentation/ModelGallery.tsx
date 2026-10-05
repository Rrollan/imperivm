'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MODEL_IDS, type ModelId } from './assetCatalog';
import manifest from '../../public/arena-assets/manifest.json';
import styles from './ModelGallery.module.css';

export default function ModelGallery() {
  const [id,setId] = useState<ModelId>('hero-builder');
  const [angle,setAngle] = useState(0);
  const [status,setStatus] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const model = manifest.models.find(m=>m.id===id)!;
  useEffect(()=>{
    let dispose: (()=>void)|undefined, cancelled = false; setStatus('Загрузка…');
    void import('./createModelPreview').then(({createModelPreview})=>{
      if (cancelled || !canvas.current) return;
      dispose = createModelPreview(canvas.current,id,angle,()=>setStatus(''),()=>setStatus('Не удалось загрузить модель'));
    });
    return ()=>{cancelled=true;dispose?.();};
  },[id,angle]);
  return <main className={styles.page}><aside><Link href="/arena-lab">← Вернуться к арене</Link><h1>Модели IMPERIVM</h1><p>21 предмет из полного экспорта Tripo. Потяните мышью, чтобы повернуть модель.</p><label>Модель<select value={id} onChange={e=>{setId(e.target.value as ModelId);setAngle(0);}}>{MODEL_IDS.map(id=><option key={id}>{id}</option>)}</select></label><div className={styles.angles}>{[0,90,180,270].map(a=><button key={a} onClick={()=>setAngle(a)} aria-pressed={angle===a}>{a}°</button>)}</div><dl><dt>Треугольники</dt><dd>{model.sourceTriangles.toLocaleString('ru-RU')} → {model.triangles.toLocaleString('ru-RU')}</dd><dt>Размер GLB</dt><dd>{(model.sourceBytes/1e6).toFixed(2)} → {(model.bytes/1e6).toFixed(2)} МБ</dd><dt>Текстуры</dt><dd>до {model.textureSize} × {model.textureSize}</dd></dl><a href={model.file} download>Скачать версию для браузера</a><p>Экспорты статичные. В игре движения предметов привязаны к событиям боя.</p></aside><section><canvas ref={canvas} aria-label={`Предпросмотр ${id}`} />{status&&<p role="status">{status}</p>}</section></main>;
}
