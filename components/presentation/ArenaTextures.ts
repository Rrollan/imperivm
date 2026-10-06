import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { CARDS } from '../../lib/cards';
import { type Locale } from '../../lib/locale';
import type { Minion } from '../../lib/engine/types';
import {CARD_FACE,CARD_FRAME_PATH,paintCardFace} from './cardFace';
import {heroPortraitPath} from './heroPortrait';
import {cardArtPath} from '../../lib/cardArt';
import {ordersLayout,ordersView} from './ordersView';
import type {BattleCommand,FighterReadiness} from './battleReadability';

export type Face =
  | { kind: 'card'; cardId: string; playable?:boolean }
  | { kind: 'minion'; minion: Minion; ready?: boolean;readiness?:FighterReadiness }
  | { kind: 'hero'; heroId: string; treasury: number; model?: boolean }
  | { kind: 'power'; heroId: string; cost: number; available: boolean; model?: boolean }
  | { kind: 'command'; state: BattleCommand; engraved?: boolean }
  | { kind: 'gas'; gas: number; max: number; engraved?: boolean }
  | { kind: 'orders'; gas: number; max: number; portrait: boolean }
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
    const size = initial.kind==='card'?{width:CARD_FACE.width,height:CARD_FACE.height}:initial.kind==='orders'?{width:1248,height:160}:initial.kind==='queueTitle'?{width:512,height:312}:initial.kind === 'command' ? { width: 768, height: 288 } : initial.kind === 'power' ? { width: 384, height: 384 } : initial.kind === 'gas' ? { width: 384, height: 256 } : { width: 384, height: 512 };
    const texture = new DynamicTexture(name, size, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    texture.hasAlpha = true;
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    let face = initial;
    const draw = () => {
      this.painting=draw;
      ctx.clearRect(0, 0, size.width, size.height);
      if (face.kind === 'back') this.drawBack(ctx,size.height);
      else if (face.kind === 'card') this.drawCard(ctx, face.cardId,face.playable);
      else if (face.kind === 'minion') this.drawMinion(ctx, face.minion, face.ready,face.readiness);
      else if (face.kind === 'hero') this.drawHero(ctx, face.heroId, face.treasury, face.model);
      else if (face.kind === 'power') this.drawPower(ctx, face);
      else if (face.kind === 'command') this.drawCommand(ctx, face.state, face.engraved);
      else if (face.kind === 'gas') this.drawGas(ctx, face.gas, face.max, face.engraved);
      else if(face.kind==='orders')this.drawOrders(ctx,face);
      else if(face.kind==='queued')this.drawQueued(ctx,face);
      else if(face.kind==='queueTitle'){
        // A physical rolled edict is the entry point. Counts live on their own
        // stacks; three permanent miniature HUD lines add no useful reading.
        ctx.save();ctx.shadowColor='#281408';ctx.shadowBlur=12;ctx.shadowOffsetY=8;
        const paper=ctx.createLinearGradient(0,65,0,226);paper.addColorStop(0,'#a98348');paper.addColorStop(.2,'#e5cb91');paper.addColorStop(.8,'#cbae72');paper.addColorStop(1,'#856338');
        ctx.fillStyle=paper;rounded(ctx,113,65,286,161,16);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
        ctx.strokeStyle='#714b29';ctx.lineWidth=5;ctx.stroke();
        for(const x of [106,398]){ctx.fillStyle='#d5b67b';rounded(ctx,x-17,50,34,194,14);ctx.fill();ctx.stroke();}
        ctx.strokeStyle='#79552f';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(164,111);ctx.lineTo(337,111);ctx.moveTo(164,139);ctx.lineTo(290,139);ctx.stroke();
        this.badge(ctx,'IV',266,209,'#682d28',49);ctx.restore();
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

  private drawCard(ctx:CanvasRenderingContext2D,id:string,playable?:boolean){
    paintCardFace(ctx,id,this.locale,this.font,this.image(cardArtPath(id)),playable,undefined,this.image(CARD_FRAME_PATH));
  }

  private drawQueued(ctx:CanvasRenderingContext2D,face:Extract<Face,{kind:'queued'}>){
    const paper=ctx.createLinearGradient(25,0,359,0);paper.addColorStop(0,'#aa824a');paper.addColorStop(.12,'#ebd5a0');paper.addColorStop(.88,'#d5ba7f');paper.addColorStop(1,'#96703d');
    ctx.fillStyle=paper;rounded(ctx,12,18,360,476,17);ctx.fill();ctx.strokeStyle='#77502a';ctx.lineWidth=6;ctx.stroke();
    ctx.save();rounded(ctx,84,39,216,324,8);ctx.clip();ctx.fillStyle='#d5ba7f';ctx.fillRect(84,39,216,324);
    const art=this.image(cardArtPath(face.cardId));if(art)contain(ctx,art,84,39,216,324);ctx.restore();
    ctx.strokeStyle='#a27e47';ctx.lineWidth=5;rounded(ctx,84,39,216,324,8);ctx.stroke();
    // Owner-coloured wax and a readable queue ordinal replace tiny rules/ribbons.
    ctx.fillStyle=face.owner===0?'#315e59':'#713b32';ctx.fillRect(175,372,34,100);
    this.badge(ctx,String(face.ordinal),192,424,face.owner===0?'#315e59':'#713b32',59);
    if(face.ordinal===1&&face.count>3)this.badge(ctx,`+${face.count-3}`,322,470,'#745631',51);
  }

  private drawOrders(ctx:CanvasRenderingContext2D,face:Extract<Face,{kind:'orders'}>){
    const {gas,max}=face,layout=ordersLayout(face.portrait);
    const view=ordersView(gas,max),art=this.image('/ui/arena-lab/gas-socket.webp');
    // Paint the sockets and counter from the same snapshot in one layer.
    // The HUD plane is wider than its 1248×160 texture. Compensate in texture
    // space so each gem remains round on the table, inset inside its painted rim.
    const radius=34;
    view.slots.forEach((status,index)=>{
      if(status==='locked')return;
      const x=layout.centers[index];ctx.save();ctx.translate(x,layout.centerY);ctx.scale(1,layout.verticalScale);
      ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();
      ctx.globalAlpha=status==='spent'?.18:1;
      if(status==='bonus')ctx.filter='sepia(1) saturate(1.8)';
      if(art)ctx.drawImage(art,art.naturalWidth*.145,art.naturalHeight*.145,art.naturalWidth*.71,art.naturalHeight*.71,-radius,-radius,radius*2,radius*2);
      else{const g=ctx.createRadialGradient(-9,-12,2,0,0,radius);g.addColorStop(0,'#98ecf0');g.addColorStop(.5,'#298c98');g.addColorStop(1,'#154447');ctx.fillStyle=g;ctx.fillRect(-radius,-radius,radius*2,radius*2);}
      ctx.filter='none';
      const recess=ctx.createRadialGradient(0,0,radius*.72,0,0,radius);recess.addColorStop(0,'#12232100');recess.addColorStop(1,'#102019b0');ctx.fillStyle=recess;ctx.fillRect(-radius,-radius,radius*2,radius*2);
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
    this.badge(ctx, `${minion.attack}`, 100, 388, minion.attack>(definition.attack??0)?'#6b7c42':minion.attack<(definition.attack??0)?'#735140':'#a87924', 66);
    this.badge(ctx, `${minion.health}`, 284, 388, minion.health<minion.maxHealth?'#963528':'#b04334', 66);
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
    const art=this.image(heroPortraitPath(id));
    if(art){if(id==='whale')ctx.drawImage(art,35,35,530,530,66,111,252,290);else if(id==='builder')ctx.drawImage(art,66,111,252,290);else cover(ctx,art,66,111,252,290);}
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

  private drawBack(ctx: CanvasRenderingContext2D,height=512) {
    const art=this.image('/ui/arena-lab/native/card-back-native.webp');
    if(art){contain(ctx,art,0,0,384,height);return;}
    ctx.save();ctx.scale(1,height/512);
    rounded(ctx, 17, 13, 350, 486, 22); ctx.fillStyle = '#3b2725'; ctx.fill();
    ctx.strokeStyle = '#d7ae63'; ctx.lineWidth = 17; ctx.stroke();
    rounded(ctx, 40, 39, 304, 435, 12); ctx.strokeStyle = '#9c7445'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#c09752'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(192, 255, 99, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `700 68px ${this.font}`; ctx.fillStyle = '#e3c88b'; ctx.textAlign = 'center'; ctx.fillText('IV', 192, 278);
    ctx.font = `700 24px ${this.font}`; ctx.fillText('IMPERIVM', 192, 432);ctx.restore();
  }

  dispose() { this.disposed = true; this.redraws.clear(); this.waiting.clear();this.painting=null;this.images.forEach(image => { image.onload = null; image.onerror = null; }); this.images.clear(); }
}
