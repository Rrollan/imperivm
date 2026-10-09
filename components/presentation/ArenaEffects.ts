import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PresentationBatch } from './GameSession';
import {ArenaAim3D} from './ArenaAim3D';
import {battleFloats,type FloatKind} from './battleFloats';
import {EFFECT_POOL_SIZE,type EffectTimeline} from './effectTimeline';

type Flash = { mesh: Mesh; texture: DynamicTexture; material: StandardMaterial; origin: Vector3; kind: FloatKind };
const MAX_FLASHES=EFFECT_POOL_SIZE;

/** Transient feedback uses the same battle clock and camera as the pieces. */
export class ArenaEffects {
  private aimVolume:ArenaAim3D;
  private flashes: Flash[] = [];
  private pool: Flash[]=[];
  private timeline:EffectTimeline|null=null;
  private locate:((uid:string)=>Vector3|undefined)|null=null;
  private windowStart=-1;
  private pendingAim: {from:Vector3;to:Vector3;valid:boolean;sourceInset:number;targetInset:number;headLength:number}|null=null;
  private aimKey='';

  constructor(private scene: Scene, private invalidate: () => void) {
    this.aimVolume=new ArenaAim3D(scene,invalidate);
    for(let i=0;i<MAX_FLASHES;i++)this.allocate();
  }

  private allocate(){
    const texture=new DynamicTexture(`contact ${this.pool.length}`,256,this.scene,false);texture.hasAlpha=true;
    texture.getContext().clearRect(0,0,256,256);texture.update();
    const material=this.ink(`contact ${this.pool.length}`,texture);
    const mesh=MeshBuilder.CreatePlane(`contact ${this.pool.length}`,{width:3.5,height:3.5},this.scene);
    mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=3;mesh.position.z=-11;mesh.setEnabled(false);
    const flash:Flash={mesh,texture,material,origin:Vector3.Zero(),kind:'damage'};this.pool.push(flash);
    void material.forceCompilationAsync(mesh).then(this.invalidate).catch(()=>{});return flash;
  }

  private ink(name:string,texture:DynamicTexture) {
    const material=new StandardMaterial(name,this.scene);
    material.diffuseTexture=texture; material.emissiveTexture=texture; material.emissiveColor=Color3.White();
    material.diffuseColor=Color3.Black(); material.specularColor=Color3.Black();
    material.disableLighting=true; material.useAlphaFromDiffuseTexture=true;
    return material;
  }

  aim(from:Vector3,to:Vector3,valid:boolean,sourceInset=60,targetInset=42,headLength=28) {
    const key=[from.x,from.y,to.x,to.y,sourceInset,targetInset,headLength].map(v=>Math.round(v*25)).join(':')+valid;
    if(key===this.aimKey)return;this.aimKey=key;
    this.pendingAim={from:from.clone(),to:to.clone(),valid,sourceInset,targetInset,headLength};this.invalidate();
  }
  flush(){const pending=this.pendingAim;this.pendingAim=null;if(pending)this.drawAim(pending.from,pending.to,pending.valid,pending.sourceInset,pending.targetInset,pending.headLength);}
  private drawAim(from:Vector3,to:Vector3,valid:boolean,sourceInset:number,targetInset:number,headLength:number){this.aimVolume.update(from,to,valid,sourceInset,targetInset,headLength);}
  lockAimTarget(position:Vector3|undefined,width?:number,height?:number,oval?:boolean){this.aimVolume.lock(position,width,height,oval);}
  addReadyGlow(mesh:Mesh){this.aimVolume.glow.addIncludedOnlyMesh(mesh);}
  tickAim(delta:number,reduced:boolean){this.aimVolume.tick(delta,reduced);}
  get aimAnimating(){return this.aimVolume.animating;}
  hideAim(){this.pendingAim=null;this.aimKey='';this.aimVolume.hide();}

  begin(batch:PresentationBatch,locate:(uid:string)=>Vector3|undefined,timeline:EffectTimeline|null=null) {
    this.clear();
    this.timeline=timeline;this.locate=locate;
    if(!timeline)battleFloats(batch).forEach(cue=>this.add(locate(cue.anchor),cue.label,cue.kind));
  }
  private add(position:Vector3|undefined,label:string,kind:Flash['kind']){
      if(!position||this.flashes.length>=MAX_FLASHES)return;
      const flash=this.pool[this.flashes.length];
      const {texture,mesh,material}=flash;
      const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
      ctx.clearRect(0,0,256,256);
      const colour=kind==='heal'?'#bff0b0':kind==='gas'?'#ffcf71':kind==='damage'?'#ffd4ac':kind==='weaken'?'#e6c795':'#ffe6a6';
      ctx.strokeStyle=colour;ctx.lineWidth=3;
      // Damage is a crisp readable number; the contact accent owns the small spark.
      if(kind!=='damage'&&!label){ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(128,128,72,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
      if(label){ctx.font=`800 ${label.length>3?48:72}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#3d2118';ctx.lineWidth=7;ctx.strokeText(label,128,130);ctx.fillStyle=colour;ctx.fillText(label,128,130);}
      if(kind==='weaken'){
        ctx.beginPath();ctx.moveTo(109,196);ctx.lineTo(147,165);ctx.moveTo(113,170);ctx.lineTo(140,198);ctx.strokeStyle='#3d2118';ctx.lineWidth=10;ctx.stroke();ctx.strokeStyle=colour;ctx.lineWidth=4;ctx.stroke();
      }
      texture.update();mesh.position.copyFrom(position);mesh.position.y+=kind==='heal'||kind==='buff'?.8:0;mesh.position.z=-11;mesh.scaling.setAll(1);mesh.setEnabled(false);material.alpha=1;
      if(kind==='weaken'){mesh.position.x-=.65;mesh.position.y+=.6;}
      flash.origin.copyFrom(mesh.position);flash.kind=kind;this.flashes.push(flash);
  }

  tick(progress:number,impactAt:number,reduced:boolean,durationMs:number) {
    const elapsed=(progress-impactAt)*durationMs;
    const window=this.timeline?.windows.find(w=>elapsed>=w.contactMs&&elapsed<w.endMs);
    if(this.timeline&&(window?.startMs??-1)!==this.windowStart){
      this.flashes.forEach(f=>f.mesh.setEnabled(false));this.flashes=[];this.windowStart=window?.startMs??-1;
      if(window)this.timeline.floats.filter(c=>c.window===window).forEach(({cue})=>this.add(this.locate?.(cue.anchor),cue.label,cue.kind));
    }
    const t=this.timeline?(window?(elapsed-window.contactMs)/(window.endMs-window.contactMs):-1):(progress-impactAt)/(1-impactAt);
    this.flashes.forEach(({mesh,material,origin})=>{
      mesh.setEnabled(t>=0&&t<1);if(t<0)return;
      material.alpha=Math.max(0,1-t*t);
      mesh.scaling.setAll(reduced?1:1+Math.sin(t*Math.PI)*.04);
      mesh.position.y=origin.y+(reduced?0:t*.45);
    });
  }

  clear(){this.hideAim();this.flashes.forEach(f=>f.mesh.setEnabled(false));this.flashes=[];this.timeline=null;this.locate=null;this.windowStart=-1;}
  dispose(){this.clear();this.pool.forEach(f=>{f.mesh.dispose();f.material.dispose();f.texture.dispose();});this.pool=[];this.aimVolume.dispose();}
}
