import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { CARDS } from '../../lib/cards';
import { cardName,type Locale } from '../../lib/locale';
import type { Minion } from '../../lib/engine/types';
import {CARD_FACE,BATTLE_FACE,FACE_TEXTURE_SCALE,CARD_FRAME_LAYOUT,cardFramePath,paintCardFace,paintBadge} from './cardFace';
import {heroPortraitPath} from './heroPortrait';
import {cardArtPath} from '../../lib/cardArt';
import {ordersLayout,ordersView} from './ordersView';
import type {BattleCommand,FighterReadiness} from './battleReadability';
import {drawRomanSymbol,type RomanSymbol} from './romanSymbols';
import {TURN_INLAY_OUTLINE,PORTRAIT_TURN_INLAY_OUTLINE} from './boardSockets';

export type Face =
  | { kind: 'card'; cardId: string; playable?:boolean; reframeHeight?:number }
  | { kind: 'minion'; minion: Minion; ready?: boolean;readiness?:FighterReadiness;compact?:boolean }
  | { kind: 'hero'; heroId: string; treasury: number; aspect?:number; framed?:boolean; model?: boolean }
  | { kind: 'power'; heroId: string; cost: number; available: boolean; aspect?: number; model?: boolean }
  | { kind: 'command'; state: BattleCommand; engraved?: boolean; portrait?: boolean; compact?:boolean }
  | { kind: 'gas'; gas: number; max: number; engraved?: boolean }
  | { kind: 'orders'; gas: number; max: number; portrait: boolean }
  | { kind: 'queued'; cardId:string; owner:0|1; count:number; ordinal:number }
  | { kind: 'queueTitle'; own:number; enemy:number }
  | { kind: 'block'; block: number }
  | { kind: 'deck'; count: number; model?: boolean; reinforcement?: boolean }
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

