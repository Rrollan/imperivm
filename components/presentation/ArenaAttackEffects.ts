import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import type {CombatStyle} from './combatStyle';
import {smooth} from './motionSpec';

const shapes=['orb','bolt','slash','shield','lightning','rift','ring'] as const;
/** Reused GPU planes: anticipation, delivery, then a contact accent. No damage is inferred here. */
export class ArenaAttackEffects {
  private textures: DynamicTexture[];
  private pieces: {mesh:Mesh;material:StandardMaterial}[];
  private live: {style:CombatStyle;from:Vector3;to:Vector3}|null=null;
  constructor(scene:Scene,invalidate:()=>void){
    this.textures=shapes.map(kind=>{
      const texture=new DynamicTexture(`attack ${kind}`,256,scene,false);texture.hasAlpha=true;
      const c=texture.getContext() as unknown as CanvasRenderingContext2D;
      const glow=c.createRadialGradient(128,128,2,128,128,116);
      glow.addColorStop(0,'#ffffffdd');glow.addColorStop(.25,'#ffffff88');glow.addColorStop(.65,'#ffffff18');glow.addColorStop(1,'#ffffff00');
      c.fillStyle=glow;c.fillRect(0,0,256,256);c.strokeStyle='#fff';c.fillStyle='#fff';c.lineJoin='round';c.lineCap='round';c.lineWidth=6;c.shadowColor='#251121';c.shadowBlur=8;
      c.beginPath();
      if(kind==='slash'){c.moveTo(28,206);c.bezierCurveTo(68,70,161,21,229,30);c.bezierCurveTo(118,85,94,111,28,206);c.fill();}
      else if(kind==='bolt'){c.moveTo(22,128);c.lineTo(177,116);c.lineTo(173,95);c.lineTo(235,128);c.lineTo(173,160);c.lineTo(177,139);c.closePath();c.fill();}
      else if(kind==='lightning'){c.moveTo(12,128);c.lineTo(70,118);c.lineTo(59,144);c.lineTo(129,111);c.lineTo(116,144);c.lineTo(227,124);c.stroke();}
      else if(kind==='shield'){c.moveTo(128,39);c.lineTo(189,62);c.lineTo(182,149);c.quadraticCurveTo(161,186,128,211);c.quadraticCurveTo(94,187,74,149);c.lineTo(67,62);c.closePath();c.stroke();c.beginPath();c.moveTo(128,76);c.lineTo(153,125);c.lineTo(128,172);c.lineTo(103,125);c.closePath();c.stroke();}
      else if(kind==='rift'){c.ellipse(128,128,52,96,.3,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(128,128,34,80,.3,0,Math.PI*2);c.stroke();}
      else {c.arc(128,128,kind==='ring'?83:52,0,Math.PI*2);c.stroke();if(kind==='orb')for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(128+Math.cos(a)*29,128+Math.sin(a)*29);c.lineTo(128+Math.cos(a)*77,128+Math.sin(a)*77);c.stroke();}}
      texture.update();return texture;
    });
    this.pieces=Array.from({length:11},(_,i)=>{
      const mesh=MeshBuilder.CreatePlane(`combat accent ${i}`,{size:1},scene),material=new StandardMaterial(`combat accent ${i}`,scene);
      material.disableLighting=true;material.diffuseColor=Color3.Black();material.specularColor=Color3.Black();material.useAlphaFromDiffuseTexture=true;
      // Texture supplies the silhouette; emission supplies the style's color without adding white.
      material.diffuseTexture=this.textures[0];material.useEmissiveAsIllumination=true;mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=2;mesh.setEnabled(false);
      void material.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});return {mesh,material};
    });
  }
  begin(style:CombatStyle,from?:Vector3,to?:Vector3){
    this.clear();if(!from||!to)return;this.live={style,from:from.clone(),to:to.clone()};
    const shape=style.shape??(style.delivery==='melee'?'slash':style.delivery==='bolt'?'bolt':'orb');
    this.pieces.forEach(({material},i)=>{const texture=this.textures[shapes.indexOf(i===10?'ring':shape)];material.diffuseTexture=texture;material.emissiveColor=Color3.FromHexString(style.color);});
  }
  tick(progress:number,contact:number,reduced:boolean){
    if(!this.live)return;const {style,from,to}=this.live,phase=progress/contact,angle=Math.atan2(to.y-from.y,to.x-from.x);
    this.pieces.forEach(({mesh,material},i)=>{
      if(reduced){mesh.setEnabled(false);return;}
      if(i===10){const t=(progress-contact)/.28;mesh.setEnabled(t>=0&&t<=1);if(mesh.isEnabled()){mesh.position.copyFrom(to);mesh.position.z=-8;mesh.scaling.setAll(.6+smooth(t)*2.3);material.alpha=.96*(1-t);mesh.rotation.z=0;}return;}
      if(style.delivery==='melee'){
        const t=(progress-contact+.04)/.22;mesh.setEnabled(i===0&&t>=0&&t<=1);if(!mesh.isEnabled())return;
        mesh.position.copyFrom(to);mesh.position.z=-8;mesh.scaling.setAll((style.shape==='shield'?1.65:2.35)*(.75+.25*smooth(t)));mesh.rotation.z=style.shape==='shield'?0:angle-.75;material.alpha=Math.sin(t*Math.PI)*.92;return;
      }
      const p=phase-i*.036;mesh.setEnabled(p>=0&&p<=1.1&&progress<=contact+.08);if(!mesh.isEnabled())return;
      const travel=smooth((p-.25)/.75);mesh.position.copyFrom(Vector3.Lerp(from,to,travel));mesh.position.z=-8-i*.01;
      const charge=Math.min(1,p/.25),size=style.shape==='rift'?1.25:style.shape==='lightning'?1.3:1.1;
      mesh.scaling.setAll(size*charge*(i===0?1:Math.max(.2,1-i*.09)));mesh.rotation.z=style.delivery==='bolt'?angle:style.shape==='rift'?0:p*Math.PI*.55;
      material.alpha=(i===0?1:.52)*(p>1?Math.max(0,1-(p-1)/.1):1);
    });
  }
  clear(){this.live=null;this.pieces.forEach(p=>p.mesh.setEnabled(false));}
  dispose(){this.clear();this.pieces.forEach(p=>{p.mesh.dispose();p.material.dispose();});this.textures.forEach(t=>t.dispose());}
}
