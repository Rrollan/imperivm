'use client';

import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import styles from './ArenaLab.module.css';

/** A single inspection surface keeps the title, art and action rail in the same
 * places for a fighter, a ruler and an edict. Only its body scrolls. */
export function ArenaInspection({title,eyebrow,art,artAlt='',visual,kind='object',children,actions,onClose,onBack,closeLabel,backLabel,reduced}: {
  title:string;eyebrow:string;art?:string;artAlt?:string;visual?:ReactNode;kind?:'card'|'ruler'|'object';children:ReactNode;actions?:ReactNode;
  onClose:()=>void;onBack?:()=>void;closeLabel:string;backLabel?:string;reduced:boolean;
}) {
  const panel=useRef<HTMLElement>(null),timer=useRef<ReturnType<typeof setTimeout>>();
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const [closing,setClosing]=useState(false);
  const dismiss=useCallback(()=>{
    if(closing)return;
    if(reduced){closeRef.current();return;}
    setClosing(true);timer.current=setTimeout(()=>closeRef.current(),120);
  },[closing,reduced]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    panel.current?.querySelector<HTMLElement>('[data-inspection-close]')?.focus();
    return()=>{clearTimeout(timer.current);if(previous?.isConnected)previous.focus();};
  },[]);
  return <div className={`${styles.inspectionLayer} ${closing?styles.inspectionLeaving:''}`} onClick={event=>{if(event.target===event.currentTarget)dismiss();}}>
    <section ref={panel} className={`${styles.inspection} ${art||visual?styles.inspectionWithArt:''} ${kind==='card'?styles.inspectionCard:kind==='ruler'?styles.inspectionRuler:''}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}
      if(event.key==='Tab'){
        const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,[tabindex="0"]')??[]);
        const first=items[0],last=items.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }}>
      <header className={styles.inspectionHeader}>
        {onBack&&<button className={styles.inspectionBack} onClick={onBack} aria-label={backLabel}>‹</button>}
        <div><span>{eyebrow}</span><h2>{title}</h2></div>
        <button data-inspection-close className={styles.close} onClick={dismiss} aria-label={closeLabel}>×</button>
      </header>
      <div className={styles.inspectionBody}>
        {(art||visual)&&<figure className={styles.inspectionArt}>{visual??<img src={art} alt={artAlt}/>}</figure>}
        <div className={styles.inspectionDescription}>{children}</div>
      </div>
      {actions&&<footer className={styles.inspectionActions}>{actions}</footer>}
    </section>
  </div>;
}
