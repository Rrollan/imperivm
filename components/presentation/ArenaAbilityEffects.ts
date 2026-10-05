import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import type {Scene} from '@babylonjs/core/scene';
import {abilityCues,type AccentKind,type AbilityCue} from './abilityCues';
import {smooth} from './motionSpec';
import type {PresentationBatch} from './GameSession';

type Piece={mesh:Mesh;material:StandardMaterial};
type Live={piece:Piece;cue:AbilityCue;from:Vector3;to:Vector3};

/** Small reusable accents. No bloom, video decoders or new textures during a turn. */
export class ArenaAbilityEffects {
  private glyphs=new Map<AccentKind,DynamicTexture>();
  private pool:Piece[]=[];
  private live:Live[]=[];
  constructor(private scene:Scene,private invalidate:()=>void){
    for(const kind of ['steel','heal','gas','dice','seal','buff','counter'] as const)this.glyphs.set(kind,this.glyph(kind));
    for(let i=0;i<18;i++){
      const mesh=MeshBuilder.CreatePlane(`ability ${i}`,{width:1,height:1},scene);
      const material=new StandardMaterial(`ability ${i}`,scene);
      material.diffuseColor=Color3.Black();material.emissiveColor=Color3.White();material.specularColor=Color3.Black();material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;
      material.diffuseTexture=this.glyphs.get('steel')!;material.emissiveTexture=material.diffuseTexture;
      mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=2;mesh.setEnabled(false);
      this.pool.push({mesh,material});void material.forceCompilationAsync(mesh).then(invalidate).catch(()=>{});
    }
  }
  private glyph(kind:AccentKind){
    const texture=new DynamicTexture(`ability glyph ${kind}`,128,this.scene,false);texture.hasAlpha=true;
    const c=texture.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0,0,128,128);c.strokeStyle=kind==='gas'?'#96cbd0':kind==='heal'?'#e1d4ac':kind==='steel'?'#c2a18a':'#d4b780';
    c.fillStyle=c.strokeStyle;c.lineWidth=4;c.lineCap='round';c.lineJoin='round';
    if(kind==='steel'){c.beginPath();c.moveTo(33,89);c.lineTo(89,33);c.stroke();c.lineWidth=2;c.moveTo(48,74);c.lineTo(40,41);c.moveTo(68,59);c.lineTo(93,68);c.stroke();}
    else if(kind==='gas'){c.beginPath();c.moveTo(64,25);c.lineTo(82,46);c.lineTo(64,96);c.lineTo(46,46);c.closePath();c.stroke();c.moveTo(46,46);c.lineTo(82,46);c.stroke();}
    else if(kind==='dice'){c.strokeRect(36,36,56,56);for(const [x,y] of [[49,49],[79,49],[64,64],[49,79],[79,79]]){c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}}
    else if(kind==='seal'||kind==='counter'){c.beginPath();c.arc(64,64,34,.2,Math.PI*1.9);c.stroke();c.beginPath();c.moveTo(64,40);c.lineTo(64,86);c.moveTo(44,51);c.lineTo(84,51);c.moveTo(40,71);c.lineTo(50,71);c.moveTo(78,71);c.lineTo(88,71);c.stroke();if(kind==='counter'){c.strokeStyle='#b67c65';c.moveTo(39,89);c.lineTo(89,39);c.stroke();}}
    else{for(const side of [-1,1]){c.beginPath();c.moveTo(64,99);c.quadraticCurveTo(64+side*35,73,64+side*22,32);c.stroke();for(let i=0;i<4;i++){c.beginPath();c.ellipse(64+side*(19+i),82-i*12,7,3,side*.65,0,Math.PI*2);c.fill();}}}
    texture.update();return texture;
  }
  begin(batch:PresentationBatch,locate:(uid:string)=>Vector3|undefined){
    this.clear();abilityCues(batch).forEach((cue,i)=>{
      const from=locate(cue.from),to=locate(cue.to);if(!from||!to)return;
      const piece=this.pool[i],texture=this.glyphs.get(cue.kind)!;
      piece.material.diffuseTexture=texture;piece.material.emissiveTexture=texture;
      this.live.push({piece,cue,from:from.clone(),to:to.clone()});
    });
  }
  tick(progress:number,contact:number,reduced:boolean){
    this.live.forEach(({piece:{mesh,material},cue,from,to})=>{
      const t=cue.phase==='after'?(progress-contact-cue.delay)/(1-contact-cue.delay):(progress-cue.delay)/Math.max(.01,contact-cue.delay);
      mesh.setEnabled(t>=0&&t<1);if(t<0||t>=1)return;
      const travel=reduced?1:smooth(t);
      mesh.position.copyFrom(Vector3.Lerp(from,to,travel));mesh.position.z=-8;
      if(!reduced&&Vector3.DistanceSquared(from,to)>.2)mesh.position.y+=Math.sin(t*Math.PI)*.4;
      const local=Vector3.DistanceSquared(from,to)<.2;
      const scale=local?1.4+.2*Math.sin(t*Math.PI):.85;
      mesh.scaling.setAll(scale);mesh.rotation.z=cue.kind==='dice'&&!reduced?Math.sin(t*Math.PI)*.22:0;
      material.alpha=reduced?.4:Math.sin(t*Math.PI)*.72;
    });
  }
  clear(){this.pool.forEach(p=>p.mesh.setEnabled(false));this.live=[];}
  dispose(){this.clear();this.pool.forEach(p=>{p.mesh.dispose();p.material.dispose();});this.glyphs.forEach(t=>t.dispose());this.pool=[];this.glyphs.clear();}
}
