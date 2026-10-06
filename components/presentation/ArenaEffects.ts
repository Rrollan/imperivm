import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PresentationBatch } from './GameSession';
import {battleFloats,type FloatKind} from './battleFloats';
import {EFFECT_POOL_SIZE,type EffectTimeline} from './effectTimeline';

type Flash = { mesh: Mesh; texture: DynamicTexture; material: StandardMaterial; origin: Vector3; kind: FloatKind };
const MAX_FLASHES=EFFECT_POOL_SIZE;

/** Transient feedback uses the same battle clock and camera as the pieces. */
export class ArenaEffects {
  private aimTexture: DynamicTexture;
  private aimMesh: Mesh;
  private aimMaterial: StandardMaterial;
  private flashes: Flash[] = [];
  private pool: Flash[]=[];
  private timeline:EffectTimeline|null=null;
  private locate:((uid:string)=>Vector3|undefined)|null=null;
  private windowStart=-1;
  private pendingAim: {from:Vector3;to:Vector3;valid:boolean;sourceInset:number;targetInset:number;headLength:number}|null=null;
  private aimKey='';

  constructor(private scene: Scene, private invalidate: () => void) {
    this.aimTexture = new DynamicTexture('target arrow', {width:1600,height:1000}, scene, false);
    this.aimTexture.hasAlpha = true;
    this.aimMaterial = this.ink('arrow ink', this.aimTexture);
    this.aimMesh = MeshBuilder.CreatePlane('targeting arc',{width:32,height:20},scene);
    this.aimMesh.position.z=-12; this.aimMesh.material=this.aimMaterial;
    this.aimMesh.isPickable=false; this.aimMesh.renderingGroupId=3; this.aimMesh.setEnabled(false);
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
  private drawAim(from:Vector3,to:Vector3,valid:boolean,sourceInset:number,targetInset:number,headLength:number) {
    const ctx=this.aimTexture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,1600,1000);
    const a={x:800+from.x*50,y:500-from.y*50},b={x:800+to.x*50,y:500-to.y*50};
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<sourceInset+targetInset+3){this.hideAim();return;}
    const unit={x:(b.x-a.x)/length,y:(b.y-a.y)/length};
    a.x+=unit.x*sourceInset;a.y+=unit.y*sourceInset;b.x-=unit.x*targetInset;b.y-=unit.y*targetInset;
    const lane=Math.hypot(b.x-a.x,b.y-a.y),bend=Math.min(70,lane*.2),shaftWidth=Math.max(2.5,Math.min(10,lane*.15));
    const control={x:(a.x+b.x)/2-unit.y*bend,y:(a.y+b.y)/2+unit.x*bend};
    ctx.lineCap='round';ctx.lineJoin='round';
    // A tapered bronze-edged ribbon, sampled along one smooth curve. The
    // silhouette stays crisp at desktop scale without a low-resolution stroke.
    const sides:[{x:number;y:number}[],{x:number;y:number}[]]=[[],[]];
    for(let i=0;i<=32;i++){
      const t=i/32,u=1-t,x=u*u*a.x+2*u*t*control.x+t*t*b.x,y=u*u*a.y+2*u*t*control.y+t*t*b.y;
      const dx=2*u*(control.x-a.x)+2*t*(b.x-control.x),dy=2*u*(control.y-a.y)+2*t*(b.y-control.y),d=Math.max(1,Math.hypot(dx,dy)),width=shaftWidth*(1-.5*t);
      sides[0].push({x:x-dy/d*width,y:y+dx/d*width});sides[1].push({x:x+dy/d*width,y:y-dx/d*width});
    }
    const gradient=ctx.createLinearGradient(a.x,a.y,b.x,b.y);gradient.addColorStop(0,valid?'#853122':'#886136');gradient.addColorStop(.5,valid?'#df5b35':'#dfb664');gradient.addColorStop(1,valid?'#f2a765':'#f7daa0');
    ctx.shadowColor='#170c08';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
    ctx.beginPath();[...sides[0],...sides[1].reverse()].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=gradient;ctx.strokeStyle='#5b341e';ctx.lineWidth=4;ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(control.x,control.y,b.x,b.y);ctx.strokeStyle=valid?'#ffdb9b':'#ffebbc';ctx.lineWidth=2;ctx.stroke();
    const angle=Math.atan2(b.y-control.y,b.x-control.x);
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(angle);
    ctx.beginPath();ctx.moveTo(headLength,0);ctx.lineTo(-headLength*.4,-headLength*.64);ctx.lineTo(-headLength*.18,0);ctx.lineTo(-headLength*.4,headLength*.64);ctx.closePath();ctx.fillStyle=valid?'#f6bd7b':'#efcc87';ctx.strokeStyle='#5b341e';ctx.lineWidth=headLength<12?1.5:3;ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(headLength*.85,0);ctx.lineTo(-headLength*.14,0);ctx.strokeStyle='#fff0c8';ctx.lineWidth=headLength<12?1:2;ctx.stroke();ctx.restore();
    if(valid){ctx.strokeStyle='#f5c98b';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(800+to.x*50,500-to.y*50,25,i*Math.PI/2+.2,i*Math.PI/2+1.1);ctx.stroke();}}
    this.aimTexture.update();this.aimMesh.setEnabled(true);
  }

  hideAim(){this.pendingAim=null;this.aimKey='';this.aimMesh.setEnabled(false);}

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
  dispose(){this.clear();this.pool.forEach(f=>{f.mesh.dispose();f.material.dispose();f.texture.dispose();});this.pool=[];this.aimMesh.dispose();this.aimTexture.dispose();this.aimMaterial.dispose();}
}
