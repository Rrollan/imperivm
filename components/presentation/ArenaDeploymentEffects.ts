import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import {CARDS} from '../../lib/cards';
import {landingDiameter,type FighterBounds} from './deploymentGeometry';

type Layer={mesh:Mesh;material:StandardMaterial;texture:DynamicTexture};
type Contact={at:Vector3;bounds:FighterBounds;diameter:number;elapsed:number;duration:number;heavy:boolean;follow?:()=>Vector3|undefined};

/** Surface contact: warm dust, a cast shadow and a short bronze edge glint. */
export class ArenaDeploymentEffects {
  private shadow:Layer;private dust:Layer;private glint:Layer;private current:Contact|null=null;
  constructor(scene:Scene,invalidate:()=>void){
    const make=(name:string,paint:(c:CanvasRenderingContext2D)=>void)=>{const texture=new DynamicTexture(name,512,scene,false);texture.hasAlpha=true;const c=texture.getContext() as unknown as CanvasRenderingContext2D;paint(c);texture.update();const material=new StandardMaterial(name,scene);material.diffuseTexture=texture;material.emissiveTexture=texture;material.emissiveColor=Color3.Black();material.diffuseColor=Color3.Black();material.specularColor=Color3.Black();material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;const mesh=MeshBuilder.CreatePlane(name,{size:1},scene);mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=0;mesh.setEnabled(false);void material.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});return {mesh,material,texture};};
    this.shadow=make('arrival cast shadow',c=>{const g=c.createRadialGradient(256,256,50,256,256,245);g.addColorStop(0,'rgba(42,22,10,.85)');g.addColorStop(.55,'rgba(42,22,10,.5)');g.addColorStop(1,'rgba(42,22,10,0)');c.fillStyle=g;c.fillRect(0,0,512,512);});
    this.dust=make('marble surface dust',c=>{for(let i=0;i<52;i++){const angle=i*2.39996,r=128+(i%7)*13,x=256+Math.cos(angle)*r,y=256+Math.sin(angle)*r,size=9+i%17;const g=c.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,'rgba(212,163,98,.65)');g.addColorStop(1,'rgba(153,107,53,0)');c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);}for(let i=0;i<24;i++){const angle=i*2.39996,r=160+i%6*9;c.fillStyle=i%2?'#c49a61':'#e9c691';c.beginPath();c.ellipse(256+Math.cos(angle)*r,256+Math.sin(angle)*r,1.6+i%3,1,angle,0,Math.PI*2);c.fill();}});
    this.glint=make('bronze contact glint',c=>{const g=c.createLinearGradient(80,0,432,0);g.addColorStop(0,'rgba(243,194,105,0)');g.addColorStop(.35,'rgba(255,222,162,.92)');g.addColorStop(.65,'rgba(225,164,71,.75)');g.addColorStop(1,'rgba(225,164,71,0)');c.strokeStyle=g;c.lineWidth=4;for(const y of [40,472]){c.beginPath();c.moveTo(65,y);c.lineTo(447,y);c.stroke();}});
  }
  get active(){return this.current!==null;}
  begin(id:string,at:Vector3,bounds:FighterBounds,reduced:boolean,follow?:()=>Vector3|undefined){this.clear();if(reduced)return;const card=CARDS[id],heavy=!!card&&(card.cost>=6||card.rarity==='legendary');this.current={at:at.clone(),bounds,diameter:landingDiameter(bounds,heavy),elapsed:0,duration:heavy?650:420,heavy,follow};[this.shadow,this.dust,this.glint].forEach(l=>l.mesh.setEnabled(true));this.paint(this.current);}
  tick(delta:number){const contact=this.current;if(!contact)return;contact.elapsed+=delta;if(contact.elapsed>=contact.duration){this.clear();return;}const at=contact.follow?.();if(at)contact.at.copyFrom(at);this.paint(contact);}
  private paint(c:Contact){const t=c.elapsed/c.duration,spread=1-(1-t)**3;
    this.shadow.mesh.position.set(c.at.x+.06,c.at.y-.08,.25);this.shadow.mesh.scaling.set(c.bounds.width*1.25,c.bounds.height*1.18,1);this.shadow.material.alpha=.65*(1-t)**1.1;
    this.dust.mesh.position.set(c.at.x,c.at.y,.15);const size=c.diameter*(.8+.4*spread);this.dust.mesh.scaling.set(size,size,1);this.dust.material.alpha=(c.heavy?.9:.65)*(1-t)**1.6;
    this.glint.mesh.position.set(c.at.x,c.at.y,-.12);this.glint.mesh.scaling.set(c.bounds.width*1.14,c.bounds.height*1.05,1);this.glint.material.alpha=Math.max(0,1-t*3)*.75;
  }
  clear(){[this.shadow,this.dust,this.glint].forEach(l=>l.mesh.setEnabled(false));this.current=null;}
  dispose(){this.clear();[this.shadow,this.dust,this.glint].forEach(l=>{l.mesh.dispose();l.material.dispose();l.texture.dispose();});}
}
