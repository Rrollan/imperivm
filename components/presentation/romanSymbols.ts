/** The same engraved silhouettes drive canvas pieces and DOM controls. */
export const ROMAN_SYMBOLS={
  gladius:'M12 2 L15 7 L14 16 L17 16 L17 18 L13 18 L13 22 L11 22 L11 18 L7 18 L7 16 L10 16 L9 7 Z',
  shield:'M4 3 L20 3 L19 13 Q17 19 12 22 Q7 19 5 13 Z M12 6 L12 17 M8 11 L16 11',
  hammer:'M5 3 L17 3 L21 7 L18 10 L14 7 L12 9 L15 20 L11 22 L8 10 L4 8 Z',
  standard:'M7 2 L7 22 M7 4 L20 4 L18 8 L20 12 L7 12 M12 6 L14 10 L16 6',
  scroll:'M6 4 L18 4 Q22 4 22 7 L19 7 L19 19 L6 19 Q2 19 2 16 L6 16 Z M9 9 L16 9 M9 13 L16 13 M9 16 L14 16',
  temple:'M2 8 L12 2 L22 8 Z M4 10 L4 19 M10 10 L10 19 M14 10 L14 19 M20 10 L20 19 M2 21 L22 21',
  lock:'M7 10 L7 7 Q7 2 12 2 Q17 2 17 7 L17 10 M5 10 L19 10 L19 22 L5 22 Z M12 14 L12 18',
  hourglass:'M5 2 L19 2 L19 6 Q19 9 12 12 Q19 15 19 18 L19 22 L5 22 L5 18 Q5 15 12 12 Q5 9 5 6 Z M8 5 L16 5 M8 19 L16 19',
  laurel:'M9 21 Q2 18 3 7 M15 21 Q22 18 21 7 M4 15 L1 12 M4 11 L2 7 M6 18 L2 17 M20 15 L23 12 M20 11 L22 7 M18 18 L22 17 M8 5 L12 2 L16 5 L15 10 L9 10 Z',
  close:'M6 6 L18 18 M18 6 L6 18',
  back:'M16 4 L7 12 L16 20 M8 12 L22 12',
  history:'M6 3 L18 3 L18 21 L6 21 Z M9 7 L15 7 M9 11 L15 11 M9 15 L15 15 M3 6 L6 6 M3 18 L6 18',
  rested:'M6 6 L18 6 L6 18 L18 18',
  spent:'M5 18 L19 6 M7 3 L17 3 M7 21 L17 21',
  drop:'M12 2 Q20 12 20 16 Q20 22 12 22 Q4 22 4 16 Q4 12 12 2 Z',
  cards:'M5 3 L18 3 L18 19 L5 19 Z M8 6 L15 6 M8 10 L15 10 M8 14 L12 14 M8 22 L21 22 L21 6',
  pack:'M4 5 L20 5 L20 21 L4 21 Z M4 9 L20 9 M9 5 L9 2 L15 2 L15 5 M12 12 L16 16 L12 20 L8 16 Z',
  crown:'M3 7 L7 10 L12 3 L17 10 L21 7 L19 18 L5 18 Z M5 21 L19 21',
  wallet:'M4 5 L18 2 L18 6 M3 6 L21 6 L21 21 L3 21 Z M21 11 L15 11 L15 16 L21 16 M18 13 L18 14',
  duel:'M3 3 L9 5 L20 19 M21 3 L15 5 L4 19 M15 20 L20 15 M4 15 L9 20 M2 22 L5 19 M22 22 L19 19',
  coin:'M12 2 A10 10 0 1 1 11.99 2 M12 6 L17 12 L12 18 L7 12 Z',
  plus:'M12 5 L12 19 M5 12 L19 12',
  minus:'M5 12 L19 12',
  check:'M4 12 L9 17 L20 6',
  next:'M3 12 L21 12 M14 5 L21 12 L14 19',
  search:'M17 10 A7 7 0 1 1 3 10 A7 7 0 1 1 17 10 M15 15 L22 22',
  save:'M3 3 L18 3 L21 6 L21 21 L3 21 Z M7 3 L7 9 L16 9 L16 3 M7 21 L7 14 L17 14 L17 21',
  refresh:'M20 7 A9 9 0 1 0 21 15 M20 2 L20 8 L14 8',
  logout:'M10 3 L3 3 L3 21 L10 21 M8 12 L22 12 M16 6 L22 12 L16 18',
  spark:'M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z',
  curve:'M3 21 L21 21 M5 18 L5 12 M10 18 L10 4 M15 18 L15 7 M20 18 L20 14',
  bot:'M12 2 L12 5 M4 5 L20 5 L20 19 L4 19 Z M7 10 L8 10 M16 10 L17 10 M8 15 L16 15 M1 9 L4 9 M20 9 L23 9',
  link:'M9 15 L15 9 M8 10 L5 10 Q1 10 1 15 Q1 20 6 20 L10 20 Q15 20 15 16 M9 8 Q9 3 14 3 L18 3 Q23 3 23 8 Q23 13 19 13 L16 13',
} as const;
export type RomanSymbol=keyof typeof ROMAN_SYMBOLS;
export function drawRomanSymbol(ctx:CanvasRenderingContext2D,symbol:RomanSymbol,x:number,y:number,size:number,color='#f6dfaa'){
  ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/24,size/24);ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=1.7;
  const path=new Path2D(ROMAN_SYMBOLS[symbol]);ctx.strokeStyle='#352013';ctx.lineWidth=3;ctx.stroke(path);ctx.translate(0,-.3);ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.stroke(path);ctx.restore();
}
