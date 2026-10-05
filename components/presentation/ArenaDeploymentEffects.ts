import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import {cardIdentity,ROLE_COLORS,type CardRole} from './cardIdentity';

type Accent={mesh:Mesh;material:StandardMaterial;texture:DynamicTexture};
/** Six prewarmed arrival accents; particles are painted once, then transformed. */
export class ArenaDeploymentEffects{
  private accents=new Map<CardRole,Accent>();
  private current:Accent|null=null;
  private at=Vector3.Zero();
  constructor(scene:Scene,invalidate:()=>void){
    for(const role of ['legionary','guard','commander','minister','priest','engineer'] as const){
      const texture=new DynamicTexture(`arrival:${role}`,256,scene,false);texture.hasAlpha=true;
      const c=texture.getContext() as unknown as CanvasRenderingContext2D;
      c.clearRect(0,0,256,256);c.strokeStyle=ROLE_COLORS[role];c.fillStyle=c.strokeStyle;c.lineWidth=5;c.lineCap='round';
      if(role==='guard'){
        for(const side of [-1,1]){c.beginPath();c.moveTo(128+side*80,50);c.quadraticCurveTo(128+side*110,170,128+side*36,222);c.stroke();}
      }else if(role==='commander'||role==='priest'){
        for(const side of [-1,1])for(let i=0;i<5;i++){c.beginPath();c.ellipse(128+side*(42+i*8),205-i*25,12,4,side*.75,0,Math.PI*2);c.fill();}
      }else if(role==='engineer'){
        c.beginPath();for(let i=0;i<7;i++){const a=i*Math.PI/3;c.lineTo(128+Math.cos(a)*82,128+Math.sin(a)*64);}c.stroke();
      }else{c.beginPath();c.ellipse(128,156,91,role==='minister'?50:25,0,.15,Math.PI-.15);c.stroke();}
      for(let i=0;i<8;i++){const a=i*Math.PI/4+.15;c.beginPath();c.ellipse(128+Math.cos(a)*105,145+Math.sin(a)*55,3,role==='commander'?8:4,a,0,Math.PI*2);c.fill();}
      texture.update();
      const material=new StandardMaterial(`arrival:${role}`,scene);material.diffuseColor=Color3.Black();material.emissiveColor=Color3.White();material.specularColor=Color3.Black();material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;material.diffuseTexture=texture;material.emissiveTexture=texture;
      const mesh=MeshBuilder.CreatePlane(`arrival:${role}`,{width:3.7,height:3.7},scene);mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=2;mesh.setEnabled(false);
      this.accents.set(role,{mesh,material,texture});void material.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});
    }
  }
  begin(id:string,at:Vector3){this.clear();this.current=this.accents.get(cardIdentity(id).role)??null;this.at.copyFrom(at);}
  tick(progress:number,contact:number,reduced:boolean){
    const effect=this.current;if(!effect)return;
    const t=(progress-contact)/(1-contact);effect.mesh.setEnabled(t>=0&&t<1);if(t<0||t>=1)return;
    effect.mesh.position.copyFrom(this.at);effect.mesh.position.z=-7;
    effect.mesh.scaling.setAll(reduced?1:.88+.2*(1-(1-t)**3));effect.material.alpha=reduced?.3:Math.sin(Math.min(1,t*3)*Math.PI/2)*(1-t)*.9;
  }
  clear(){this.current?.mesh.setEnabled(false);this.current=null;}
  dispose(){this.clear();this.accents.forEach(e=>{e.mesh.dispose();e.material.dispose();e.texture.dispose();});this.accents.clear();}
}
