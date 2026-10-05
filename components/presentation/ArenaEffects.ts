import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PresentationBatch } from './GameSession';

type Flash = { mesh: Mesh; texture: DynamicTexture; material: StandardMaterial; origin: Vector3; kind: 'damage' | 'heal' | 'gas' | 'arrival' | 'buff' };

/** Transient feedback uses the same battle clock and camera as the pieces. */
export class ArenaEffects {
  private aimTexture: DynamicTexture;
  private aimMesh: Mesh;
  private aimMaterial: StandardMaterial;
  private flashes: Flash[] = [];
  private pool: Flash[]=[];
  private pendingAim: {from:Vector3;to:Vector3;valid:boolean}|null=null;
  private aimKey='';

  constructor(private scene: Scene, private invalidate: () => void) {
    this.aimTexture = new DynamicTexture('target arrow', {width:800,height:500}, scene, false);
    this.aimTexture.hasAlpha = true;
    this.aimMaterial = this.ink('arrow ink', this.aimTexture);
    this.aimMesh = MeshBuilder.CreatePlane('targeting arc',{width:32,height:20},scene);
    this.aimMesh.position.z=-12; this.aimMesh.material=this.aimMaterial;
    this.aimMesh.isPickable=false; this.aimMesh.renderingGroupId=3; this.aimMesh.setEnabled(false);
    for(let i=0;i<6;i++)this.allocate();
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

  aim(from:Vector3,to:Vector3,valid:boolean) {
    const key=[from.x,from.y,to.x,to.y].map(v=>Math.round(v*25)).join(':')+valid;
    if(key===this.aimKey)return;this.aimKey=key;
    this.pendingAim={from:from.clone(),to:to.clone(),valid};this.invalidate();
  }
  flush(){const pending=this.pendingAim;this.pendingAim=null;if(pending)this.drawAim(pending.from,pending.to,pending.valid);}
  private drawAim(from:Vector3,to:Vector3,valid:boolean) {
    const ctx=this.aimTexture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.setTransform(.5,0,0,.5,0,0);
    ctx.clearRect(0,0,1600,1000);
    const a={x:800+from.x*50,y:500-from.y*50},b={x:800+to.x*50,y:500-to.y*50};
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<70){this.hideAim();return;}
    const unit={x:(b.x-a.x)/length,y:(b.y-a.y)/length};
    a.x+=unit.x*60;a.y+=unit.y*60;b.x-=unit.x*42;b.y-=unit.y*42;
    const control={x:(a.x+b.x)/2+Math.min(85,length*.15),y:(a.y+b.y)/2-55};
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.shadowColor='#170c08';ctx.shadowBlur=7;ctx.shadowOffsetY=3;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(control.x,control.y,b.x,b.y);
    ctx.strokeStyle='#472417';ctx.lineWidth=9;ctx.stroke();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=valid?'#c27949':'#d7ad5a';ctx.lineWidth=5;ctx.stroke();
    const angle=Math.atan2(b.y-control.y,b.x-control.x);
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(angle);
    ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-16,-11);ctx.lineTo(-11,0);ctx.lineTo(-16,11);ctx.closePath();
    ctx.fillStyle=valid?'#dba465':'#e7c183';ctx.strokeStyle='#562817';ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.restore();
    this.aimTexture.update();this.aimMesh.setEnabled(true);
  }

  hideAim(){this.pendingAim=null;this.aimKey='';this.aimMesh.setEnabled(false);}

  begin(batch:PresentationBatch,locate:(uid:string)=>Vector3|undefined,arrival?:Vector3) {
    this.clear();
    const add=(position:Vector3|undefined,label:string,kind:Flash['kind'])=>{
      if(!position||this.flashes.length>=18)return;
      const flash=this.pool[this.flashes.length]??this.allocate();
      const {texture,mesh,material}=flash;
      const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
      ctx.clearRect(0,0,256,256);
      const colour=kind==='heal'?'#bff0b0':kind==='gas'?'#ffcf71':kind==='damage'?'#ffd4ac':'#ffe6a6';
      ctx.strokeStyle=colour;ctx.lineWidth=3;
      // Damage is a crisp readable number; the contact accent owns the small spark.
      if(kind!=='damage'&&!label){ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(128,128,72,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
      if(label){ctx.font=`800 ${label.length>3?48:72}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#3d2118';ctx.lineWidth=7;ctx.strokeText(label,128,130);ctx.fillStyle=colour;ctx.fillText(label,128,130);}
      texture.update();mesh.position.copyFrom(position);mesh.position.z=-11;mesh.scaling.setAll(1);mesh.setEnabled(false);material.alpha=1;
      flash.origin.copyFrom(mesh.position);flash.kind=kind;this.flashes.push(flash);
    };
    batch.events?.damages?.forEach(d=>{const delta=d.health-d.prevHealth;if(delta&&!batch.events?.halvings?.some(h=>h.uid===d.uid))add(locate(d.uid),`${delta>0?'+':'−'}${Math.abs(delta)}`,delta>0?'heal':'damage');});
    batch.after.players.forEach((player,owner)=>{
      const delta=player.treasury-batch.before.players[owner].treasury;
      if(delta)add(locate(`hero-${owner}`),`${delta>0?'+':'−'}${Math.abs(delta)}`,delta>0?'heal':'damage');
    });
    if(arrival)add(arrival,'','arrival');
    batch.events?.halvings?.forEach(h=>add(locate(h.uid),'+1/+1','buff'));
    if(batch.action.type==='hero-power'){
      const owner=batch.before.turn,gained=batch.after.players[owner].gas-batch.before.players[owner].gas;
      if(gained>0)add(locate(owner===0?'gas-counter':`hero-${owner}`),`+${gained}`,'gas');
      add(locate(owner===0?'hero-power':`hero-${owner}`),'','buff');
    }
    batch.events?.spellResolved?.forEach(s=>{if(!s.fizzled)add(locate(`hero-${s.owner}`),'','buff');});
  }

  tick(progress:number,impactAt:number,reduced:boolean) {
    const t=(progress-impactAt)/(1-impactAt);
    this.flashes.forEach(({mesh,material,origin,kind})=>{
      mesh.setEnabled(t>=0&&t<1);if(t<0)return;
      material.alpha=Math.max(0,1-t*t);
      mesh.scaling.setAll(reduced?1:kind==='arrival'?.85+t*.2:1+Math.sin(t*Math.PI)*.04);
      mesh.position.y=origin.y+(reduced?0:t*.45);
    });
  }

  clear(){this.hideAim();this.flashes.forEach(f=>f.mesh.setEnabled(false));this.flashes=[];}
  dispose(){this.clear();this.pool.forEach(f=>{f.mesh.dispose();f.material.dispose();f.texture.dispose();});this.pool=[];this.aimMesh.dispose();this.aimTexture.dispose();this.aimMaterial.dispose();}
}
