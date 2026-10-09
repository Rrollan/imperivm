'use client';
import {useEffect,useRef,useState} from 'react';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Camera} from '@babylonjs/core/Cameras/camera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {ArenaAim3D} from './ArenaAim3D';
import {ArenaSpriteEffects} from './ArenaSpriteEffects';
import {ArenaDeploymentEffects} from './ArenaDeploymentEffects';
import {deploymentVideo} from './videoCue';
import {ArenaTextures} from './ArenaTextures';
import {CARDS} from '../../lib/cards';
import {useReducedMotion} from '../../lib/prefersReducedMotion';

/** Diagnostic controls use the exact runtime effect; they do not issue game actions. */
export function ArenaAimPreview(){
 const drop=useRef<(id:string)=>void>(()=>{}),[landing,setLanding]=useState('firmware-phalanx'),[slow,setSlow]=useState(false),[freeze,setFreeze]=useState(false),[debug,setDebug]=useState('');
 const canvas=useRef<HTMLCanvasElement>(null),apply=useRef<()=>void>(()=>{}),[locked,setLocked]=useState(true),[oval,setOval]=useState(false),[short,setShort]=useState(false),[still,setStill]=useState(false),[error,setError]=useState(''),reduced=useReducedMotion();
 const state=useRef({locked,oval,short,still:still||reduced,slow,freeze});state.current={locked,oval,short,still:still||reduced,slow,freeze};
 useEffect(()=>{apply.current();},[locked,oval,short,still,reduced]);
 useEffect(()=>{const element=canvas.current;if(!element)return;let disposed=false;let engine:Engine;try{engine=new Engine(element,true,{preserveDrawingBuffer:true,stencil:true});}catch{setError('WebGL недоступен');return;}
  const scene=new Scene(engine);scene.clearColor=new Color4(.12,.07,.04,1);const camera=new FreeCamera('preview camera',new Vector3(0,0,-40),scene);camera.setTarget(Vector3.Zero());camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  const light=new HemisphericLight('preview light',new Vector3(-.3,.5,-1),scene);light.intensity=.65;
  const board=MeshBuilder.CreatePlane('board',{width:32,height:20},scene),material=new StandardMaterial('board paint',scene),painting=new Texture('/ui/arena-lab/native/roman-board-ten-orders.webp',scene);board.position.z=1.7;material.diffuseTexture=painting;material.emissiveTexture=painting;material.emissiveColor=Color3.White();material.disableLighting=true;board.material=material;
  const fx=new ArenaAim3D(scene),sprites=new ArenaSpriteEffects(scene,()=>{}),contacts=new ArenaDeploymentEffects(scene,()=>{}),textures=new ArenaTextures(scene,'ru',()=>{}),id=Object.keys(CARDS).find(id=>CARDS[id].type==='minion')!;
  const source=MeshBuilder.CreatePlane('source fighter',{width:2,height:3.1},scene),target=MeshBuilder.CreatePlane('target fighter',{width:2,height:3.1},scene);
  const face=textures.make('preview card',{kind:'card',cardId:id}),hero=textures.make('preview ruler',{kind:'hero',heroId:'whale',treasury:30,framed:true});
  const cardMaterial=new StandardMaterial('fighter paint',scene);cardMaterial.diffuseTexture=face.texture;cardMaterial.emissiveTexture=face.texture;cardMaterial.emissiveColor=Color3.White();cardMaterial.disableLighting=true;cardMaterial.useAlphaFromDiffuseTexture=true;source.material=cardMaterial;
  const targetMaterial=cardMaterial.clone('target paint')!;target.material=targetMaterial;source.position.set(-3,-3,0);
  const landingIds=['firmware-phalanx','hotspot-hoplite','zeus-liquidator','athena-diamond-guard','hades-rugkeeper'];
  sprites.prepare(landingIds.filter(id=>CARDS[id]).map(id=>({id:deploymentVideo(id),anchor:'source',width:4})));
  let arrival=1000,activeId='firmware-phalanx',debugAt=0;drop.current=id=>{if(!CARDS[id])return;activeId=id;fx.hide();sprites.cancel();face.update({kind:'card',cardId:id});arrival=0;contacts.begin(id,source.position,{width:2,height:3.1,spacing:3.5},state.current.still);sprites.trigger([{id:deploymentVideo(id),anchor:'source',width:4}],()=>source.position,state.current.still,undefined,()=>({width:2,height:3.1,spacing:3.5}));};
  apply.current=()=>{const {locked,oval,short}=state.current;const at=short?new Vector3(.2,-.2,0):new Vector3(3.5,3.4,0);target.position.copyFrom(at);target.scaling.set(oval?1.3:1,oval?2.6/3.1:1,1);targetMaterial.diffuseTexture=oval?hero.texture:face.texture;targetMaterial.emissiveTexture=targetMaterial.diffuseTexture;fx.update(source.position,at,locked,85,oval?88:96,28);fx.lock(locked?at:undefined,oval?2.6:2,oval?2.6:3.1,oval);};
  const resize=()=>{if(disposed)return;engine.resize();const aspect=element.clientWidth/Math.max(1,element.clientHeight),h=10;camera.orthoTop=h;camera.orthoBottom=-h;camera.orthoLeft=-h*aspect;camera.orthoRight=h*aspect;apply.current();};const observer=new ResizeObserver(resize);observer.observe(element);resize();
  let last=performance.now();engine.runRenderLoop(()=>{const now=performance.now();const dt=state.current.freeze&&arrival>=140?0:(now-last)*(state.current.slow?.25:1);fx.tick(dt,state.current.still);sprites.tick(dt);contacts.tick(dt);arrival+=dt;const settle=state.current.still?0:Math.exp(-arrival/90)*Math.sin(arrival/45)*.035;source.scaling.set(1+settle,1-settle,1);last=now;if(now-debugAt>250){debugAt=now;setDebug(`${Math.round(arrival)} мс · Flow ${sprites.ready(deploymentVideo(activeId))?'готов':'загрузка'} · ${sprites.active?'клип активен':'клип завершён'} · ${contacts.active?'контакт активен':'контакт завершён'}`);}scene.render();});
  return()=>{disposed=true;apply.current=()=>{};drop.current=()=>{};observer.disconnect();fx.dispose();sprites.dispose();contacts.dispose();face.dispose();hero.dispose();textures.dispose();scene.dispose();engine.dispose();};
 },[]);
 return <main style={{height:'100dvh',background:'#21150f',color:'#ffedce',display:'flex',flexDirection:'column'}}><div style={{display:'flex',gap:12,padding:12,flexWrap:'wrap',fontSize:14}}><a href="/arena-lab?opening=0">← На арену</a>{[[locked,setLocked,'Захват цели'],[oval,setOval,'Правитель'],[short,setShort,'Короткая дуга'],[still,setStill,'Без движения'],[slow,setSlow,'Замедлить'],[freeze,setFreeze,'Кадр контакта']].map(([value,set,label])=><label key={String(label)} style={{display:'flex',gap:6,alignItems:'center',minHeight:32}}><input type="checkbox" checked={Boolean(value)} onChange={e=>(set as (v:boolean)=>void)(e.target.checked)}/>{String(label)}</label>)}<select aria-label="Карта приземления" value={landing} onChange={e=>setLanding(e.target.value)} style={{background:'#382317',color:'#fce1ae',padding:8,border:'1px solid #926c38'}}>{['firmware-phalanx','hotspot-hoplite','zeus-liquidator','athena-diamond-guard','hades-rugkeeper'].filter(id=>CARDS[id]).map(id=><option key={id} value={id}>{CARDS[id].name}</option>)}</select><button onClick={()=>drop.current(landing)} style={{background:'#701e17',color:'#ffe2ac',padding:'8px 12px',border:'1px solid #be8d4a'}}>Приземление</button><output style={{fontSize:12,color:'#ddbd84'}}>{debug}</output></div>{error?<p role="alert">{error}</p>:<canvas ref={canvas} aria-label="Проверка объёмной стрелки и захвата цели" style={{width:'100%',flex:1,minHeight:0,touchAction:'none'}}/>}</main>;
}
