import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Material} from '@babylonjs/core/Materials/material';
import {Engine} from '@babylonjs/core/Engines/engine';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import registry from '../../public/ui/arena-lab/fx/manifest.json';
import {VIDEO_IDS,type VideoCue,type VideoId} from './videoCue';

type Source={src:string;maxMs:number;columns:number;rows:number;frameCount:number;fps:number};
type Clip={texture:Texture;material:StandardMaterial;mesh:Mesh;source:Source};
type Live={clip:Clip;elapsed:number};

/** One uploaded atlas per effect: battle playback changes UVs, never uploads video frames. */
export class ArenaSpriteEffects {
  private clips=new Map<VideoId,Clip>();
  private live:Live[]=[];
  private disposed=false;
  private sources=registry.clips as Partial<Record<VideoId,Source>>;
  constructor(private scene:Scene,private invalidate:()=>void){}
  get active(){return this.live.length>0;}
  prepare(cues:VideoCue[]){cues.slice(0,2).forEach(c=>this.load(c.id));}
  private load(id:VideoId){
    const cached=this.clips.get(id);if(cached)return cached;
    const source=this.sources[id];
    if(this.disposed||!VIDEO_IDS.includes(id)||source?.src!==`/ui/arena-lab/fx/${id}.atlas.webp`||!source.columns||!source.rows||!source.frameCount||!source.fps)return;
    if(this.clips.size>=2){const old=Array.from(this.clips.entries()).find(([,c])=>!this.live.some(l=>l.clip===c));if(!old)return;this.release(old[1]);this.clips.delete(old[0]);}
    const texture=new Texture(source.src,this.scene,false,true,Texture.BILINEAR_SAMPLINGMODE,this.invalidate,this.invalidate);
    texture.wrapU=Texture.CLAMP_ADDRESSMODE;texture.wrapV=Texture.CLAMP_ADDRESSMODE;
    texture.uScale=1/source.columns;texture.vScale=1/source.rows;
    const material=new StandardMaterial(`sprite:${id}`,this.scene);
    material.diffuseColor=Color3.Black();material.emissiveColor=Color3.Black();material.emissiveTexture=texture;
    material.disableLighting=true;material.useEmissiveAsIllumination=true;material.specularColor=Color3.Black();
    material.alphaMode=Engine.ALPHA_ADD;material.transparencyMode=Material.MATERIAL_ALPHABLEND;
    const mesh=MeshBuilder.CreatePlane(`sprite:${id}`,{width:1,height:9/16},this.scene);
    mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=2;mesh.setEnabled(false);
    const clip={texture,material,mesh,source};this.clips.set(id,clip);
    // UV offsets animate each frame, so this material must keep binding its matrix.
    void material.forceCompilationAsync(mesh).then(()=>{if(!this.disposed)this.invalidate();}).catch(()=>{});
    return clip;
  }
  trigger(cues:VideoCue[],locate:(uid:string)=>Vector3|undefined,reduced:boolean){
    if(reduced||this.disposed)return;
    for(const cue of cues.slice(0,2)){
      const at=locate(cue.anchor),clip=this.load(cue.id);if(!at||!clip||!clip.texture.isReady())continue;
      this.live=this.live.filter(l=>l.clip!==clip);
      while(this.live.length>=2)this.remove(this.live[0]);
      clip.mesh.position.copyFrom(at);clip.mesh.position.z=-9;clip.mesh.scaling.set(cue.width,cue.width,1);
      clip.mesh.setEnabled(true);clip.material.alpha=.48;
      this.live.push({clip,elapsed:0});this.frame(clip,0);this.invalidate();
    }
  }
  private frame(clip:Clip,frame:number){
    clip.texture.uOffset=(frame%clip.source.columns)/clip.source.columns;
    clip.texture.vOffset=1-(Math.floor(frame/clip.source.columns)+1)/clip.source.rows;
  }
  tick(delta:number){this.live.slice().forEach(l=>{
    l.elapsed+=delta;if(l.elapsed>=l.clip.source.maxMs){this.remove(l);return;}
    this.frame(l.clip,Math.min(l.clip.source.frameCount-1,Math.floor(l.elapsed*l.clip.source.fps/1000)));
  });}
  private remove(l:Live){l.clip.mesh.setEnabled(false);this.live=this.live.filter(other=>other!==l);}
  private release(c:Clip){c.mesh.dispose();c.material.dispose();c.texture.dispose();}
  cancel(){this.live.slice().forEach(l=>this.remove(l));}
  dispose(){this.disposed=true;this.cancel();this.clips.forEach(c=>this.release(c));this.clips.clear();}
}
