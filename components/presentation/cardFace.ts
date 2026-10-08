import {isInstantSpell} from '../../lib/engine/spellTiming';
import {CARDS} from '../../lib/cards';
import {cardName,type Locale} from '../../lib/locale';
import type {Rarity} from '../../lib/engine/types';

export const CARD_FACE={width:384,height:672,ratio:384/672};
export function cardFramePath(rarity:Rarity){return `/ui/cards/rarity-v1/${rarity}.png`;}
// Measured against the transparent aperture and engraved panels of each painting.
// Both the DOM preview and the arena texture use these exact coordinates.
export const CARD_FRAME_LAYOUT:Record<Rarity,{art:{x:number;y:number;w:number;h:number};nameY:number;statsY:number}>={
  common:{art:{x:44,y:48,w:296,h:424},nameY:519,statsY:596},
  rare:{art:{x:47,y:51,w:290,h:414},nameY:509,statsY:586},
  epic:{art:{x:44,y:69,w:296,h:412},nameY:526,statsY:604},
  legendary:{art:{x:49,y:60,w:286,h:407},nameY:516,statsY:594},
};
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function fillArt(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  // Square illustrations fill the same portrait window as tall illustrations.
  // The surrounding clip owns the crop; no parchment/black bands inside the art.
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (w - width) / 2, y + (h - height) / 2, width, height);
}

function words(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number, limit = 2) {
  const lines: string[] = []; let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > width) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  const visible=lines.slice(0,limit),metrics=ctx.measureText('МТag'),baseline=y+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2-(visible.length-1)*line/2;
  visible.forEach((value, index) => {
    let shown = value;
    while (ctx.measureText(shown).width > width && shown.length > 2) shown = shown.slice(0, -1);
    if (shown !== value || (index === limit - 1 && lines.length > limit)) shown = `${shown.slice(0, -1)}…`;
    ctx.fillText(shown, x, baseline + index * line);
  });
}

export function paintBadge(ctx: CanvasRenderingContext2D,font:string, value: string, x: number, y: number, color: string, radius = 43) {
    ctx.save();
    ctx.shadowColor = '#110b08'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 4;
    const gradient = ctx.createRadialGradient(x - 10, y - 15, 5, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(.65,color); gradient.addColorStop(1, '#513824');
    ctx.fillStyle = gradient;ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.strokeStyle = '#d9b973'; ctx.lineWidth = 6; ctx.stroke();
    let fontSize = Math.min(164, radius * 1.55);
    ctx.font = `800 ${fontSize}px ${font}`;
    const measured = ctx.measureText(value).width;
    if (measured > radius * 1.55) { fontSize *= radius * 1.55 / measured; ctx.font = `800 ${fontSize}px ${font}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const metrics=ctx.measureText(value),baseline=y+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
    ctx.strokeStyle = '#1d130d'; ctx.lineWidth = 3; ctx.strokeText(value, x, baseline);
    ctx.fillStyle = '#fff4d4'; ctx.fillText(value, x, baseline); ctx.restore();
  }


/** The hand and inspection share one card face; portrait art is never fitted into a square. */
export function paintCardFace(ctx:CanvasRenderingContext2D,id:string,locale:Locale,font:string,art:HTMLImageElement|null,playable?:boolean,stats?:{attack:number;health:number},frame?:HTMLImageElement|null,variant:'card'|'battlefield'|'queued'='card'){
    const def = CARDS[id];
    const layout=CARD_FRAME_LAYOUT[def.rarity],{x,y,w,h}=layout.art;
    if(!frame){rounded(ctx,9,9,366,654,20);ctx.fillStyle='#8c693c';ctx.fill();rounded(ctx,17,17,350,638,14);ctx.fillStyle='#ead7ab';ctx.fill();}
    ctx.save();rounded(ctx,x,y,w,h,18);ctx.clip();ctx.fillStyle='#c7ab77';ctx.fillRect(x,y,w,h);if(art)fillArt(ctx,art,x,y,w,h);ctx.restore();
    if(frame){ctx.save();if(playable){ctx.shadowColor='#fff0bc';ctx.shadowBlur=8;}ctx.drawImage(frame,0,0,CARD_FACE.width,CARD_FACE.height);ctx.restore();}
    else{ctx.fillStyle='#4d3423';rounded(ctx,18,layout.nameY-36,348,72,8);ctx.fill();}
    ctx.fillStyle='#fff1cf';ctx.font=`750 34px ${font}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.strokeStyle='#2a1a13';ctx.lineWidth=2;
    words(ctx,cardName(id,locale),192,layout.nameY,304,32);
    paintBadge(ctx,font,`${def.cost}`,48,56,variant==='card'&&playable===false?'#566967':'#287f9a',39);
    if(def.type==='minion'){
      const radius=37;
      paintBadge(ctx,font,`${stats?.attack??def.attack}`,64,layout.statsY,stats&&stats.attack>(def.attack??0)?'#6e8040':'#b38637',radius);
      paintBadge(ctx,font,`${stats?.health??def.health}`,320,layout.statsY,'#b7483c',radius);
    }else if(variant!=='queued'){
      ctx.font=`750 29px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#70502b';ctx.fillText(isInstantSpell(def)?(locale==='ru'?'МГНОВЕННО':'INSTANT'):(locale==='ru'?'УКАЗ':'EDICT'),192,layout.statsY,270);
    }
}
