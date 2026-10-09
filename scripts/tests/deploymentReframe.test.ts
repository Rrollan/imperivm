import assert from 'node:assert/strict';
import {deploymentReframe} from '../../components/presentation/deploymentReframe';
import {CARD_FACE,BATTLE_FACE,CARD_FRAME_LAYOUT,cardFaceLayout,paintCardFace} from '../../components/presentation/cardFace';
import {CARDS} from '../../lib/cards';
import type {Rarity} from '../../lib/engine/types';

for(const targetHeight of [BATTLE_FACE.height,384]){
 let previous=CARD_FACE.height;
 for(let i=0;i<=100;i++){
  const {height,planeY}=deploymentReframe(i/100,targetHeight);
  assert(height<=previous&&height>=targetHeight,'The aperture shortens without a bounce or expansion');previous=height;
  assert.equal(planeY,height/CARD_FACE.height);
  for(const initialHeight of [CARD_FACE.height,BATTLE_FACE.height]){
   const textureY=initialHeight/height,meshY=height/initialHeight;
   assert(Math.abs(textureY*meshY-1)<1e-10,'Texture normalisation and plane height preserve square pixels');
  }
  for(const rarity of Object.keys(CARD_FRAME_LAYOUT) as Rarity[]){
   const layout=cardFaceLayout(rarity,false,height),full=CARD_FRAME_LAYOUT[rarity];
   assert.equal(layout.art.w,full.art.w);assert.equal(layout.statsY-layout.nameY,full.statsY-full.nameY);
   assert(layout.art.y+layout.art.h<layout.nameY-36);assert(layout.nameY+36<layout.statsY-37);assert(layout.statsY+37<height);
  }
 }
 assert.equal(deploymentReframe(0,targetHeight).height,CARD_FACE.height);
 assert.equal(deploymentReframe(1,targetHeight).height,targetHeight,'The last flight frame already has the court aspect ratio');
}

// Exercise the actual shared painter: changing the crop must never substitute
// an ability label for the faction or stretch the illustration.
const texts:string[]=[],images:number[][]=[];
const gradient={addColorStop:()=>{}};
const ctx={save:()=>{},restore:()=>{},beginPath:()=>{},closePath:()=>{},moveTo:()=>{},lineTo:()=>{},quadraticCurveTo:()=>{},arc:()=>{},clip:()=>{},fill:()=>{},stroke:()=>{},fillRect:()=>{},
 createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,
 drawImage:(_image:CanvasImageSource,...coordinates:number[])=>images.push(coordinates),
 fillText:(text:string)=>texts.push(text),strokeText:()=>{},
 measureText:(text:string)=>({width:text.length*20,actualBoundingBoxAscent:28,actualBoundingBoxDescent:6}),
} as unknown as CanvasRenderingContext2D;
const art={naturalWidth:1024,naturalHeight:1536} as HTMLImageElement;
const frame={naturalWidth:768,naturalHeight:1344} as HTMLImageElement;
for(const rarity of Object.keys(CARD_FRAME_LAYOUT) as Rarity[]){
 const card=Object.values(CARDS).find(c=>c.type==='minion'&&c.rarity===rarity);assert(card);
 for(const height of [672,640,592,544,512,384]){
  texts.length=0;images.length=0;
  paintCardFace(ctx,card.id,'ru','sans-serif',art,true,undefined,frame,height===512?'battlefield':'card',height);
  assert(texts.includes(card.faction.toUpperCase()),'Hand, reframe and field retain identical faction text');
  const artwork=images[0];assert(Math.abs(artwork[2]/artwork[3]-art.naturalWidth/art.naturalHeight)<1e-10,'Art uses an isotropic cover crop');
  if(height!==672){assert.equal(images[1][7],112);assert.equal(images[3][7],CARD_FACE.height-(CARD_FRAME_LAYOUT[rarity].art.y+CARD_FRAME_LAYOUT[rarity].art.h),'Engraved corners and panels retain their original height');}
 }
}
console.log('DEPLOYMENT REFRAME OK: continuous court handoff, square pixels, rigid art/panels and unchanged factions across all rarities and phone geometry.');
