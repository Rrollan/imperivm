import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { CARDS } from '../../lib/cards';
import { cardName, type Locale } from '../../lib/locale';
import type { Minion } from '../../lib/engine/types';

export type Face =
  | { kind: 'card'; cardId: string }
  | { kind: 'minion'; minion: Minion; ready?: boolean }
  | { kind: 'hero'; heroId: string; treasury: number; model?: boolean }
  | { kind: 'power'; heroId: string; cost: number; available: boolean; model?: boolean }
  | { kind: 'command'; state: 'own' | 'enemy' | 'busy' | 'over'; engraved?: boolean }
  | { kind: 'gas'; gas: number; max: number; engraved?: boolean }
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
    const size = initial.kind === 'command' ? { width: 768, height: 288 } : initial.kind === 'power' ? { width: 384, height: 384 } : initial.kind === 'gas' ? { width: 384, height: 256 } : { width: 384, height: 512 };
    const texture = new DynamicTexture(name, size, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    texture.hasAlpha = true;
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    let face = initial;
    const draw = () => {
      this.painting=draw;
      ctx.clearRect(0, 0, size.width, size.height);
      if (face.kind === 'back') this.drawBack(ctx);
      else if (face.kind === 'card') this.drawCard(ctx, face.cardId);
      else if (face.kind === 'minion') this.drawMinion(ctx, face.minion, face.ready);
      else if (face.kind === 'hero') this.drawHero(ctx, face.heroId, face.treasury, face.model);
      else if (face.kind === 'power') this.drawPower(ctx, face);
      else if (face.kind === 'command') this.drawCommand(ctx, face.state, face.engraved);
      else if (face.kind === 'gas') this.drawGas(ctx, face.gas, face.max, face.engraved);
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
  preloadCards(ids:string[]){ids.forEach(id=>this.image(`/cards/${id}.webp`));}

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

  private drawCard(ctx: CanvasRenderingContext2D, id: string) {
    const def = CARDS[id];
    const frame = ctx.createLinearGradient(0, 0, 384, 512);
    frame.addColorStop(0, '#d6ad58'); frame.addColorStop(.25, '#624123'); frame.addColorStop(.7, '#bd914b'); frame.addColorStop(1, '#392518');
    rounded(ctx, 9, 9, 366, 494, 24); ctx.fillStyle = frame; ctx.fill();
    rounded(ctx, 22, 22, 340, 468, 15); ctx.fillStyle = '#ecdfbb'; ctx.fill();
    ctx.save(); rounded(ctx, 29, 25, 326, 330, 9); ctx.clip();
    const art = this.image(`/cards/${id}.webp`);
    ctx.fillStyle = '#30241b'; ctx.fillRect(29, 25, 326, 330);
    if (art) contain(ctx, art, 29, 25, 326, 330);
    ctx.restore();
    ctx.fillStyle = '#3d291c'; rounded(ctx, 18, 358, 348, 79, 10); ctx.fill();
    ctx.strokeStyle = '#cfad6c'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#fff1cf'; ctx.font = `700 32px ${this.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    words(ctx, cardName(id, this.locale), 192, 390, 321, 34);
    this.badge(ctx, `${def.cost}`, 56, 61, '#246784', 45);
    if (def.type === 'minion') {
      this.badge(ctx, `${def.attack}`, 55, 469, '#aa7626', 31);
      this.badge(ctx, `${def.health}`, 329, 469, '#a83f31', 31);
    }
  }

  private drawMinion(ctx: CanvasRenderingContext2D, minion: Minion, ready=false) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(192, 225, 159, 197, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#593c24'; ctx.fill(); ctx.lineWidth = minion.taunt ? 24 : 17; ctx.strokeStyle = minion.taunt ? '#ddd1af' : '#d5aa63'; ctx.stroke();
    ctx.clip();
    const art = this.image(`/cards/${minion.cardId}.webp`);
    // Battlefield pieces use an edge-to-edge portrait. Inspection shows the full illustration.
    if (art) cover(ctx, art, 32, 27, 320, 400);
    ctx.restore();
    // Board figures communicate art, attack and health. Full rules/names live in inspection.
    this.badge(ctx, `${minion.attack}`, 67, 422, '#a87924', 49);
    this.badge(ctx, `${minion.health}`, 316, 422, '#b04334', 49);
    if (minion.staked) {
      ctx.fillStyle = '#1b5557'; ctx.beginPath(); ctx.arc(192,456,39,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#d9e5c8'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(192,443,15,Math.PI,0); ctx.stroke();
      ctx.fillStyle = '#d9e5c8'; rounded(ctx,171,442,42,35,5); ctx.fill();
    } else if(ready){
      ctx.save();ctx.translate(192,452);
      ctx.fillStyle='#49301d';ctx.strokeStyle='#e6bc6b';ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*2);ctx.fill();ctx.stroke();
      for(const angle of [-Math.PI/4,Math.PI/4]){
        ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-28);ctx.lineTo(7,-18);ctx.lineTo(5,13);ctx.lineTo(-5,13);ctx.lineTo(-7,-18);ctx.closePath();
        ctx.fillStyle='#f7e5b9';ctx.fill();ctx.strokeStyle='#806342';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#d1a253';ctx.fillRect(-12,12,24,5);ctx.fillRect(-3,17,6,12);ctx.restore();
      }
      ctx.restore();
    }
  }

  private drawHero(ctx: CanvasRenderingContext2D, id: string, treasury: number, model = false) {
    if (!model) {
    ctx.save(); rounded(ctx, 47, 23, 290, 396, 120); ctx.fillStyle = '#594124'; ctx.fill();
    ctx.lineWidth = 19; ctx.strokeStyle = '#e1bd77'; ctx.stroke(); ctx.clip();
    const art = this.image(`/heroes/${id}.webp`); if (art) cover(ctx, art, 50, 25, 284, 390);
    const gradient = ctx.createLinearGradient(0, 280, 0, 418); gradient.addColorStop(0, '#26160b00'); gradient.addColorStop(1, '#26160bee');
    ctx.fillStyle = gradient; ctx.fillRect(48, 272, 290, 150); ctx.restore();
    }
    this.badge(ctx, `${treasury}`, model ? 315 : 286, model ? 355 : 418, '#a8322f', 59);
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
      ctx.drawImage(atlas, x*atlas.naturalWidth, y*atlas.naturalHeight, w*atlas.naturalWidth, h*atlas.naturalHeight, 0, 0, 384, 384);
    } else {
      this.badge(ctx, '', 192, 190, '#785b36', 140);
      ctx.strokeStyle = '#e5c08b'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.moveTo(127,242); ctx.lineTo(243,117); ctx.moveTo(188,105); ctx.lineTo(264,174); ctx.stroke();
    }
    ctx.restore(); this.badge(ctx, `${face.cost}`, 295, 295, '#246784', 48);
  }

  private drawCommand(ctx: CanvasRenderingContext2D, state: Extract<Face, { kind: 'command' }>['state'], engraved = false) {
    const image = this.image('/ui/arena-lab/turn-command.webp');
    ctx.save(); ctx.globalAlpha = state === 'own' ? 1 : .65;
    if (!engraved) {
      if (image) ctx.drawImage(image, 0, 0, 768, 288);
      else { rounded(ctx, 10, 22, 748, 244, 30); ctx.fillStyle = '#553b24'; ctx.fill(); }
    }
    ctx.restore();
    const label = state === 'own' ? (this.locale === 'ru' ? 'Конец хода' : 'End turn') : state === 'enemy' ? (this.locale === 'ru' ? 'Ход ИИ' : 'Opponent') : state === 'busy' ? (this.locale === 'ru' ? 'Бой…' : 'Resolving…') : (this.locale === 'ru' ? 'Бой окончен' : 'Battle over');
    ctx.font = `800 85px ${this.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1d100b'; ctx.lineWidth = 9; ctx.strokeText(label, 384, 145);
    ctx.fillStyle = state === 'own' ? '#fff0c7' : '#c2b39a'; ctx.fillText(label, 384, 145);
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
    rounded(ctx, 17, 13, 350, 486, 22); ctx.fillStyle = '#3b2725'; ctx.fill();
    ctx.strokeStyle = '#d7ae63'; ctx.lineWidth = 17; ctx.stroke();
    rounded(ctx, 40, 39, 304, 435, 12); ctx.strokeStyle = '#9c7445'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#c09752'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(192, 255, 99, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `700 68px ${this.font}`; ctx.fillStyle = '#e3c88b'; ctx.textAlign = 'center'; ctx.fillText('IV', 192, 278);
    ctx.font = `700 24px ${this.font}`; ctx.fillText('IMPERIVM', 192, 432);
  }

  dispose() { this.disposed = true; this.redraws.clear(); this.waiting.clear();this.painting=null;this.images.forEach(image => { image.onload = null; image.onerror = null; }); this.images.clear(); }
}
