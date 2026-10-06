import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { CARDS } from '../../lib/cards';
import { cardName, type Locale } from '../../lib/locale';
import type { Minion } from '../../lib/engine/types';
import {cardIdentity} from './cardIdentity';
import {cardArtPath} from '../../lib/cardArt';
import {ordersView} from './ordersView';
import type {BattleCommand,FighterReadiness} from './battleReadability';

export type Face =
  | { kind: 'card'; cardId: string; playable?:boolean }
  | { kind: 'minion'; minion: Minion; ready?: boolean;readiness?:FighterReadiness }
  | { kind: 'hero'; heroId: string; treasury: number; model?: boolean }
  | { kind: 'power'; heroId: string; cost: number; available: boolean; model?: boolean }
  | { kind: 'command'; state: BattleCommand; engraved?: boolean }
  | { kind: 'gas'; gas: number; max: number; engraved?: boolean }
  | { kind: 'orders'; gas: number; max: number }
  | { kind: 'queued'; cardId:string; owner:0|1; count:number; ordinal:number }
  | { kind: 'queueTitle'; own:number; enemy:number }
  | { kind: 'block'; block: number }
  | { kind: 'deck'; count: number; model?: boolean }
  | { kind: 'scroll' }
  | { kind: 'back' };

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / ratio, sh = h / ratio;
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
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

/** Small render textures; source art is fetched only for visible cards/heroes. */
export class ArenaTextures {
  private images = new Map<string, HTMLImageElement>();
  private redraws = new Set<() => void>();
  private waiting = new Map<string,Set<()=>void>>();
  private painting: (()=>void)|null=null;
  private disposed = false;
  locale: Locale;
  private font: string;

  constructor(private scene: Scene, locale: Locale, private invalidate: () => void) {
    this.locale = locale;
    this.font = getComputedStyle(document.body).getPropertyValue('--font-sans').trim() || 'sans-serif';
    void document.fonts.ready.then(() => { if (!this.disposed) this.redraws.forEach(draw => draw()); });
  }

  private image(src: string) {
    const known = this.images.get(src);
    if (known?.complete&&known.naturalWidth)return known;
    if(this.painting){const waiting=this.waiting.get(src)??new Set<()=>void>();waiting.add(this.painting);this.waiting.set(src,waiting);}
    if (known) return null;
    const image = new Image(); this.images.set(src, image);
    image.onload = () => { const waiting=this.waiting.get(src);this.waiting.delete(src);if (!this.disposed) waiting?.forEach(draw => draw()); };
    image.onerror = () => this.invalidate();
    image.src = src;
    return null;
  }

