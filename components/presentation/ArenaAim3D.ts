import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {GlowLayer} from '@babylonjs/core/Layers/glowLayer';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Curve3} from '@babylonjs/core/Maths/math.path';
import type {Scene} from '@babylonjs/core/scene';
import {aimPath} from './aimPath';
import {AttackCapture} from './arenaMarks';

/** Curved crimson enamel with a bronze bevel: the same materials as the board. */
export class ArenaAim3D {
  readonly glow:GlowLayer;
  private shaft:Mesh;private shadow:Mesh;private head:Mesh;private capture:AttackCapture;
  private shaftMaterial:StandardMaterial;private shadowMaterial:StandardMaterial;private headMaterial:StandardMaterial;
  private shaftTexture:DynamicTexture;private headTexture:Texture;
  private visible=false;private targetVisible=false;
  constructor(private scene:Scene,private invalidate:()=>void=()=>{}) {
    this.shaftTexture=new DynamicTexture('bronze crimson cross section',{width:32,height:128},scene,false);
    const c=this.shaftTexture.getContext() as unknown as CanvasRenderingContext2D,g=c.createLinearGradient(0,0,0,128);
    for(const [at,color] of [[0,'#3a1b10'],[.06,'#8b4b21'],[.12,'#e6bb6c'],[.19,'#ffe0a0'],[.24,'#603014'],[.3,'#701b16'],[.52,'#aa3824'],[.7,'#631b16'],[.77,'#30120c'],[.83,'#c08742'],[.9,'#f4c778'],[1,'#44230f']] as const)g.addColorStop(at,color);
    c.fillStyle=g;c.fillRect(0,0,32,128);this.shaftTexture.update();
    this.shaftMaterial=this.ink('crimson enamel lance',this.shaftTexture);
    this.shadowMaterial=new StandardMaterial('aim contact shadow',scene);this.shadowMaterial.disableLighting=true;this.shadowMaterial.emissiveColor=Color3.FromHexString('#2e140a');this.shadowMaterial.alpha=.28;
    const initial=Array.from({length:49},(_,i)=>new Vector3(i*.01,0,-6));
    const make=(name:string)=>MeshBuilder.CreateRibbon(name,{pathArray:[initial.map(p=>p.add(new Vector3(0,.06,0))),initial.map(p=>p.add(new Vector3(0,-.06,0)))],updatable:true,sideOrientation:Mesh.DOUBLESIDE},scene);
    this.shaft=make('carved bronze targeting lance');this.shaft.material=this.shaftMaterial;
    this.shadow=make('targeting lance shadow');this.shadow.material=this.shadowMaterial;
    this.headTexture=new Texture('/ui/arena-lab/native/aim-v2/spearhead.webp',scene,false,true,Texture.TRILINEAR_SAMPLINGMODE,invalidate,invalidate);this.headTexture.hasAlpha=true;
    this.headMaterial=this.ink('painted Roman spearhead',this.headTexture);this.head=MeshBuilder.CreatePlane('Roman spearhead',{size:1},scene);this.head.material=this.headMaterial;
    this.capture=new AttackCapture(scene);
    for(const mesh of this.meshes()){mesh.isPickable=false;mesh.renderingGroupId=3;mesh.setEnabled(false);}
    this.glow=new GlowLayer('warm readiness accents',scene,{mainTextureFixedSize:512,blurKernelSize:12});this.glow.intensity=.18;
    this.glow.addIncludedOnlyMesh(this.shadow);
    // Only registered ready accents may glow. The painted lance retains its dark bevel.
  }
  private ink(name:string,texture:Texture){const m=new StandardMaterial(name,this.scene);m.diffuseTexture=texture;m.emissiveTexture=texture;m.emissiveColor=Color3.White();m.diffuseColor=Color3.Black();m.specularColor=Color3.Black();m.disableLighting=true;m.useAlphaFromDiffuseTexture=true;return m;}
  private meshes(){return [this.shadow,this.shaft,this.head];}
  update(from:Vector3,to:Vector3,valid:boolean,sourceInset:number,targetInset:number,headLength:number){
    const path=aimPath(from,to,sourceInset,targetInset,headLength);if(!path){this.hide();return;}
    this.visible=true;
    const points=Curve3.CreateQuadraticBezier(new Vector3(path.a.x,path.a.y,path.a.z),new Vector3(path.control.x,path.control.y,path.control.z),new Vector3(path.b.x,path.b.y,path.b.z),48).getPoints();
    const end=points[48],direction=end.subtract(points[47]).normalize(),headHeight=Math.min(path.lane*.85,Math.max(.4,path.head));
    const neck=end.subtract(direction.scale(headHeight*.72));
    // The shaft reaches the socket under the head, not through its enamel face.
    const shaftPoints=Curve3.CreateQuadraticBezier(points[0],new Vector3(path.control.x,path.control.y,path.control.z),neck,48).getPoints();
    const edges=[[],[]] as [Vector3[],Vector3[]],shadows=[[],[]] as [Vector3[],Vector3[]];
    shaftPoints.forEach((p,i)=>{const d=shaftPoints[Math.min(48,i+1)].subtract(shaftPoints[Math.max(0,i-1)]),length=Math.max(.001,Math.hypot(d.x,d.y)),width=.135*(1-i/190),side=new Vector3(-d.y/length*width,d.x/length*width,0);edges[0].push(p.add(side));edges[1].push(p.subtract(side));const shade=p.add(new Vector3(.035,-.045,1.4));shadows[0].push(shade.add(side.scale(1.2)));shadows[1].push(shade.subtract(side.scale(1.2)));});
    MeshBuilder.CreateRibbon('carved bronze targeting lance',{pathArray:edges,instance:this.shaft});MeshBuilder.CreateRibbon('targeting lance shadow',{pathArray:shadows,instance:this.shadow});
    this.head.position.copyFrom(end.subtract(direction.scale(headHeight*.5)));this.head.position.z=-8;this.head.rotation.z=Math.atan2(direction.y,direction.x)-Math.PI/2;this.head.scaling.set(headHeight*.62,headHeight,1);
    this.shaftMaterial.alpha=valid?1:.94;
    [this.shaft,this.shadow,this.head].forEach(m=>m.setEnabled(true));this.invalidate();
  }
  lock(position:Vector3|undefined,width=1,height=1,oval=false){
    this.targetVisible=!!position;this.capture.show(position,width,height,oval);
  }
  tick(delta:number,reduced:boolean){if(this.visible)this.capture.tick(delta,reduced);}
  get animating(){return this.visible&&this.targetVisible;}
  hide(){this.visible=false;this.targetVisible=false;this.capture.hide();this.meshes().forEach(p=>p.setEnabled(false));}
  dispose(){this.glow.dispose();this.capture.dispose();this.meshes().forEach(p=>p.dispose());[this.shaftMaterial,this.shadowMaterial,this.headMaterial].forEach(m=>m.dispose());this.shaftTexture.dispose();this.headTexture.dispose();}
}
