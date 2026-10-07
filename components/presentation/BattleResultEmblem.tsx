'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './BattleResultEmblem.module.css';

/** The result keeps its laurel after the short clip ends; failed autoplay also has a visible result. */
export function BattleResultEmblem({outcome,reduced,title,replayLabel}:{outcome:'win'|'loss'|'draw';reduced:boolean;title:string;replayLabel:string}) {
  const video=useRef<HTMLVideoElement>(null);
  const [playing,setPlaying]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(reduced||outcome!=='win')return;
    void video.current?.play().catch(()=>setPlaying(false));
  },[outcome,reduced,revision]);
  return <div className={styles.emblem} data-outcome={outcome} data-reduced={reduced}>
    <div className={styles.stage}>
      <img src="/ui/arena-lab/fx/victory-hold.webp" alt="" aria-hidden="true" className={playing&&!reduced&&outcome==='win'?styles.hidden:undefined}/>
      {outcome==='win'&&!reduced&&<video key={revision} ref={video} src="/ui/arena-lab/fx/06-victory.mp4" autoPlay muted playsInline preload="auto" aria-hidden="true" onPlaying={()=>setPlaying(true)} onEnded={()=>setPlaying(false)} onError={()=>setPlaying(false)}/>}
    </div>
    <h2>{title}</h2>
    {outcome==='win'&&!reduced&&<button className={styles.replay} onClick={()=>{setPlaying(false);setRevision(r=>r+1);}}>{replayLabel}</button>}
  </div>;
}