/** Retina faces; source art is fetched only for visible cards/heroes. */
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
    const size = initial.kind==='minion'?BATTLE_FACE:['card','queued'].includes(initial.kind)?CARD_FACE:initial.kind==='orders'?{width:1248,height:160}:initial.kind==='queueTitle'?{width:512,height:256}:initial.kind === 'command' ? { width: 768, height: 336 } : ['hero','power'].includes(initial.kind) ? { width: 384, height: 384 } : initial.kind === 'gas' ? { width: 384, height: 256 } : { width: 384, height: 512 };
    const scale=['card','minion','queued','hero','power'].includes(initial.kind)?FACE_TEXTURE_SCALE:1;
    const texture = new DynamicTexture(name, {width:size.width*scale,height:size.height*scale}, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    texture.anisotropicFilteringLevel=4;
    texture.hasAlpha = true;
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    let face = initial;
    const draw = () => {
      this.painting=draw;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,size.width*scale,size.height*scale);
      // A flight may change between a tall hand face and a shorter court face.
      const height=face.kind==='minion'?BATTLE_FACE.height:face.kind==='card'?face.reframeHeight??CARD_FACE.height:face.kind==='queued'?CARD_FACE.height:size.height;
      ctx.setTransform(scale,0,0,scale*size.height/height,0,0);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      if (face.kind === 'back') this.drawBack(ctx,size.height);
      else if (face.kind === 'card') this.drawCard(ctx, face.cardId,face.playable,face.reframeHeight);
      else if (face.kind === 'minion') face.compact?this.drawCompactMinion(ctx,face.minion,face.ready,face.readiness):this.drawMinion(ctx, face.minion, face.ready,face.readiness);
      else if (face.kind === 'hero') this.drawHero(ctx, face.heroId, face.treasury,face.aspect??1,face.framed);
      else if (face.kind === 'power') this.drawPower(ctx, face);
      else if (face.kind === 'command') this.drawCommand(ctx, face.state, face.engraved, face.portrait,face.compact);
      else if (face.kind === 'gas') this.drawGas(ctx, face.gas, face.max, face.engraved);
      else if(face.kind==='orders')this.drawOrders(ctx,face);
      else if(face.kind==='queued')this.drawQueued(ctx,face);
      else if(face.kind==='queueTitle')this.drawQueueTitle(ctx,face);
      else if (face.kind === 'block') this.drawBlock(ctx, face.block);
      else if (face.kind === 'deck') {
        if (!face.model) this.drawBack(ctx);
        this.badge(ctx, face.reinforcement ? '2' : String(face.count), 192, 350, face.reinforcement ? '#246784' : '#544026', 70);
        if (face.count === 0) {
          ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 32px ${this.font}`;
          ctx.strokeStyle='#24100b';ctx.lineWidth=7;ctx.fillStyle=face.reinforcement?'#ffebb0':'#d3c6ae';
          const label=this.locale==='ru'?'ПОДКРЕПЛЕНИЕ':'REINFORCEMENT';
          ctx.strokeText(label,192,452,370);ctx.fillText(label,192,452,370);
        }
      }
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
  preloadCards(ids:string[]){ids.forEach(id=>{this.image(cardArtPath(id));this.image(cardFramePath(CARDS[id].rarity));});}

  private badge(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, radius = 43) {
    paintBadge(ctx,this.font,value,x,y,color,radius);
  }

  private drawCard(ctx:CanvasRenderingContext2D,id:string,playable?:boolean,reframeHeight?:number){
    paintCardFace(ctx,id,this.locale,this.font,this.image(cardArtPath(id)),playable,undefined,this.image(cardFramePath(CARDS[id].rarity)),'card',reframeHeight);
  }

  private drawQueued(ctx:CanvasRenderingContext2D,face:Extract<Face,{kind:'queued'}>){
    paintCardFace(ctx,face.cardId,this.locale,this.font,this.image(cardArtPath(face.cardId)),undefined,undefined,this.image(cardFramePath(CARDS[face.cardId].rarity)),'queued');
    // The original face identifies the edict; wax identifies owner and order.
    this.badge(ctx,String(face.ordinal),192,CARD_FRAME_LAYOUT[CARDS[face.cardId].rarity].statsY,face.owner===0?'#315e59':'#713b32',36);
    if(face.ordinal===1&&face.count>3)this.badge(ctx,`+${face.count-3}`,315,624,'#745631',33);
  }

  private drawQueueTitle(ctx:CanvasRenderingContext2D,face:Extract<Face,{kind:'queueTitle'}>){
    const art=this.image('/ui/arena-lab/native/edict-register-native.webp');
    if(art)ctx.drawImage(art,3/1774*art.naturalWidth,93/887*art.naturalHeight,1768/1774*art.naturalWidth,654/887*art.naturalHeight,0,12,512,190);
    else {rounded(ctx,10,12,492,190,18);ctx.fillStyle='#622e22';ctx.fill();}
    ctx.font=`800 68px ${this.font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#2a130b';ctx.lineWidth=5;
    const label=this.locale==='ru'?'УКАЗЫ':'EDICTS';ctx.strokeText(label,256,95);ctx.fillStyle='#fff0c5';ctx.fillText(label,256,95);
    this.badge(ctx,String(face.own),196,166,'#315e59',25);
    this.badge(ctx,String(face.enemy),316,166,'#713b32',25);
  }

  private drawOrders(ctx:CanvasRenderingContext2D,face:Extract<Face,{kind:'orders'}>){
    const {gas,max}=face,layout=ordersLayout(face.portrait);
    const view=ordersView(gas,max),art=this.image('/ui/arena-lab/gas-socket.webp');
    // Paint the sockets and counter from the same snapshot in one layer.
    // The HUD plane is wider than its 1248×160 texture. Compensate in texture
    // space so each gem remains round on the table, inset inside its painted rim.
    const radius=layout.radius*1248/layout.width;
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

  /** Phone court pieces prioritise the portrait, attack and health. Tap for full rules. */
  private drawCompactMinion(ctx:CanvasRenderingContext2D,minion:Minion,ready=false,readiness?:FighterReadiness){
    ctx.save();ctx.scale(1,BATTLE_FACE.height/384);
    rounded(ctx,9,9,366,366,56);ctx.fillStyle='#392419';ctx.fill();ctx.save();ctx.clip();
    const art=this.image(cardArtPath(minion.cardId));if(art)cover(ctx,art,17,17,350,350);
    const shade=ctx.createLinearGradient(0,220,0,375);shade.addColorStop(0,'#20120b00');shade.addColorStop(1,'#20120bed');ctx.fillStyle=shade;ctx.fillRect(9,220,366,155);ctx.restore();
    rounded(ctx,9,9,366,366,56);ctx.strokeStyle=ready?'#f0c778':minion.taunt?'#efd295':'#ba8d4e';ctx.lineWidth=12;ctx.stroke();
    // Phone pieces cannot carry a paragraph at 60px wide. Show a large name
    // cue; tapping retains the full name, original portrait and exact rules.
    const label=cardName(minion.cardId,this.locale).split(' ')[0];
    rounded(ctx,24,236,336,58,12);ctx.fillStyle='#21130bdd';ctx.fill();
    ctx.font=`800 64px ${this.font}`;const nameSize=Math.min(64,64*284/Math.max(1,ctx.measureText(label).width));
    ctx.font=`800 ${nameSize}px ${this.font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff5df';ctx.fillText(label,192,266);
    this.badge(ctx,String(minion.attack),61,327,'#ab832e',46);this.badge(ctx,String(Math.max(0,minion.health)),323,327,'#a8322f',46);
    this.drawStatus(ctx,minion,ready,readiness,46);
    if(minion.taunt)drawRomanSymbol(ctx,'shield',192,329,49,'#edce91');ctx.restore();
  }

  private drawMinion(ctx: CanvasRenderingContext2D, minion: Minion, ready=false,readiness?:FighterReadiness) {
    paintCardFace(ctx,minion.cardId,this.locale,this.font,this.image(cardArtPath(minion.cardId)),ready,minion,this.image(cardFramePath(CARDS[minion.cardId].rarity)),'battlefield');
    this.drawStatus(ctx,minion,ready,readiness,43);
    if(minion.lifesteal){
      this.badge(ctx,'',312,270,'#632d29',24);drawRomanSymbol(ctx,'drop',312,270,30,'#f0c8a9');
    }
  }

  private drawStatus(ctx:CanvasRenderingContext2D,minion:Minion,ready:boolean,readiness:FighterReadiness|undefined,radius:number){
    const available=ready||readiness==='ready'||readiness==='rush';
    const symbol:RomanSymbol=minion.staked?'lock':available?'gladius':readiness==='fresh'||readiness==='waiting'||readiness==='no-target'?'hourglass':'spent';
    const atlas=this.image('/ui/cards/status-v2/action-medallions.webp'),index=symbol==='gladius'?0:symbol==='hourglass'?1:symbol==='spent'?2:3;
    if(atlas){const w=atlas.naturalWidth/2,h=atlas.naturalHeight/2,size=radius*2.2;ctx.drawImage(atlas,index%2*w,Math.floor(index/2)*h,w,h,323-size/2,61-size/2,size,size);}
    else{this.badge(ctx,'',323,61,minion.staked?'#315e59':available?'#773222':'#514335',radius);drawRomanSymbol(ctx,symbol,323,61,radius*1.4,available?'#fff0bd':'#edce91');}
  }

  private drawHero(ctx: CanvasRenderingContext2D, id: string, treasury: number, aspect=1, framed=false) {
    const art=this.image(heroPortraitPath(id));
    // Use only the inner relief. The painting supplies the single physical rim.
    const bounds:Record<string,number[]>={builder:[44,37,1164,1164],degen:[34,37,1186,1177],validator:[31,35,1189,1185],whale:[40,38,1173,1172]};
    ctx.save();ctx.beginPath();ctx.arc(192,192,156,0,Math.PI*2);ctx.clip();
    if(art){const [x,y,w,h]=bounds[id]??[0,0,1254,1254];const inset=.1;ctx.drawImage(art,(x+w*inset)/1254*art.naturalWidth,(y+h*inset)/1254*art.naturalHeight,w*(1-inset*2)/1254*art.naturalWidth,h*(1-inset*2)/1254*art.naturalHeight,36,36,312,312);}
    ctx.restore();if(framed){ctx.strokeStyle='#50301a';ctx.lineWidth=17;ctx.beginPath();ctx.arc(192,192,157,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#dcba72';ctx.lineWidth=5;ctx.stroke();}ctx.save();ctx.translate(319,303);ctx.scale(1,aspect);
    this.badge(ctx,`${Math.max(0,treasury)}`,0,0,'#a8322f',46);ctx.restore();
  }

  private drawPower(ctx: CanvasRenderingContext2D, face: Extract<Face, { kind: 'power' }>) {
    const atlas = this.image('/ui/arena-lab/power-medallions.webp');
    const index = ['builder', 'whale', 'degen', 'validator'].indexOf(face.heroId);
    ctx.save(); ctx.globalAlpha = face.available ? 1 : .65;
    if (face.model) {
      ctx.beginPath(); ctx.arc(192,182,153,0,Math.PI*2);
      ctx.strokeStyle = '#d3b074'; ctx.lineWidth = 10; ctx.stroke();
    } else if (atlas&&index>=0) {
      // Measured alpha bounds; generated atlas spacing is not assumed to be exact.
      const regions = [[.049924,.003361,.43646,.484874],[.515885,.005042,.434191,.482353],[.044629,.481092,.440242,.489076],[.515129,.481513,.440242,.489076]];
      const [x,y,w,h] = regions[Math.max(0,index)];
      // Use just the relief, leaving the board's own painted ring visible.
      ctx.beginPath();ctx.arc(192,192,161,0,Math.PI*2);ctx.clip();
      ctx.drawImage(atlas, (x+w*.1)*atlas.naturalWidth, (y+h*.1)*atlas.naturalHeight, w*.8*atlas.naturalWidth, h*.8*atlas.naturalHeight, 27, 27, 330, 330);
    } else {
      this.badge(ctx, '', 192, 190, '#785b36', 140);
      const symbol:RomanSymbol=face.heroId==='athena'?'shield':face.heroId==='hermes'?'scroll':face.heroId==='hephaestus'?'hammer':face.heroId==='poseidon'?'drop':'standard';
      drawRomanSymbol(ctx,symbol,192,185,175,'#f3d591');
    }
    ctx.restore();ctx.save();ctx.translate(295,295);ctx.scale(1,face.aspect??1);
    this.badge(ctx, `${face.cost}`, 0, 0, '#246784', 48);ctx.restore();
  }

  private drawCommand(ctx: CanvasRenderingContext2D, state: Extract<Face, { kind: 'command' }>['state'], engraved = false, portrait = false,compact=false) {
    const available=state==='own'||state==='done';
    // Clip the generated material to the measured opening, including its perspective skew.
    // The board artwork continues to own the entire outer bronze frame.
    ctx.save();ctx.beginPath();(portrait?PORTRAIT_TURN_INLAY_OUTLINE:TURN_INLAY_OUTLINE).forEach(([x,y],i)=>{if(i)ctx.lineTo(x*768,y*336);else ctx.moveTo(x*768,y*336);});ctx.closePath();ctx.clip();
    const art=this.image('/ui/arena-lab/native/turn-button-v2/context.webp');
    if(art){
      // The illustration was generated in the actual arena screenshot. Sample
      // only its pressure plate; the measured socket still owns the outer rim.
      ctx.filter=available?'none':'saturate(0.55) brightness(0.72)';
      ctx.drawImage(art,art.naturalWidth*.278,art.naturalHeight*.254,art.naturalWidth*.566,art.naturalHeight*.371,0,0,768,336);
      ctx.filter='none';
    }else{
      const leather=ctx.createLinearGradient(0,0,0,336);leather.addColorStop(0,'#7c241c');leather.addColorStop(.5,'#5a1814');leather.addColorStop(1,'#29130f');
      ctx.fillStyle=leather;ctx.fillRect(0,0,768,336);
    }
    const labels=compact?[available?(this.locale==='ru'?'КОНЕЦ':'END TURN'):state==='enemy'?(this.locale==='ru'?'СОПЕРНИК':'OPPONENT'):state==='busy'?(this.locale==='ru'?'БОЙ':'RESOLVING'):(this.locale==='ru'?'ИТОГ':'RESULT')]:available?(this.locale==='ru'?['КОНЕЦ','ХОДА']:['END','TURN']):state==='enemy'?(this.locale==='ru'?['ХОД','СОПЕРНИКА']:['OPPONENT',"TURN"]):state==='busy'?(this.locale==='ru'?['ИДЁТ','БОЙ']:['RESOLVING']):(this.locale==='ru'?['БОЙ','ОКОНЧЕН']:['BATTLE','OVER']);
    const roman=getComputedStyle(document.body).getPropertyValue('--font-roman').trim()||this.font;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const gold=ctx.createLinearGradient(0,72,0,265);gold.addColorStop(0,available?'#fff4cb':'#dfd0b1');gold.addColorStop(.48,available?'#f5d995':'#c8b58e');gold.addColorStop(.52,available?'#c3944e':'#a58c64');gold.addColorStop(1,available?'#ffe5ab':'#d6c39d');
    labels.forEach((label,i)=>{const base=compact?138:92;ctx.font=`800 ${base}px ${roman}`;const size=Math.min(base,base*(compact?490:450)/Math.max(1,ctx.measureText(label).width));ctx.font=`800 ${size}px ${roman}`;const y=labels.length===1?166:119+i*94,x=384;ctx.fillStyle='#260a08';ctx.shadowColor='#160604';ctx.shadowBlur=6;ctx.shadowOffsetY=5;ctx.fillText(label,x,y+3);ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle=gold;ctx.fillText(label,x,y);});
    ctx.restore();
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
