'use client';
import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {CARDS} from '../../lib/cards';
import {CARD_FACE,FACE_TEXTURE_SCALE,cardFramePath,paintCardFace} from './cardFace';
import {cardArtPath,cardPreviewArtPath} from '../../lib/cardArt';
import type {Locale} from '../../lib/locale';
import styles from './ArenaLab.module.css';
import material from './ArenaCardMaterial.module.css';
import {requestArenaImage} from './arenaImage';

/** The exact hand face, with optional inspection-only material. No extra renderer. */
export function ArenaCardPreview({id,locale,label,stats,interactive=false,reduced=false,compact=!interactive}:{id:string;locale:Locale;label:string;stats?:{attack:number;health:number};interactive?:boolean;reduced?:boolean;compact?:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const surface=useRef<HTMLSpanElement>(null),frameId=useRef<number|null>(null);
  const point=useRef({x:50,y:50,active:false});
  const enabled=interactive&&!reduced;
  const scale=compact?1:FACE_TEXTURE_SCALE;
  const [artReady,setArtReady]=useState(false);
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
    let live=true,previewReady=false,fullReady=false,frameReady=false,failed=false;
    setArtReady(false);
    const preview=requestArenaImage(cardPreviewArtPath(id),{priority:'high'});
    const art=compact?null:requestArenaImage(cardArtPath(id));
    const frame=requestArenaImage(cardFramePath(CARDS[id].rarity),{priority:'high'});
    const font=getComputedStyle(document.body).getPropertyValue('--font-sans').trim()||'sans-serif';
    const draw=()=>{if(!live)return;ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,CARD_FACE.width,CARD_FACE.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';paintCardFace(ctx,id,locale,font,fullReady&&art?art.image:previewReady?preview.image:null,undefined,stats,frameReady?frame.image:null);
      if(!previewReady&&!fullReady){ctx.save();ctx.fillStyle='#604b30';ctx.font=`600 23px ${font}`;ctx.textAlign='center';ctx.fillText(locale==='ru'?(failed?'Нет связи с иллюстрацией':'Загрузка иллюстрации…'):(failed?'Artwork unavailable':'Loading artwork…'),192,260,275);ctx.restore();}};
    void preview.loaded.then(()=>{if(live){previewReady=true;setArtReady(true);draw();}},()=>{failed=true;draw();});
    if(art)void art.loaded.then(()=>{if(live){fullReady=true;setArtReady(true);draw();}},()=>{});
    void frame.loaded.then(()=>{frameReady=true;draw();},()=>{});draw();void document.fonts.ready.then(draw);
    return()=>{live=false;};
  },[id,locale,compact,scale,stats?.attack,stats?.health]);
  const face=<canvas ref={canvas} className={interactive?undefined:styles.inspectedCard} width={CARD_FACE.width*scale} height={CARD_FACE.height*scale} role={interactive?'presentation':'img'} aria-busy={!artReady} aria-hidden={interactive||undefined} aria-label={interactive?undefined:label}/>;
  if(!interactive)return face;
  return <span ref={surface} className={`${styles.inspectedCard} ${material.surface}`} data-rarity={CARDS[id].rarity} data-motion={enabled?'on':'off'} role="img" aria-label={label} tabIndex={enabled?0:undefined}
    aria-description={enabled?(locale==='ru'?'Двигайте указатель или нажимайте стрелки, чтобы рассмотреть материал карты.':'Move the pointer or use arrow keys to inspect the card material.'):undefined}
    onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onKeyDown={key} onBlur={reset}
    onFocus={()=>{if(enabled){point.current={x:50,y:50,active:true};queue();}}}>
    <span className={material.face}>{face}<span className={material.foil} aria-hidden="true"/><span className={material.glare} aria-hidden="true"/></span>
  </span>;
}
