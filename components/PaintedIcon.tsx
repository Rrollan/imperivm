import type {CSSProperties} from 'react';
import styles from './PaintedIcon.module.css';

const cells={home:0,library:1,cards:2,pack:3,play:4,wallet:5,heroes:6,rules:7,orders:8,rug:9,history:10,settings:11} as const;
export type PaintedSymbol=keyof typeof cells;
/** One alpha atlas, twelve hand-painted game objects; labels remain real, accessible text. */
export function PaintedIcon({name,size=36}:{name:PaintedSymbol;size?:number}){
  const cell=cells[name];
  return <span aria-hidden="true" className={styles.icon} style={{'--icon-size':`${size}px`,'--icon-x':`${cell%4/3*100}%`,'--icon-y':`${Math.floor(cell/4)/2*100}%`} as CSSProperties}/>;
}
