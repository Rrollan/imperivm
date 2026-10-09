'use client';
import {useEffect,useRef,useState} from 'react';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Camera} from '@babylonjs/core/Cameras/camera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {ArenaAim3D} from './ArenaAim3D';
import {ArenaDeploymentEffects} from './ArenaDeploymentEffects';
import {deploymentDrop,deploymentContact} from './deploymentMotion';
import {targetingEdge,targetingInsets} from './targetingGeometry';
import {readinessInk} from './arenaMarks';
import {ArenaTextures,type Face} from './ArenaTextures';
import {CARDS} from '../../lib/cards';
import {cardName} from '../../lib/locale';
import {useReducedMotion} from '../../lib/prefersReducedMotion';

const landingIds=['firmware-phalanx','hotspot-hoplite','zeus-liquidator','athena-diamond-guard','hades-rugkeeper'];
/** Exact native effect modules, with frame controls; this lab never issues game actions. */
export function ArenaAimPreview(){
 const drop=useRef<(id:string)=>void>(()=>{}),reset=useRef<()=>void>(()=>{}),[landing,setLanding]=useState('firmware-phalanx'),[slow,setSlow]=useState(false),[freeze,setFreeze]=useState(false),[air,setAir]=useState(false),[debug,setDebug]=useState('');
 const canvas=useRef<HTMLCanvasElement>(null),apply=useRef<()=>void>(()=>{}),[locked,setLocked]=useState(true),[oval,setOval]=useState(false),[short,setShort]=useState(false),[still,setStill]=useState(false),[error,setError]=useState(''),reduced=useReducedMotion();
 const state=useRef({locked,oval,short,still:still||reduced,slow,freeze,air});state.current={locked,oval,short,still:still||reduced,slow,freeze,air};
 useEffect(()=>{apply.current();},[locked,oval,short,still,reduced]);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;let disposed=false,engine:Engine;
  try{engine=new Engine(element,true,{preserveDrawingBuffer:true,stencil:true});}catch{setError('WebGL недоступен');return;}
  const scene=new Scene(engine);scene.clearColor=new Color4(.12,.07,.04,1);
  const camera=new FreeCamera('preview camera',new Vector3(0,0,-40),scene);camera.setTarget(Vector3.Zero());camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  const light=new HemisphericLight('preview light',new Vector3(-.3,.5,-1),scene);light.intensity=.7;
  const sun=new DirectionalLight('upper left sun',new Vector3(.3,-.45,1),scene);sun.intensity=.45;sun.diffuse=Color3.FromHexString('#ffe9c8');
  const board=MeshBuilder.CreatePlane('board',{width:32,height:20},scene),material=new StandardMaterial('board paint',scene),painting=new Texture('/ui/arena-lab/native/roman-board-ten-orders.webp',scene);
  board.position.z=1.7;board.isPickable=false;material.diffuseTexture=painting;material.emissiveTexture=painting;material.emissiveColor=Color3.White();material.disableLighting=true;board.material=material;
  const fx=new ArenaAim3D(scene),contacts=new ArenaDeploymentEffects(scene,()=>{}),textures=new ArenaTextures(scene,'ru',()=>{});
  const sourceBase=new Vector3(-2.6,-.7,-.15),sourceRoot=new TransformNode('source card',scene);sourceRoot.position.copyFrom(sourceBase);
  const source=MeshBuilder.CreatePlane('source fighter',{width:2,height:3.5},scene);source.parent=sourceRoot;source.position.z=-.01;
  const target=MeshBuilder.CreatePlane('target fighter',{width:2,height:3.5},scene);
  const fighterFace=(id:string,ready:boolean):Face=>{const c=CARDS[id];return {kind:'minion',ready,readiness:ready?'ready':'fresh',minion:{uid:'preview-source',cardId:id,name:c.name,attack:c.attack??0,health:c.health??1,maxHealth:c.health??1,canAttack:ready,staked:false,taunt:c.taunt,fresh:!ready}};};
  const face=textures.make('source card face',fighterFace('gps-gladiator',true)),targetFace=textures.make('target card face',fighterFace('hotspot-hoplite',false)),hero=textures.make('preview ruler',{kind:'hero',heroId:'whale',treasury:30,framed:true});
  const ink=(name:string,texture:Texture)=>{const m=new StandardMaterial(name,scene);m.diffuseTexture=texture;m.emissiveTexture=texture;m.emissiveColor=Color3.White();m.diffuseColor=Color3.Black();m.disableLighting=true;m.useAlphaFromDiffuseTexture=true;return m;};
  const cardMaterial=ink('fighter paint',face.texture),targetMaterial=ink('enemy paint',targetFace.texture);source.material=cardMaterial;target.material=targetMaterial;
  const bronze=new StandardMaterial('rigid bronze card edge',scene);bronze.diffuseColor=Color3.FromHexString('#87633a');bronze.specularColor=Color3.FromHexString('#d7ad69');
  const backing=MeshBuilder.CreateBox('card thickness',{width:1.9,height:3.25,depth:.13},scene);backing.parent=sourceRoot;backing.position.z=.09;backing.material=bronze;backing.isPickable=false;
  const rimTexture=readinessInk(scene,false),rimMaterial=ink('ready frame light',rimTexture),rim=MeshBuilder.CreatePlane('ready frame',{width:2.15,height:3.6925},scene);rim.parent=sourceRoot;rim.position.z=.12;rim.material=rimMaterial;rim.isPickable=false;rimMaterial.alpha=.85;
  let arrival=0,dropping=false,activeId='gps-gladiator',heavy=false,duration=620,contacted=false,debugAt=0;
  const flightOrigin=new Vector3(-.9,-7,-2.5),bounds={width:2,height:3.5,spacing:3.5};
  drop.current=id=>{if(!CARDS[id])return;activeId=id;heavy=CARDS[id].cost>=6||CARDS[id].rarity==='legendary';duration=heavy?1000:620;arrival=0;dropping=true;contacted=false;fx.hide();contacts.clear();rim.setEnabled(false);face.update({kind:'card',cardId:id});sourceRoot.getChildMeshes().forEach(m=>m.renderingGroupId=2);};
  apply.current=()=>{
    if(dropping)return;
    const {locked,oval,short}=state.current,at=short?new Vector3(-2.6,3.3,0):new Vector3(2.8,5.4,0);
    target.position.copyFrom(at);target.scaling.set(oval?1.3:1,oval?2.6/3.5:1,1);targetMaterial.diffuseTexture=oval?hero.texture:targetFace.texture;targetMaterial.emissiveTexture=targetMaterial.diffuseTexture;
    const dx=at.x-sourceBase.x,dy=at.y-sourceBase.y,sourceEdge=targetingEdge(dx,dy,100*.94,175*.94),targetEdge=targetingEdge(dx,dy,oval?130*.8125:100*.94,oval?130*.8125:175*.94,oval);
    const insets=targetingInsets(Math.hypot(dx,dy)*50,sourceEdge,targetEdge);
    fx.update(sourceBase,at,locked,insets.sourceInset,insets.targetInset,insets.headLength);fx.lock(locked?at:undefined,oval?2.6:2,oval?2.6:3.5,oval);
  };
  reset.current=()=>{dropping=false;contacts.clear();sourceRoot.position.copyFrom(sourceBase);sourceRoot.rotation.setAll(0);sourceRoot.scaling.setAll(1);sourceRoot.getChildMeshes().forEach(m=>m.renderingGroupId=0);rim.setEnabled(true);face.update(fighterFace('gps-gladiator',true));apply.current();};
  const resize=()=>{if(disposed)return;engine.resize();const aspect=element.clientWidth/Math.max(1,element.clientHeight),h=10;camera.orthoTop=h;camera.orthoBottom=-h;camera.orthoLeft=-h*aspect;camera.orthoRight=h*aspect;apply.current();};
  const observer=new ResizeObserver(resize);observer.observe(element);resize();let last=performance.now();
  engine.runRenderLoop(()=>{
    const now=performance.now(),pauseAt=state.current.air?duration*.80:state.current.freeze?duration+90:Infinity;
    let dt=Math.min(50,now-last)*(state.current.slow?.25:1);if(dropping)dt=Math.max(0,Math.min(dt,pauseAt-arrival));last=now;
    fx.tick(dt,state.current.still);contacts.tick(dt);
    if(dropping){
      arrival+=dt;
      if(arrival<duration&&!state.current.still){
        const pose=deploymentDrop(arrival/duration,heavy);sourceRoot.position.copyFrom(Vector3.Lerp(flightOrigin,sourceBase,pose.travel));sourceRoot.position.z-=pose.lift;sourceRoot.scaling.setAll((.62+.38*pose.travel)*pose.scale);sourceRoot.rotation.set(pose.tiltX,pose.tiltY,-.10*(1-pose.travel));
        contacts.flight(sourceRoot.position,{...bounds,width:bounds.width*sourceRoot.scaling.x,height:bounds.height*sourceRoot.scaling.y},sourceBase.z-sourceRoot.position.z);
      }else{
        if(!contacted){contacted=true;face.update(fighterFace(activeId,false));sourceRoot.getChildMeshes().forEach(m=>m.renderingGroupId=0);contacts.begin(activeId,sourceBase,bounds,state.current.still);}
        const pose=deploymentContact(arrival-duration,heavy);sourceRoot.position.copyFrom(sourceBase);sourceRoot.position.z-=state.current.still?0:pose.lift;sourceRoot.scaling.setAll(1);sourceRoot.rotation.set(state.current.still?0:pose.tiltX,0,0);
        if(arrival>duration+700&&!state.current.freeze){dropping=false;contacts.clear();}
      }
    }
    if(now-debugAt>250){debugAt=now;setDebug(dropping?`Движок · ${contacted?'контакт':'полёт'} · ${Math.round(arrival)} мс`:'Движок · готов к проверке');}
    scene.render();
  });
  return()=>{disposed=true;apply.current=()=>{};drop.current=()=>{};reset.current=()=>{};observer.disconnect();fx.dispose();contacts.dispose();face.dispose();targetFace.dispose();hero.dispose();textures.dispose();scene.dispose();engine.dispose();};
 },[]);
 return <main style={{height:'100dvh',background:'#21150f',color:'#ffedce',display:'flex',flexDirection:'column'}}>
  <div style={{display:'flex',gap:12,padding:12,flexWrap:'wrap',fontSize:14}}>
   <a href="/arena-lab?opening=0">← На арену</a>
   {[[locked,setLocked,'Захват цели'],[oval,setOval,'Правитель'],[short,setShort,'Короткая дуга'],[still,setStill,'Без движения'],[slow,setSlow,'Замедлить'],[air,setAir,'Кадр в полёте'],[freeze,setFreeze,'Кадр контакта']].map(([value,set,label])=><label key={String(label)} style={{display:'flex',gap:6,alignItems:'center',minHeight:32}}><input type="checkbox" checked={Boolean(value)} onChange={e=>(set as (v:boolean)=>void)(e.target.checked)}/>{String(label)}</label>)}
   <select aria-label="Карта приземления" value={landing} onChange={e=>setLanding(e.target.value)} style={{background:'#382317',color:'#fce1ae',padding:8,border:'1px solid #926c38'}}>{landingIds.filter(id=>CARDS[id]).map(id=><option key={id} value={id}>{cardName(id,'ru')}</option>)}</select>
   <button onClick={()=>drop.current(landing)} style={{background:'#701e17',color:'#ffe2ac',padding:'8px 12px',border:'1px solid #be8d4a'}}>Приземление</button><button onClick={()=>reset.current()} style={{background:'#382317',color:'#ffe2ac',padding:'8px 12px',border:'1px solid #926c38'}}>Вернуться к наведению</button><output style={{fontSize:12,color:'#ddbd84'}}>{debug}</output>
  </div>
  {error?<p role="alert">{error}</p>:<canvas ref={canvas} aria-label="Проверка стрелки, захвата и физического появления карт" style={{width:'100%',flex:1,minHeight:0,touchAction:'none'}}/>}
 </main>;
}