  make(name: string, initial: Face) {
    const size = initial.kind==='orders'?{width:1248,height:160}:initial.kind==='queueTitle'?{width:512,height:312}:initial.kind === 'command' ? { width: 768, height: 288 } : initial.kind === 'power' ? { width: 384, height: 384 } : initial.kind === 'gas' ? { width: 384, height: 256 } : { width: 384, height: 512 };
    const texture = new DynamicTexture(name, size, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    texture.hasAlpha = true;
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    let face = initial;
    const draw = () => {
      this.painting=draw;
      ctx.clearRect(0, 0, size.width, size.height);
      if (face.kind === 'back') this.drawBack(ctx);
      else if (face.kind === 'card') this.drawCard(ctx, face.cardId,face.playable);
      else if (face.kind === 'minion') this.drawMinion(ctx, face.minion, face.ready,face.readiness);
      else if (face.kind === 'hero') this.drawHero(ctx, face.heroId, face.treasury, face.model);
      else if (face.kind === 'power') this.drawPower(ctx, face);
      else if (face.kind === 'command') this.drawCommand(ctx, face.state, face.engraved);
      else if (face.kind === 'gas') this.drawGas(ctx, face.gas, face.max, face.engraved);
      else if(face.kind==='orders')this.drawOrders(ctx,face.gas,face.max);
      else if(face.kind==='queued')this.drawQueued(ctx,face);
      else if(face.kind==='queueTitle'){
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 95px ${this.font}`;
        ctx.strokeStyle='#1e110b';ctx.lineWidth=9;ctx.strokeText(this.locale==='ru'?'Указы':'Edicts',256,58);ctx.fillStyle='#f5dbac';ctx.fillText(this.locale==='ru'?'Указы':'Edicts',256,58);
        ctx.font=`750 75px ${this.font}`;
        for(const [label,y,color] of [[this.locale==='ru'?`Ваши ${face.own}`:`Yours ${face.own}`,151,'#b8e1d4'],[this.locale==='ru'?`Враг ${face.enemy}`:`Foe ${face.enemy}`,246,'#f2b7a6']] as const){ctx.strokeText(label,256,y);ctx.fillStyle=color;ctx.fillText(label,256,y);}
      }
      else if (face.kind === 'block') this.drawBlock(ctx, face.block);
      else if (face.kind === 'deck') { if (!face.model) this.drawBack(ctx); this.badge(ctx, String(face.count), 192, 350, '#544026', 70); }
      else this.drawScroll(ctx);
      this.painting=null;
      texture.update(true);
      this.invalidate();
    };
    this.redraws.add(draw); draw();
    return {
      texture,
      update: (next: Face) => { face = next; draw(); },
      dispose: () => { this.redraws.delete(draw); this.waiting.forEach(waiting=>waiting.delete(draw)); texture.dispose(); },
    };
  }

  setLocale(locale: Locale) { this.locale = locale; this.redraws.forEach(draw => draw()); }
  isReady() { return Array.from(this.images.values()).every(image => image.complete); }
  preloadCards(ids:string[]){ids.forEach(id=>this.image(cardArtPath(id)));}

  private badge(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, radius = 43) {
    ctx.save();
    ctx.shadowColor = '#110b08'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 4;
    const gradient = ctx.createRadialGradient(x - 10, y - 15, 5, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, '#251c16');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.strokeStyle = '#d9b973'; ctx.lineWidth = 7; ctx.stroke();
    let fontSize = Math.min(164, radius * 1.7);
    ctx.font = `800 ${fontSize}px ${this.font}`;
    const measured = ctx.measureText(value).width;
    if (measured > radius * 1.55) { fontSize *= radius * 1.55 / measured; ctx.font = `800 ${fontSize}px ${this.font}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1d130d'; ctx.lineWidth = 6; ctx.strokeText(value, x, y + 1);
    ctx.fillStyle = '#fff4d4'; ctx.fillText(value, x, y + 1); ctx.restore();
  }

  private drawCard(ctx: CanvasRenderingContext2D, id: string,playable?:boolean) {
    const def = CARDS[id];
    rounded(ctx, 9, 9, 366, 494, 20); ctx.fillStyle = '#8c693c'; ctx.fill();
    rounded(ctx, 17, 17, 350, 478, 14); ctx.fillStyle = '#ead7ab'; ctx.fill();
    if(playable){ctx.strokeStyle='#fff0bc';ctx.lineWidth=7;rounded(ctx,14,14,356,484,16);ctx.stroke();}
    ctx.save(); rounded(ctx, 23, 23, 338, 339, 9); ctx.clip();
    const art = this.image(cardArtPath(id));
    ctx.fillStyle = '#3b3026'; ctx.fillRect(23, 23, 338, 339);
    if (art) contain(ctx, art, 23, 23, 338, 339);
    ctx.restore();
    ctx.fillStyle = '#4d3423'; rounded(ctx, 18, 365, 348, 72, 8); ctx.fill();
    ctx.fillStyle = '#fff1cf'; ctx.font = `750 32px ${this.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    words(ctx, cardName(id, this.locale), 192, 390, 321, 34);
    this.badge(ctx, `${def.cost}`, 56, 61, playable===false?'#4a5352':'#246784', 45);
    if (def.type === 'minion') {
      this.badge(ctx, `${def.attack}`, 55, 469, '#aa7626', 31);
      this.badge(ctx, `${def.health}`, 329, 469, '#a83f31', 31);
    }
    const identity=cardIdentity(id);
    // Keep the compact hand face free of tiny rules text. Full role/rank labels
    // are in inspection; this engraved emblem marks the role on the card.
    ctx.save();ctx.translate(192,466);ctx.strokeStyle='#493422';ctx.fillStyle=identity.color;ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();
    if(identity.role==='guard'){ctx.moveTo(-12,-12);ctx.lineTo(12,-12);ctx.lineTo(10,6);ctx.lineTo(0,16);ctx.lineTo(-10,6);ctx.closePath();}
    else if(identity.role==='engineer'){for(let i=0;i<7;i++){const a=i*Math.PI/3;ctx.lineTo(Math.cos(a)*15,Math.sin(a)*15);}}
    else if(identity.role==='commander'||identity.role==='priest'){ctx.arc(0,0,14,.2,Math.PI-.2);for(const side of [-1,1])for(let i=0;i<3;i++){ctx.moveTo(side*(8+i*2),8-i*7);ctx.lineTo(side*(16+i*2),4-i*7);}}
    else if(identity.role==='minister'||identity.role==='edict'){ctx.arc(0,-3,10,0,Math.PI*2);ctx.moveTo(-5,7);ctx.lineTo(-8,17);ctx.lineTo(0,12);ctx.lineTo(8,17);ctx.lineTo(5,7);}
    else{ctx.moveTo(0,17);ctx.lineTo(0,-15);ctx.moveTo(-6,-5);ctx.lineTo(0,-17);ctx.lineTo(6,-5);ctx.moveTo(-6,8);ctx.lineTo(6,8);}
    ctx.stroke();ctx.restore();
    ctx.strokeStyle=identity.color;ctx.lineWidth=7;
    for(let i=0;i<identity.rank;i++){ctx.beginPath();ctx.arc(328-i*18,33,4,0,Math.PI*2);ctx.stroke();}
  }

  private drawQueued(ctx:CanvasRenderingContext2D,face:Extract<Face,{kind:'queued'}>){
    this.drawCard(ctx,face.cardId);
    ctx.fillStyle=face.owner===0?'#1d4b4b':'#6b2d26';rounded(ctx,20,350,344,86,8);ctx.fill();
    ctx.textAlign='center';ctx.font=`800 47px ${this.font}`;ctx.fillStyle='#fff0ce';
    ctx.fillText(this.locale==='ru'?(face.owner===0?'Ваш ход':'Ход врага'):(face.owner===0?'Your turn':'Enemy turn'),192,405);
    this.badge(ctx,String(face.ordinal),322,65,'#785435',44);
    if(face.count>3){ctx.font=`800 40px ${this.font}`;ctx.fillText(`+${face.count-3}`,192,487);}
  }

  private drawOrders(ctx:CanvasRenderingContext2D,gas:number,max:number){
    const view=ordersView(gas,max),art=this.image('/ui/arena-lab/gas-socket.webp');
    // Paint the sockets and counter from the same snapshot in one layer.
    const centers=[57,159,260,364,465,567,668,770,872,973];
    view.slots.forEach((status,index)=>{
      if(status==='locked')return;
      const x=centers[index];ctx.save();ctx.beginPath();ctx.arc(x,72,42,0,Math.PI*2);ctx.clip();
      ctx.globalAlpha=status==='spent'?.18:1;
      if(art)ctx.drawImage(art,art.naturalWidth*.2,art.naturalHeight*.2,art.naturalWidth*.6,art.naturalHeight*.6,x-43,29,86,86);
      else{const g=ctx.createRadialGradient(x-10,60,2,x,72,43);g.addColorStop(0,'#98ecf0');g.addColorStop(.5,'#298c98');g.addColorStop(1,'#154447');ctx.fillStyle=g;ctx.fillRect(x-43,29,86,86);}
      if(status==='bonus'){
        ctx.globalAlpha=.8;ctx.fillStyle='#dfa743';ctx.fillRect(x-43,29,86,86);
        ctx.globalAlpha=1;ctx.strokeStyle='#ffe2a0';ctx.lineWidth=6;ctx.beginPath();ctx.arc(x,72,36,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#fff1c5';ctx.fillRect(x-2,53,4,38);ctx.fillRect(x-19,70,38,4);
      }
      ctx.restore();
    });
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff1d3';ctx.strokeStyle='#21140d';ctx.lineWidth=7;
    ctx.font=`750 44px ${this.font}`;ctx.strokeText(this.locale==='ru'?'Приказы':'Orders',1136,23);ctx.fillText(this.locale==='ru'?'Приказы':'Orders',1136,23);
    ctx.font=`800 103px ${this.font}`;ctx.strokeText(String(gas),1097,89);ctx.fillText(String(gas),1097,89);
    ctx.font=`750 54px ${this.font}`;ctx.strokeText(`/ ${max}`,1190,98);ctx.fillText(`/ ${max}`,1190,98);
    if(view.bonus){ctx.font=`750 38px ${this.font}`;const label=`+${view.bonus} ${this.locale==='ru'?'бонус':'bonus'}`;ctx.fillStyle='#f3c67c';ctx.strokeText(label,1136,146);ctx.fillText(label,1136,146);}
  }

  private drawMinion(ctx: CanvasRenderingContext2D, minion: Minion, ready=false,readiness?:FighterReadiness) {
    if(minion.taunt){
      ctx.save();ctx.beginPath();ctx.moveTo(21,100);ctx.quadraticCurveTo(192,-8,363,100);ctx.lineTo(351,322);ctx.quadraticCurveTo(326,404,192,470);ctx.quadraticCurveTo(58,404,33,322);ctx.closePath();
      ctx.fillStyle='#726649';ctx.fill();ctx.strokeStyle='#ede0bc';ctx.lineWidth=13;ctx.stroke();ctx.restore();
    }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(192, 225, 159, 197, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#593c24'; ctx.fill(); ctx.lineWidth = minion.taunt ? 24 : 17; ctx.strokeStyle = minion.taunt ? '#ddd1af' : '#d5aa63'; ctx.stroke();
    ctx.clip();
    const art = this.image(cardArtPath(minion.cardId));
    // Battlefield pieces use an edge-to-edge portrait. Inspection shows the full illustration.
    if (art) cover(ctx, art, 32, 27, 320, 400);
    ctx.restore();
    // Board figures communicate art, attack and health. Full rules/names live in inspection.
    const definition=CARDS[minion.cardId];
    this.badge(ctx, `${minion.attack}`, 67, 422, minion.attack>(definition.attack??0)?'#6b7c42':minion.attack<(definition.attack??0)?'#735140':'#a87924', 49);
    this.badge(ctx, `${minion.health}`, 316, 422, minion.health<minion.maxHealth?'#963528':'#b04334', 49);
    if(minion.lifesteal){
      ctx.save();ctx.translate(304,98);ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.fillStyle='#632d29';ctx.fill();ctx.strokeStyle='#dcad78';ctx.lineWidth=4;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-19);ctx.bezierCurveTo(7,-8,15,0,15,8);ctx.arc(0,8,15,0,Math.PI);ctx.bezierCurveTo(-15,0,-7,-8,0,-19);ctx.fillStyle='#f0c8a9';ctx.fill();ctx.restore();
    }
    if (minion.staked) {
      ctx.fillStyle = '#1b5557'; ctx.beginPath(); ctx.arc(192,456,39,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#d9e5c8'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(192,443,15,Math.PI,0); ctx.stroke();
      ctx.fillStyle = '#d9e5c8'; rounded(ctx,171,442,42,35,5); ctx.fill();
    } else if(ready||readiness==='ready'||readiness==='rush'){
      ctx.save();ctx.translate(192,452);
      ctx.fillStyle='#49301d';ctx.strokeStyle='#e6bc6b';ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*2);ctx.fill();ctx.stroke();
      for(const angle of [-Math.PI/4,Math.PI/4]){
        ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-28);ctx.lineTo(7,-18);ctx.lineTo(5,13);ctx.lineTo(-5,13);ctx.lineTo(-7,-18);ctx.closePath();
        ctx.fillStyle='#f7e5b9';ctx.fill();ctx.strokeStyle='#806342';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#d1a253';ctx.fillRect(-12,12,24,5);ctx.fillRect(-3,17,6,12);ctx.restore();
      }
      ctx.restore();
    }else if(readiness==='fresh'){
      ctx.save();ctx.fillStyle='#f1dec0';ctx.strokeStyle='#483728';ctx.lineWidth=6;ctx.font=`800 86px ${this.font}`;ctx.textAlign='center';ctx.strokeText('Z',265,86);ctx.fillText('Z',265,86);ctx.font=`800 56px ${this.font}`;ctx.strokeText('z',319,43);ctx.fillText('z',319,43);ctx.restore();
    }else if(readiness==='exhausted'||readiness==='no-target'){
      ctx.save();ctx.strokeStyle='#776e5b';ctx.lineWidth=7;ctx.beginPath();ctx.arc(192,452,24,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(179,465);ctx.lineTo(205,439);ctx.stroke();ctx.restore();
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D, id: string, treasury: number, model = false) {
    if (!model) {
    // The loading portrait occupies exactly the coin's circular recess.
    // Texture pixels and the mesh use different aspect ratios, hence the ellipse.
    ctx.save();ctx.beginPath();ctx.ellipse(192,256,126,145,0,0,Math.PI*2);ctx.clip();
    ctx.fillStyle='#594124';ctx.fillRect(60,96,264,320);
    const art=this.image(id==='whale'?'/models/hero-whale.webp':`/heroes/${id}.webp`);
    if(art){if(id==='whale')ctx.drawImage(art,35,35,530,530,66,111,252,290);else cover(ctx,art,66,111,252,290);}
    ctx.restore();
    }
    this.badge(ctx, `${Math.max(0,treasury)}`, 315, 355, '#a8322f', 59);
  }

  private drawPower(ctx: CanvasRenderingContext2D, face: Extract<Face, { kind: 'power' }>) {
    const atlas = this.image('/ui/arena-lab/power-medallions.webp');
    const index = ['builder', 'whale', 'degen', 'validator'].indexOf(face.heroId);
    ctx.save(); ctx.globalAlpha = face.available ? 1 : .65;
    if (face.model) {
      ctx.beginPath(); ctx.arc(192,182,153,0,Math.PI*2);
      ctx.strokeStyle = '#d3b074'; ctx.lineWidth = 10; ctx.stroke();
    } else if (atlas) {
      // Measured alpha bounds; generated atlas spacing is not assumed to be exact.
      const regions = [[.049924,.003361,.43646,.484874],[.515885,.005042,.434191,.482353],[.044629,.481092,.440242,.489076],[.515129,.481513,.440242,.489076]];
      const [x,y,w,h] = regions[Math.max(0,index)];
      // Use just the relief, leaving the board's own painted ring visible.
      ctx.beginPath();ctx.arc(192,192,161,0,Math.PI*2);ctx.clip();
      ctx.drawImage(atlas, (x+w*.1)*atlas.naturalWidth, (y+h*.1)*atlas.naturalHeight, w*.8*atlas.naturalWidth, h*.8*atlas.naturalHeight, 27, 27, 330, 330);
    } else {
      this.badge(ctx, '', 192, 190, '#785b36', 140);
      ctx.strokeStyle = '#e5c08b'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(127,242); ctx.lineTo(243,117); ctx.moveTo(188,105); ctx.lineTo(264,174); ctx.stroke();
    }
    ctx.restore(); this.badge(ctx, `${face.cost}`, 295, 295, '#246784', 48);
  }

  private drawCommand(ctx: CanvasRenderingContext2D, state: Extract<Face, { kind: 'command' }>['state'], engraved = false) {
    const image = this.image('/ui/arena-lab/turn-command.webp');
    const available=state==='own'||state==='done';
    ctx.save(); ctx.globalAlpha = available ? 1 : .65;
    if (!engraved) {
      if (image) ctx.drawImage(image, 0, 0, 768, 288);
      else { rounded(ctx, 10, 22, 748, 244, 30); ctx.fillStyle = '#553b24'; ctx.fill(); }
    }
    ctx.restore();
    if(state==='done'){
      const light=ctx.createRadialGradient(384,145,35,384,145,310);light.addColorStop(0,'#e9b95840');light.addColorStop(1,'#e9b95800');ctx.fillStyle=light;rounded(ctx,96,67,576,156,35);ctx.fill();
    }
    const label = available ? (this.locale === 'ru' ? 'Конец хода' : 'End turn') : state === 'enemy' ? (this.locale === 'ru' ? 'Ход соперника' : 'Opponent') : state === 'busy' ? (this.locale === 'ru' ? 'Бой…' : 'Resolving…') : (this.locale === 'ru' ? 'Бой окончен' : 'Battle over');
    ctx.font = `800 108px ${this.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size=Math.min(108,108*590/Math.max(1,ctx.measureText(label).width));ctx.font=`800 ${size}px ${this.font}`;
    ctx.strokeStyle = '#1d100b'; ctx.lineWidth = 9; ctx.strokeText(label, 384, 145);
    ctx.fillStyle = state === 'done' ? '#fff5d0' : state==='own'?'#f2dfb4':'#c2b39a'; ctx.fillText(label, 384, 145);
  }

  private drawGas(ctx: CanvasRenderingContext2D, gas: number, max: number, engraved = false) {
    if (!engraved) { rounded(ctx, 30, 24, 324, 208, 65); ctx.fillStyle = '#30281d'; ctx.fill();
    ctx.lineWidth = 9; ctx.strokeStyle = '#b28d4f'; ctx.stroke(); }
    ctx.font = `800 100px ${this.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#edf5e6';
    ctx.fillText(`${gas} / ${max}`, 192, 112);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, block: number) {
    this.badge(ctx, String(block), 192, 240, '#5f492c', 130);
  }

  private drawScroll(ctx: CanvasRenderingContext2D) {
    rounded(ctx, 84, 100, 216, 300, 15); ctx.fillStyle = '#ddc89e'; ctx.fill();
    ctx.strokeStyle = '#776039'; ctx.lineWidth = 13; ctx.stroke();
    for (const y of [115,395]) { rounded(ctx, 61, y-18, 262, 36, 14); ctx.fillStyle = '#9e7c43'; ctx.fill(); }
    ctx.strokeStyle = '#867251'; ctx.lineWidth = 8;
    for (const y of [175,215,255,295,335]) { ctx.beginPath(); ctx.moveTo(120,y); ctx.lineTo(263,y); ctx.stroke(); }
  }

  private drawBack(ctx: CanvasRenderingContext2D) {
    const art=this.image('/ui/arena-lab/native/card-back-native.webp');
    if(art){contain(ctx,art,0,0,384,512);return;}
    rounded(ctx, 17, 13, 350, 486, 22); ctx.fillStyle = '#3b2725'; ctx.fill();
    ctx.strokeStyle = '#d7ae63'; ctx.lineWidth = 17; ctx.stroke();
    rounded(ctx, 40, 39, 304, 435, 12); ctx.strokeStyle = '#9c7445'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#c09752'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(192, 255, 99, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `700 68px ${this.font}`; ctx.fillStyle = '#e3c88b'; ctx.textAlign = 'center'; ctx.fillText('IV', 192, 278);
    ctx.font = `700 24px ${this.font}`; ctx.fillText('IMPERIVM', 192, 432);
  }

  dispose() { this.disposed = true; this.redraws.clear(); this.waiting.clear();this.painting=null;this.images.forEach(image => { image.onload = null; image.onerror = null; }); this.images.clear(); }
}
