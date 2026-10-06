import {CARDS} from '../../lib/cards';
import {cardName,type Locale} from '../../lib/locale';
import {cardIdentity} from './cardIdentity';

export const CARD_FRAME_PATH='/ui/arena-lab/native/card-frame-front.webp';
export const CARD_FACE={width:384,height:672,ratio:384/672};
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function contain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.min(w / image.naturalWidth, h / image.naturalHeight);
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
  lines.slice(0, limit).forEach((value, index) => {
    let shown = value;
    while (ctx.measureText(shown).width > width && shown.length > 2) shown = shown.slice(0, -1);
    if (shown !== value || (index === limit - 1 && lines.length > limit)) shown = `${shown.slice(0, -1)}…`;
    ctx.fillText(shown, x, y + index * line);
  });
}

function badge(ctx: CanvasRenderingContext2D,font:string, value: string, x: number, y: number, color: string, radius = 43,shape:'circle'|'cost'|'attack'|'health'='circle') {
    ctx.save();
    ctx.shadowColor = '#110b08'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 4;
    const gradient = ctx.createRadialGradient(x - 10, y - 15, 5, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(.65,color); gradient.addColorStop(1, '#513824');
    ctx.fillStyle = gradient;ctx.beginPath();
    if(shape==='cost'){for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
    else if(shape==='attack'){ctx.moveTo(x-radius*.85,y-radius*.8);ctx.lineTo(x+radius*.85,y-radius*.8);ctx.lineTo(x+radius*.78,y+radius*.36);ctx.quadraticCurveTo(x+radius*.35,y+radius*.75,x,y+radius);ctx.quadraticCurveTo(x-radius*.35,y+radius*.75,x-radius*.78,y+radius*.36);ctx.closePath();}
    else if(shape==='health'){ctx.moveTo(x,y-radius);ctx.bezierCurveTo(x+radius*.35,y-radius*.5,x+radius*.86,y-radius*.1,x+radius*.86,y+radius*.27);ctx.bezierCurveTo(x+radius*.86,y+radius*1.2,x-radius*.86,y+radius*1.2,x-radius*.86,y+radius*.27);ctx.bezierCurveTo(x-radius*.86,y-radius*.1,x-radius*.35,y-radius*.5,x,y-radius);ctx.closePath();}
    else ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.strokeStyle = '#d9b973'; ctx.lineWidth = 6; ctx.stroke();
    let fontSize = Math.min(164, radius * 1.55);
    ctx.font = `800 ${fontSize}px ${font}`;
    const measured = ctx.measureText(value).width;
    if (measured > radius * 1.55) { fontSize *= radius * 1.55 / measured; ctx.font = `800 ${fontSize}px ${font}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1d130d'; ctx.lineWidth = 3; ctx.strokeText(value, x, y + 1);
    ctx.fillStyle = '#fff4d4'; ctx.fillText(value, x, y + 1); ctx.restore();
  }


/** The hand and inspection share one card face; portrait art is never fitted into a square. */
export function paintCardFace(ctx:CanvasRenderingContext2D,id:string,locale:Locale,font:string,art:HTMLImageElement|null,playable?:boolean,stats?:{attack:number;health:number},frame?:HTMLImageElement|null){
    const def = CARDS[id];
    if(!frame){rounded(ctx,9,9,366,654,20);ctx.fillStyle='#8c693c';ctx.fill();rounded(ctx,17,17,350,638,14);ctx.fillStyle='#ead7ab';ctx.fill();}
    ctx.save();rounded(ctx,51,58,282,404,18);ctx.clip();ctx.fillStyle='#c7ab77';ctx.fillRect(51,58,282,404);if(art)contain(ctx,art,51,58,282,404);ctx.restore();
    if(frame){ctx.save();if(playable){ctx.shadowColor='#fff0bc';ctx.shadowBlur=8;}ctx.drawImage(frame,0,0,CARD_FACE.width,CARD_FACE.height);ctx.restore();}
    else{ctx.fillStyle='#4d3423';rounded(ctx,18,469,348,74,8);ctx.fill();}
    ctx.fillStyle='#fff1cf';ctx.font=`750 36px ${font}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.strokeStyle='#2a1a13';ctx.lineWidth=2;
    words(ctx,cardName(id,locale),192,499,305,34);
    badge(ctx,font,`${def.cost}`,68,82,playable===false?'#566967':'#287f9a',44,'cost');
    if(def.type==='minion'){
      badge(ctx,font,`${stats?.attack??def.attack}`,64,585,'#b38637',37,'attack');
      badge(ctx,font,`${stats?.health??def.health}`,320,585,'#b7483c',37,'health');
    }
    const identity=cardIdentity(id);
    // Keep the compact hand face free of tiny rules text. Full role/rank labels
    // are in inspection; this engraved emblem marks the role on the card.
    ctx.save();ctx.translate(192,583);ctx.strokeStyle='#493422';ctx.fillStyle=identity.color;ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();
    if(identity.role==='guard'){ctx.moveTo(-12,-12);ctx.lineTo(12,-12);ctx.lineTo(10,6);ctx.lineTo(0,16);ctx.lineTo(-10,6);ctx.closePath();}
    else if(identity.role==='engineer'){for(let i=0;i<7;i++){const a=i*Math.PI/3;ctx.lineTo(Math.cos(a)*15,Math.sin(a)*15);}}
    else if(identity.role==='commander'||identity.role==='priest'){ctx.arc(0,0,14,.2,Math.PI-.2);for(const side of [-1,1])for(let i=0;i<3;i++){ctx.moveTo(side*(8+i*2),8-i*7);ctx.lineTo(side*(16+i*2),4-i*7);}}
    else if(identity.role==='minister'||identity.role==='edict'){ctx.arc(0,-3,10,0,Math.PI*2);ctx.moveTo(-5,7);ctx.lineTo(-8,17);ctx.lineTo(0,12);ctx.lineTo(8,17);ctx.lineTo(5,7);}
    else{ctx.moveTo(0,17);ctx.lineTo(0,-15);ctx.moveTo(-6,-5);ctx.lineTo(0,-17);ctx.lineTo(6,-5);ctx.moveTo(-6,8);ctx.lineTo(6,8);}
    ctx.stroke();ctx.restore();
    ctx.strokeStyle=identity.color;ctx.lineWidth=7;
    for(let i=0;i<identity.rank;i++){ctx.beginPath();ctx.arc(339-i*17,80,4,0,Math.PI*2);ctx.stroke();}
}
