'use client';
import {useEffect,useRef,type KeyboardEvent,type PointerEvent} from 'react';
import {CARDS} from '../../lib/cards';
import {CARD_FACE,cardFramePath,paintCardFace} from './cardFace';
import {cardArtPath} from '../../lib/cardArt';
import type {Locale} from '../../lib/locale';
import styles from './ArenaLab.module.css';
import material from './ArenaCardMaterial.module.css';

/** The exact hand face, with optional inspection-only material. No extra renderer. */
export function ArenaCardPreview({id,locale,label,stats,interactive=false,reduced=false}:{id:string;locale:Locale;label:string;stats?:{attack:number;health:number};interactive?:boolean;reduced?:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const surface=useRef<HTMLSpanElement>(null),frameId=useRef<number|null>(null);
  const point=useRef({x:50,y:50,active:false});
  const enabled=interactive&&!reduced;
  const flush=()=>{
    frameId.current=null;
    const element=surface.current;if(!element)return;
    const {x,y,active}=point.current;
    element.style.setProperty('--tilt-x',`${(50-y)*.12}deg`);
    element.style.setProperty('--tilt-y',`${(x-50)*.12}deg`);
    element.style.setProperty('--light-x',`${x}%`);
    element.style.setProperty('--light-y',`${y}%`);
    element.style.setProperty('--material-active',active?'1':'0');
  };
  const queue=()=>{if(frameId.current===null)frameId.current=requestAnimationFrame(flush);};
  const reset=()=>{point.current={x:50,y:50,active:false};queue();};
  const move=(event:PointerEvent<HTMLSpanElement>)=>{
    if(!enabled||event.pointerType!=='mouse')return;
    const box=event.currentTarget.getBoundingClientRect();
    if(!box.width||!box.height)return;
    point.current={x:Math.max(0,Math.min(100,(event.clientX-box.left)/box.width*100)),y:Math.max(0,Math.min(100,(event.clientY-box.top)/box.height*100)),active:true};queue();
  };
  const key=(event:KeyboardEvent<HTMLSpanElement>)=>{
    if(!enabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const dx=event.key==='ArrowLeft'?-15:event.key==='ArrowRight'?15:0,dy=event.key==='ArrowUp'?-15:event.key==='ArrowDown'?15:0;
    point.current={x:Math.max(0,Math.min(100,point.current.x+dx)),y:Math.max(0,Math.min(100,point.current.y+dy)),active:true};queue();
  };
  useEffect(()=>{
    point.current={x:50,y:50,active:false};flush();
    const visibility=()=>{if(document.hidden){if(frameId.current!==null)cancelAnimationFrame(frameId.current);point.current={x:50,y:50,active:false};flush();}};
    document.addEventListener('visibilitychange',visibility);
    return()=>{document.removeEventListener('visibilitychange',visibility);if(frameId.current!==null)cancelAnimationFrame(frameId.current);frameId.current=null;};
    // Coordinates live in refs; changes only schedule a single frame, never an idle loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id,enabled]);
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return;
    let live=true;
    const art=new Image(),frame=new Image();
    const font=getComputedStyle(document.body).getPropertyValue('--font-sans').trim()||'sans-serif';
    const draw=()=>{if(!live)return;ctx.clearRect(0,0,CARD_FACE.width,CARD_FACE.height);paintCardFace(ctx,id,locale,font,art.complete&&art.naturalWidth?art:null,undefined,stats,frame.complete&&frame.naturalWidth?frame:null);};
    art.onload=draw;frame.onload=draw;frame.src=cardFramePath(CARDS[id].rarity);art.src=cardArtPath(id);draw();void document.fonts.ready.then(draw);
    return()=>{live=false;art.onload=null;frame.onload=null;};
  },[id,locale,stats?.attack,stats?.health]);
  const face=<canvas ref={canvas} className={interactive?undefined:styles.inspectedCard} width={CARD_FACE.width} height={CARD_FACE.height} role={interactive?'presentation':'img'} aria-hidden={interactive||undefined} aria-label={interactive?undefined:label}/>;
  if(!interactive)return face;
  return <span ref={surface} className={`${styles.inspectedCard} ${material.surface}`} data-rarity={CARDS[id].rarity} data-motion={enabled?'on':'off'} role="img" aria-label={label} tabIndex={enabled?0:undefined}
    aria-description={enabled?(locale==='ru'?'Двигайте указатель или нажимайте стрелки, чтобы рассмотреть материал карты.':'Move the pointer or use arrow keys to inspect the card material.'):undefined}
    onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onKeyDown={key} onBlur={reset}
    onFocus={()=>{if(enabled){point.current={x:50,y:50,active:true};queue();}}}>
    <span className={material.face}>{face}<span className={material.foil} aria-hidden="true"/><span className={material.glare} aria-hidden="true"/></span>
  </span>;
}
