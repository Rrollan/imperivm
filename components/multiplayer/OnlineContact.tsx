'use client';
import {useEffect, useRef} from 'react';
import {useReducedMotion} from '../../lib/prefersReducedMotion';
import registry from '../../public/ui/arena-lab/fx/manifest.json';
import styles from './Multiplayer.module.css';

export type OnlineFx = {key: string; id: Exclude<keyof typeof registry.clips, '06-victory'>; health: number; attack: number};
/** Reuse the supplied atlases. No video uploads, fake targets, or rule changes in playback. */
export function OnlineContact({effect}: {effect: OnlineFx}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const clip = registry.clips[effect.id], image = new Image();
    let frame = 0, live = true;
    image.onload = () => {
      const context = canvas.current?.getContext('2d'); if (!context || !live) return;
      const start = performance.now();
      const draw = (now: number) => {
        if (!live) return;
        const elapsed = now - start, index = Math.min(clip.frameCount - 1, Math.floor(elapsed * clip.fps / 1000));
        context.clearRect(0, 0, 320, 180);
        if (elapsed >= clip.maxMs) return;
        const w = image.naturalWidth / clip.columns, h = image.naturalHeight / clip.rows;
        context.drawImage(image, index % clip.columns * w, Math.floor(index / clip.columns) * h, w, h, 0, 0, 320, 180);
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };
    image.src = clip.src;
    return () => {live = false; image.onload = null; cancelAnimationFrame(frame);};
  }, [effect.key, effect.id, reduced]);
  const label = [effect.health ? `${effect.health > 0 ? '+' : ''}${effect.health}` : '', effect.attack ? `${effect.attack > 0 ? '+' : ''}${effect.attack} ⚔` : ''].filter(Boolean).join(' ');
  return <span className={styles.contact} aria-hidden="true"><canvas ref={canvas} width={320} height={180}/>{label && <b className={styles.contactNumber} data-hurt={effect.health < 0 || effect.attack < 0}>{label}</b>}</span>;
}
