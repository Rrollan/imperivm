import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import {CARDS} from '../../lib/cards';
import {cardIdentity,ROLE_COLORS,type CardRole} from './cardIdentity';
import {landingDiameter,type FighterBounds} from './deploymentGeometry';

type Accent={mesh:Mesh;material:StandardMaterial;texture:DynamicTexture};
type Contact={accent:Accent;diameter:number;elapsed:number;duration:number;follow?:()=>Vector3|undefined};

/** Prewarmed surface shocks: the played card occludes their centre naturally. */
export class ArenaDeploymentEffects{
  private accents=new Map<CardRole,Accent>();
  private current:Contact|null=null;
  constructor(scene:Scene,invalidate:()=>void){
    for(const role of ['legionary','guard','commander','minister','priest','engineer'] as const){
      const texture=new DynamicTexture(`arrival:${role}`,256,scene,false);texture.hasAlpha=true;
      const c=texture.getContext() as unknown as CanvasRenderingContext2D;
      c.scale(.5,.5);
      c.clearRect(0,0,512,512);c.strokeStyle=ROLE_COLORS[role];c.fillStyle=c.strokeStyle;c.lineWidth=7;c.lineCap='round';
      // Equal X/Y radii match the orthographic card plane. Large gaps and an
      // empty centre keep the illustration and adjacent cards readable.
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3;
        c.beginPath();
        if(role==='engineer'){
          c.moveTo(256+Math.cos(angle+.08)*192,256+Math.sin(angle+.08)*192);
          c.lineTo(256+Math.cos(angle+Math.PI/3-.08)*192,256+Math.sin(angle+Math.PI/3-.08)*192);
        }else c.arc(256,256,192,angle+.09,angle+Math.PI/3-.09);
        c.stroke();
        c.save();c.translate(256+Math.cos(angle+.3)*222,256+Math.sin(angle+.3)*222);c.rotate(angle+.3);
        c.globalAlpha=.7;c.fillRect(-7,-3,role==='guard'?15:21,6);c.restore();
      }
      c.globalAlpha=.26;c.lineWidth=13;c.beginPath();c.arc(256,256,173,0,Math.PI*2);c.stroke();
      texture.update();
      const material=new StandardMaterial(`arrival:${role}`,scene);
      material.diffuseColor=Color3.Black();material.emissiveColor=Color3.White();material.specularColor=Color3.Black();
      material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;material.diffuseTexture=texture;material.emissiveTexture=texture;
      const mesh=MeshBuilder.CreatePlane(`arrival:${role}`,{size:1},scene);
      mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=0;mesh.setEnabled(false);
      this.accents.set(role,{mesh,material,texture});void material.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});
    }
  }
  get active(){return this.current!==null;}
  begin(id:string,at:Vector3,bounds:FighterBounds,reduced:boolean,follow?:()=>Vector3|undefined){
    this.clear();if(reduced)return;
    const accent=this.accents.get(cardIdentity(id).role);if(!accent)return;
    const card=CARDS[id],heavy=card.cost>=6||card.rarity==='legendary';
    this.current={accent,diameter:landingDiameter(bounds,heavy),elapsed:0,duration:heavy?650:420,follow};
    accent.mesh.position.copyFrom(at);accent.mesh.position.z=.3;accent.mesh.setEnabled(true);
    this.paint(this.current);
  }
  tick(delta:number){
    const contact=this.current;if(!contact)return;
    contact.elapsed+=delta;if(contact.elapsed>=contact.duration){this.clear();return;}
    const at=contact.follow?.();if(at){contact.accent.mesh.position.x=at.x;contact.accent.mesh.position.y=at.y;}
    this.paint(contact);
  }
  private paint(contact:Contact){
    const t=contact.elapsed/contact.duration;
    const scale=contact.diameter*(.72+.38*(1-(1-t)**3));
    contact.accent.mesh.scaling.set(scale,scale,1);
    contact.accent.material.alpha=.85*(1-t)**1.6;
  }
  clear(){this.current?.accent.mesh.setEnabled(false);this.current=null;}
  dispose(){this.clear();this.accents.forEach(e=>{e.mesh.dispose();e.material.dispose();e.texture.dispose();});this.accents.clear();}
}
