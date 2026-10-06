'use client';
import {useEffect,useRef} from 'react';
import {CARD_FACE,CARD_FRAME_PATH,paintCardFace} from './cardFace';
import {cardArtPath} from '../../lib/cardArt';
import type {Locale} from '../../lib/locale';
import styles from './ArenaLab.module.css';

/** A static 2D preview of the exact hand face, with no extra WebGL scene. */
export function ArenaCardPreview({id,locale,label,stats}:{id:string;locale:Locale;label:string;stats?:{attack:number;health:number}}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return;
    let live=true;
    const art=new Image(),frame=new Image();
    const font=getComputedStyle(document.body).getPropertyValue('--font-sans').trim()||'sans-serif';
    const draw=()=>{if(!live)return;ctx.clearRect(0,0,CARD_FACE.width,CARD_FACE.height);paintCardFace(ctx,id,locale,font,art.complete&&art.naturalWidth?art:null,undefined,stats,frame.complete&&frame.naturalWidth?frame:null);};
    art.onload=draw;frame.onload=draw;frame.src=CARD_FRAME_PATH;art.src=cardArtPath(id);draw();void document.fonts.ready.then(draw);
    return()=>{live=false;art.onload=null;frame.onload=null;};
  },[id,locale,stats?.attack,stats?.health]);
  return <canvas ref={canvas} className={styles.inspectedCard} width={CARD_FACE.width} height={CARD_FACE.height} role="img" aria-label={label}/>;
}
