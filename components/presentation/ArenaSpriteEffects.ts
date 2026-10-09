import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
import {Effect} from '@babylonjs/core/Materials/effect';
import {Material} from '@babylonjs/core/Materials/material';
import {Engine} from '@babylonjs/core/Engines/engine';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Vector4,type Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';
import registry from '../../public/ui/arena-lab/fx/manifest.json';
import {VIDEO_IDS,type VideoCue,type VideoId} from './videoCue';
import {spritePlacement,type FighterBounds} from './deploymentGeometry';

// Authored clips are RGB already multiplied against black. Combining them
// with luminance opacity a second time made both metal and light disappear.
Effect.ShadersStore.imperivmContactInkVertexShader=`
precision highp float;
attribute vec3 position; attribute vec2 uv;
uniform mat4 worldViewProjection; uniform vec4 atlasTransform;
varying vec2 spriteUV;
void main(){spriteUV=uv*atlasTransform.xy+atlasTransform.zw;gl_Position=worldViewProjection*vec4(position,1.0);}`;
Effect.ShadersStore.imperivmContactInkFragmentShader=`
precision highp float;
varying vec2 spriteUV; uniform sampler2D atlas; uniform float opacity;
void main(){vec3 ink=texture2D(atlas,spriteUV).rgb;
float energy=max(ink.r,max(ink.g,ink.b));
float coverage=smoothstep(0.012,0.10,energy)*min(1.0,energy*3.0);
if(coverage<0.006)discard;
gl_FragColor=vec4(clamp(ink/max(coverage,0.015),0.0,1.0),coverage*opacity);}`;

type Source={src:string;maxMs:number;columns:number;rows:number;frameCount:number;fps:number;composite?:'luma-alpha'|'black-key'};
type Clip={texture:Texture;material:ShaderMaterial;mesh:Mesh;source:Source};
type Live={clip:Clip;elapsed:number;durationMs:number;follow?:()=>Vector3|undefined;offsetY:number};

/** One uploaded atlas per effect: battle playback changes UVs, never uploads video frames. */
export class ArenaSpriteEffects {
  private clips=new Map<VideoId,Clip[]>();
  private live:Live[]=[];
  private disposed=false;
  private sources:Partial<Record<Exclude<VideoId,'06-victory'>,Source>>=registry.clips as Partial<Record<Exclude<VideoId,'06-victory'>,Source>>;
  constructor(private scene:Scene,private invalidate:()=>void){}
  get active(){return this.live.length>0;}
  ready(id:VideoId){return this.load(id)?.some(clip=>clip.texture.isReady())??false;}
  prepare(cues:VideoCue[]){cues.forEach(c=>this.load(c.id));}
  private load(id:VideoId){
    if(id==='06-victory')return;
    const cached=this.clips.get(id);if(cached)return cached;
    const source=this.sources[id];
    if(this.disposed||!VIDEO_IDS.includes(id)||source?.src!==`/ui/arena-lab/fx/${id}.atlas.webp`||!source.columns||!source.rows||!source.frameCount||!source.fps)return;
    // Keep the small combat atlases resident. Re-uploading an evicted atlas
    // and compiling its material at contact causes the first strike to stutter.
    const texture=new Texture(source.src,this.scene,false,true,Texture.BILINEAR_SAMPLINGMODE,this.invalidate,this.invalidate);
    texture.wrapU=Texture.CLAMP_ADDRESSMODE;texture.wrapV=Texture.CLAMP_ADDRESSMODE;
    texture.uScale=1/source.columns;texture.vScale=1/source.rows;
    const make=(ink:Texture,index:number):Clip=>{
    const material=new ShaderMaterial(`sprite:${id}:${index}`,this.scene,{vertex:'imperivmContactInk',fragment:'imperivmContactInk'},{attributes:['position','uv'],uniforms:['worldViewProjection','atlasTransform','opacity'],samplers:['atlas'],needAlphaBlending:true});
    material.setTexture('atlas',ink);material.setFloat('opacity',1);
    material.alphaMode=Engine.ALPHA_COMBINE;material.transparencyMode=Material.MATERIAL_ALPHABLEND;
    const mesh=MeshBuilder.CreatePlane(`sprite:${id}:${index}`,{width:1,height:9/16},this.scene);
    mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=2;mesh.setEnabled(false);
    const clip={texture:ink,material,mesh,source};
    // UV offsets animate each frame, so this material must keep binding its matrix.
    void material.forceCompilationAsync(mesh).then(()=>{if(!this.disposed)this.invalidate();}).catch(()=>{});
    return clip;
    };
    // Two independently timed uses of the same effect share the GPU atlas,
    // but keep separate UV transforms and targets (e.g. two queued spells).
    const pair=[make(texture,0),make(texture.clone(),1)];this.clips.set(id,pair);return pair;
  }
  trigger(cues:VideoCue[],locate:(uid:string)=>Vector3|undefined,reduced:boolean,windowMs?:number,bounds?:(uid:string)=>FighterBounds|undefined){
    if(reduced||this.disposed)return;
    for(const cue of cues.slice(0,2)){
      const at=locate(cue.anchor),pair=this.load(cue.id);if(!at||!pair)continue;
      while(this.live.length>=2)this.remove(this.live[0]);
      const clip=pair.find(c=>!this.live.some(l=>l.clip===c));if(!clip||!clip.texture.isReady())continue;
      const placement=spritePlacement(cue.id,cue.width,bounds?.(cue.anchor));
      clip.mesh.position.copyFrom(at);clip.mesh.position.y+=placement.offsetY;clip.mesh.position.z=placement.depth;
      clip.mesh.scaling.set(placement.width,placement.height/(9/16),1);clip.mesh.renderingGroupId=placement.group;
      clip.mesh.setEnabled(true);clip.material.setFloat('opacity',placement.alpha);
      this.live.push({clip,elapsed:0,durationMs:Math.min(clip.source.maxMs,windowMs??clip.source.maxMs),follow:placement.group<2?()=>locate(cue.anchor):undefined,offsetY:placement.offsetY});this.frame(clip,0);this.invalidate();
    }
  }
  private frame(clip:Clip,frame:number){
    clip.texture.uOffset=(frame%clip.source.columns)/clip.source.columns;
    clip.texture.vOffset=1-(Math.floor(frame/clip.source.columns)+1)/clip.source.rows;
    clip.material.setVector4('atlasTransform',new Vector4(clip.texture.uScale,clip.texture.vScale,clip.texture.uOffset,clip.texture.vOffset));
  }
  tick(delta:number){this.live.slice().forEach(l=>{
    l.elapsed+=delta;if(l.elapsed>=l.durationMs){this.remove(l);return;}
    const at=l.follow?.();if(at){l.clip.mesh.position.x=at.x;l.clip.mesh.position.y=at.y+l.offsetY;}
    const sourceTime=l.elapsed*l.clip.source.maxMs/l.durationMs;
    this.frame(l.clip,Math.min(l.clip.source.frameCount-1,Math.floor(sourceTime*l.clip.source.fps/1000)));
  });}
  private remove(l:Live){l.clip.mesh.setEnabled(false);this.live=this.live.filter(other=>other!==l);}
  private release(c:Clip){c.mesh.dispose();c.material.dispose();c.texture.dispose();}
  cancel(){this.live.slice().forEach(l=>this.remove(l));}
  dispose(){this.disposed=true;this.cancel();this.clips.forEach(pair=>pair.forEach(c=>this.release(c)));this.clips.clear();}
}
