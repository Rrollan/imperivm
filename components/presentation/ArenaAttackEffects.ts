import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import type {CombatStyle} from './combatStyle';
import {smooth} from './motionSpec';

/** A pooled projectile, charge and fading wake, tied to the actual contact frame. */
export class ArenaAttackEffects {
  private textures: DynamicTexture[];
  private pieces: {mesh: Mesh; material: StandardMaterial}[];
  private live: {style: CombatStyle; from: Vector3; to: Vector3} | null = null;
  constructor(scene: Scene, invalidate: () => void) {
    this.textures = ['orb', 'bolt'].map(kind => {
      const texture = new DynamicTexture(`attack ${kind}`, 256, scene, false);
      texture.hasAlpha = true;
      const c = texture.getContext() as unknown as CanvasRenderingContext2D;
      const glow = c.createRadialGradient(128,128,3,128,128,118);
      glow.addColorStop(0,'#ffffff');glow.addColorStop(.2,'#ffffffcc');glow.addColorStop(.55,'#ffffff33');glow.addColorStop(1,'#ffffff00');
      c.fillStyle=glow;c.fillRect(0,0,256,256);
      c.strokeStyle='#ffffffee';c.fillStyle='#ffffff';c.lineJoin='round';
      if(kind==='bolt') {c.beginPath();c.moveTo(28,128);c.lineTo(178,118);c.lineTo(178,100);c.lineTo(232,128);c.lineTo(178,156);c.lineTo(178,138);c.closePath();c.fill();}
      else {c.lineWidth=3;c.beginPath();c.arc(128,128,54,0,Math.PI*2);c.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(128+Math.cos(a)*36,128+Math.sin(a)*36);c.lineTo(128+Math.cos(a)*76,128+Math.sin(a)*76);c.stroke();}}
      texture.update();return texture;
    });
    this.pieces = Array.from({length: 9}, (_, i) => {
      const mesh=MeshBuilder.CreatePlane(`combat projectile ${i}`,{size:1},scene);
      const material=new StandardMaterial(`combat projectile ${i}`,scene);
      material.disableLighting=true;material.diffuseColor=Color3.Black();material.specularColor=Color3.Black();material.useAlphaFromDiffuseTexture=true;
      material.diffuseTexture=this.textures[0];material.emissiveTexture=this.textures[0];mesh.material=material;
      mesh.isPickable=false;mesh.renderingGroupId=2;mesh.setEnabled(false);
      void material.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});
      return {mesh,material};
    });
  }
  begin(style: CombatStyle, from?: Vector3, to?: Vector3) {
    this.clear();if(style.delivery==='melee'||!from||!to)return;
    this.live={style,from:from.clone(),to:to.clone()};
    const texture=this.textures[style.delivery==='bolt'?1:0];
    this.pieces.forEach(({material})=>{material.diffuseTexture=texture;material.emissiveTexture=texture;material.emissiveColor=Color3.FromHexString(style.color);});
  }
  tick(progress: number, contact: number, reduced: boolean) {
    if(!this.live)return;
    const {style,from,to}=this.live,phase=progress/contact;
    const angle=Math.atan2(to.y-from.y,to.x-from.x);
    this.pieces.forEach(({mesh,material},i)=>{
      const p=phase-i*.045;
      mesh.setEnabled(!reduced&&p>=0&&p<=1.08&&progress<=contact+.09);
      if(!mesh.isEnabled())return;
      const travel=smooth(Math.max(0,Math.min(1,(p-.22)/.78)));
      mesh.position.copyFrom(Vector3.Lerp(from,to,travel));mesh.position.z=-8-i*.01;
      const charge=p<.22?p/.22:1;
      mesh.scaling.setAll((style.delivery==='arcane'?.82:.65)*charge*(i===0?1:Math.max(.2,1-i*.1)));
      mesh.rotation.z=style.delivery==='bolt'?angle:p*Math.PI*.65;
      material.alpha=(i===0?.95:.38)*(p>1?Math.max(0,1-(p-1)/.08):1);
    });
  }
  clear(){this.live=null;this.pieces.forEach(p=>p.mesh.setEnabled(false));}
  dispose(){this.clear();this.pieces.forEach(p=>{p.mesh.dispose();p.material.dispose();});this.textures.forEach(t=>t.dispose());}
}
