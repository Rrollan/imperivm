import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import {CARDS} from '../../lib/cards';
import type {FighterBounds} from './deploymentGeometry';

type Particle={mesh:Mesh;kind:'dust'|'chip'|'spark';x:number;y:number;vx:number;vy:number;vz:number;delay:number;life:number;size:number;spin:number};
type Contact={at:Vector3;bounds:FighterBounds;elapsed:number;duration:number;heavy:boolean;follow?:()=>Vector3|undefined};

/** Pooled physical debris and a live cast shadow, lit in the table's coordinate system. */
export class ArenaDeploymentEffects {
  private shadow:Mesh;private shadowMaterial:StandardMaterial;
  private particles:Particle[]=[];private materials:StandardMaterial[]=[];private textures:DynamicTexture[]=[];
  private accent:StandardMaterial;private current:Contact|null=null;private airborne=false;
  constructor(scene:Scene,private invalidate:()=>void){
    const ink=(name:string,size:number,draw:(c:CanvasRenderingContext2D)=>void)=>{const texture=new DynamicTexture(name,size,scene,false);texture.hasAlpha=true;draw(texture.getContext() as unknown as CanvasRenderingContext2D);texture.update();this.textures.push(texture);return texture;};
    const unlit=(name:string,texture?:DynamicTexture,color='#ffffff')=>{const m=new StandardMaterial(name,scene);m.disableLighting=true;m.diffuseColor=Color3.Black();m.emissiveColor=Color3.FromHexString(color);if(texture){m.diffuseTexture=texture;m.emissiveTexture=texture;m.useAlphaFromDiffuseTexture=true;}this.materials.push(m);return m;};
    const shadowInk=ink('soft card shadow',256,c=>{for(let i=18;i>0;i--){c.beginPath();c.roundRect(26-i,22-i,204+i*2,212+i*2,17+i);c.fillStyle=`rgba(33,19,10,${.024*(1-i/22)})`;c.fill();}});
    this.shadowMaterial=unlit('card contact shadow',shadowInk);this.shadow=MeshBuilder.CreatePlane('live card shadow',{size:1},scene);this.shadow.material=this.shadowMaterial;this.shadow.isPickable=false;this.shadow.renderingGroupId=0;this.shadow.setEnabled(false);
    const dustInk=ink('surface dust puff',128,c=>{const g=c.createRadialGradient(64,64,2,64,64,62);g.addColorStop(0,'rgba(178,132,76,.24)');g.addColorStop(.4,'rgba(187,146,96,.12)');g.addColorStop(1,'rgba(187,146,96,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});
    const dust=unlit('warm marble dust',dustInk),spark=unlit('bronze glint',undefined,'#ffe7b0');this.accent=unlit('faction contact glint',undefined,'#ffe7b0');
    const bronze=new StandardMaterial('contact bronze fragments',scene);bronze.diffuseColor=Color3.FromHexString('#a77a36');bronze.specularColor=Color3.FromHexString('#ffe2a1');bronze.specularPower=48;this.materials.push(bronze);
    for(let i=0;i<36;i++){
      const kind=i<12?'dust':i<24?'chip':'spark';
      const mesh=kind==='chip'?MeshBuilder.CreateBox('bronze fleck',{width:1,height:.45,depth:.3},scene):MeshBuilder.CreatePlane(kind==='dust'?'dust particle':'edge glint',{size:1},scene);
      mesh.material=kind==='dust'?dust:kind==='chip'?bronze:i%3===0?this.accent:spark;
      mesh.isPickable=false;mesh.renderingGroupId=kind==='dust'?0:1;mesh.setEnabled(false);
      this.particles.push({mesh,kind,x:0,y:0,vx:0,vy:0,vz:0,delay:0,life:0,size:0,spin:0});
    }
    this.materials.forEach(m=>{const mesh=m===this.shadowMaterial?this.shadow:this.particles.find(p=>p.mesh.material===m)?.mesh;if(mesh)void m.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});});
  }
  get active(){return this.current!==null||this.airborne;}
  flight(at:Vector3,bounds:FighterBounds,lift:number){
    this.airborne=true;this.shadow.setEnabled(true);
    const height=Math.max(0,lift),spread=1+Math.min(2,height)*.12;
    this.shadow.position.set(at.x+.035+height*.30,at.y-.06-height*.42,.5);
    this.shadow.scaling.set(bounds.width*1.15*spread,bounds.height*1.13*spread,1);
    this.shadowMaterial.alpha=.9/(1+height*.35);
  }
  begin(id:string,at:Vector3,bounds:FighterBounds,reduced:boolean,follow?:()=>Vector3|undefined){
    this.clear();if(reduced)return;
    const card=CARDS[id],heavy=!!card&&(card.cost>=6||card.rarity==='legendary');
    this.current={at:at.clone(),bounds,elapsed:0,duration:heavy?680:460,heavy,follow};this.shadow.setEnabled(true);
    this.accent.emissiveColor=Color3.FromHexString(card?.faction==='DePIN'?'#9dd7dd':card?.faction==='NFT'?'#dbc1ed':card?.faction==='Meme'?'#ffc581':'#ffe7b0');
    const seed=Array.from(id).reduce((n,c)=>n+c.charCodeAt(0),0)*.01;
    this.particles.forEach((p,i)=>{
      const angle=i*2.39996+seed,nx=Math.cos(angle),ny=Math.sin(angle),amount=heavy?1:.65;
      const edge=Math.max(Math.abs(nx),Math.abs(ny));p.x=nx/edge*bounds.width*.49;p.y=ny/edge*bounds.height*.48;
      const horizontal=Math.max(.06,Math.min(bounds.width*.23,bounds.spacing*.46-bounds.width*.46));
      p.vx=nx*horizontal*(.55+i%4*.13)*amount;p.vy=ny*bounds.height*.19*amount;
      p.vz=(.13+i%5*.065)*amount;p.delay=i%4*12;p.life=p.kind==='spark'?170+i%5*20:p.kind==='chip'?340+i%5*34:390+i%4*50;
      p.size=p.kind==='dust'?.42+i%4*.10:p.kind==='chip'?.045+i%4*.013:.15+i%4*.032;p.spin=angle;
      p.mesh.setEnabled(heavy||i%3!==2);
    });
    this.paint(this.current);this.invalidate();
  }
  tick(delta:number){const c=this.current;if(!c)return;c.elapsed+=delta;if(c.elapsed>=c.duration){this.clear();return;}const at=c.follow?.();if(at)c.at.copyFrom(at);this.paint(c);}
  private paint(c:Contact){
    const age=c.elapsed/c.duration;
    this.shadow.position.set(c.at.x+.035,c.at.y-.06,.5);this.shadow.scaling.set(c.bounds.width*1.15,c.bounds.height*1.13,1);this.shadowMaterial.alpha=.62*(1-age)**1.5;
    this.particles.forEach((p,i)=>{
      const t=(c.elapsed-p.delay)/p.life,enabled=t>=0&&t<1&&(c.heavy||i%3!==2);p.mesh.setEnabled(enabled);if(!enabled)return;
      const travel=1-(1-t)**3,height=Math.sin(t*Math.PI)*p.vz;
      p.mesh.position.set(c.at.x+p.x+p.vx*travel,c.at.y+p.y+p.vy*travel,p.kind==='dust'?.45:-.22-height);
      p.mesh.visibility=(1-t)**(p.kind==='dust'?1:1.6);
      if(p.kind==='dust'){const size=p.size*(.65+travel);p.mesh.scaling.set(size*1.3,size,1);p.mesh.rotation.z=p.spin;}
      else if(p.kind==='chip'){p.mesh.scaling.setAll(p.size);p.mesh.rotation.set(p.spin+t*5,p.spin+t*8,p.spin+t*4);}
      else {p.mesh.scaling.set(p.size*.24,p.size*(1-t*.35),1);p.mesh.rotation.z=p.spin-Math.PI/2;}
    });
  }
  clear(){this.airborne=false;this.current=null;this.shadow.setEnabled(false);this.particles.forEach(p=>p.mesh.setEnabled(false));}
  dispose(){this.clear();this.shadow.dispose();this.particles.forEach(p=>p.mesh.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
