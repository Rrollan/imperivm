import { Engine } from '@babylonjs/core/Engines/engine';
import {CARDS} from '../../lib/cards';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import '@babylonjs/core/Culling/ray';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { mempoolOf, legalActions, effectivePowerCost } from '../../lib/engine/engine';
import type { Action, GameState, Minion } from '../../lib/engine/types';
import type { Locale } from '../../lib/locale';
import { ArenaTextures, type Face } from './ArenaTextures';
import { PresentationScheduler } from './PresentationScheduler';
import { ArenaEffects } from './ArenaEffects';
import { ArenaSpriteEffects } from './ArenaSpriteEffects';
import { videoCues, VIDEO_IDS } from './videoCue';
import {isSurfaceLanding} from './deploymentGeometry';
import type { PresentationBatch } from './GameSession';
import {MOTION, smooth, settle, attackTravel,deathProgress,publicPlayPhase,drawPhase} from './motionSpec';
import {battleCommand,fighterReadiness} from './battleReadability';
import {fighterRow} from './battleLayout';
import {ArenaAbilityEffects} from './ArenaAbilityEffects';
import {ArenaDeploymentEffects} from './ArenaDeploymentEffects';
import {pixelRatio, type RenderQuality} from './renderQuality';
import {effectTimeline,effectFrame,deathWindow} from './effectTimeline';
import {queueSlot,queueAnchor,QUEUED_CARD} from './queueLayout';
import {CARD_FACE} from './cardFace';
import {ordersLayout} from './ordersView';
import {rulerSocket,turnSocket,powerSocket,edictRegister} from './boardSockets';
import {targetingEdge,targetingInsets} from './targetingGeometry';
import {validatorPayout} from './validatorInvestment';
import {combatStyle} from './combatStyle';
import {ArenaAttackEffects} from './ArenaAttackEffects';
import {hapticContact} from '../../lib/haptics';
import {arenaViewport} from './arenaViewport';

export type ArenaTarget = { kind: 'hand' | 'minion' | 'hero' | 'power' | 'command' | 'gas' | 'block' | 'deck' | 'scroll' | 'queue'; uid: string; owner: 0 | 1; cardId?: string };
export interface ArenaMetrics { meshes: number; triangles: number; drawCalls: number; renderScale: number; renderWidth: number; renderHeight: number; models: number; failedModels: number; frames: number; frameMedianMs: number; frameP95Ms: number; renderP95Ms: number; gpu: string; pending: string[] }
export interface ArenaOptions {
  locale: Locale;
  reducedMotion: boolean;
  onPick: (target: ArenaTarget) => void;
  onHover: (target: ArenaTarget | null) => void;
  onPlay: (uid: string) => void;
  onAttack: (attackerUid: string, target: string) => void;
  onMetrics: (metrics: ArenaMetrics) => void;
  onFailure: (message: string) => void;
  onReady?: () => void;
  measure?: boolean;
  quality?: RenderQuality;
}

type Entity = {
  root: TransformNode;
  face: Mesh;
  halo: Mesh;
  material: StandardMaterial;
  haloMaterial: StandardMaterial;
  texture: ReturnType<ArenaTextures['make']>;
  data: ArenaTarget;
  base: Vector3;
  signature: string;
  width: number;
  height: number;
  backing: Mesh;
  modelReady: boolean;
  painted: Face;
  hoverLift: number;
  hoverTarget: number;
  fanAngle: number;
  hitArea: Mesh | null;
};

// One artwork coordinate system for the board, every socket, piece and hit target.

export function createArena(canvas: HTMLCanvasElement, options: ArenaOptions) {
  if (!Engine.isSupported()) throw new Error('WebGL is unavailable');
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }, false);
  if (engine.webGLVersion < 2) { engine.dispose(); throw new Error('WebGL 2 is unavailable'); }
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.clearColor = new Color4(.045, .039, .028, 1);
  scene.ambientColor = new Color3(.21, .17, .12);
  const camera = new FreeCamera('fixed-table-camera', new Vector3(0, 0, -40), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.setTarget(Vector3.Zero());
  camera.minZ = .1; camera.maxZ = 70;
  const ambient = new HemisphericLight('sky', new Vector3(0, 0, -1), scene);
  ambient.intensity = .7; ambient.diffuse = Color3.FromHexString('#f3ead8'); ambient.groundColor = Color3.FromHexString('#524737');
  const key = new DirectionalLight('sun-upper-left', new Vector3(.3, -.45, 1), scene);
  key.position.set(-12, 16, -25); key.intensity = .45; key.diffuse = Color3.FromHexString('#ffe9c8');
  const instrument = new SceneInstrumentation(scene);
  let frameSamples:number[]=[],renderSamples:number[]=[];
  let nextMetricAt=0;
  const percentile=(samples:number[],fraction:number)=>samples.length?Math.round([...samples].sort((a,b)=>a-b)[Math.floor((samples.length-1)*fraction)]*10)/10:0;
  const scheduler = new PresentationScheduler();
  let disposed = false, running = false, dirty = 3, last = 0, portrait = false, readyReported=false, paused=false;
  let shown: GameState | null = null, selected: string | null = null;
  let hovered: string | null = null, reportedHover: string | null = null, overlayOpen=false;
  let activeBatch: PresentationBatch | null = null;
  let compact=false,yScale=1;
  const point=(x:number,y:number,z=0)=>new Vector3((x-800)/50,(500-y)*yScale/50,z);
  const row=(count:number,owner:number)=>fighterRow(count,owner,portrait,compact);
  const rowY=(owner:number)=>row(1,owner).y;
  // Measured recess centers in the delivered artwork. Portrait pixels map to
  // x=350+.9*px, y=-130+.9*py; landscape uses its 1600×1000 pixels directly.
  const heroX=(owner=0)=>rulerSocket(owner,portrait).x;
  const heroY=(owner:number)=>compact&&owner===0?610:rulerSocket(owner,portrait).y;
  const queueX=()=>queueSlot(0,portrait).x;
  const queueY=(owner:number)=>queueSlot(owner,portrait).y;
  const handY=()=>portrait?1030:compact?835:865;
  const ordersFace=(state:GameState):Face=>({kind:'orders',gas:state.players[0].gas,max:state.players[0].maxGas,portrait});
  const entities = new Map<string, Entity>();
  let heldArrival: Entity | null = null;
  let drawFlights:{entry:Entity;start:Vector3;target:Vector3;face:Face;delay:number;revealed:boolean;temporary:boolean}[]=[];
  let layoutMoves:{entry:Entity;start:Vector3;target:Vector3;elapsed:number;startScale?:Vector3;startRotation?:number}[]=[];
  const materials = new Map<string, StandardMaterial>();
  const request = () => {
    if (disposed) return;
    dirty = 3;
    if (!running && !document.hidden && !paused) { running = true; last = performance.now(); engine.runRenderLoop(render); }
  };
  const textures = new ArenaTextures(scene, options.locale, request);
  const effects = new ArenaEffects(scene,request);
  const projectiles = new ArenaAttackEffects(scene,request);
  const abilities = new ArenaAbilityEffects(scene,request);
  const deployments=new ArenaDeploymentEffects(scene,request);
  const videoEffects = new ArenaSpriteEffects(scene,request);
  // Warm every small combat atlas during loading, before its first contact.
  if(!options.reducedMotion)videoEffects.prepare(VIDEO_IDS.filter(id=>id!=='06-victory'&&!['33-poseidon-apparition','34-hephaestus-apparition','35-dionysus-apparition'].includes(id)).map(id=>({id,anchor:'arena-center',width:4})));

  function material(name: string, color: string, specular = .2) {
    const known = materials.get(name); if (known) return known;
    const mat = new StandardMaterial(name, scene); mat.diffuseColor = Color3.FromHexString(color); mat.specularColor = new Color3(specular, specular * .86, specular * .6); mat.specularPower = 40;
    materials.set(name, mat); return mat;
  }
  const bronze = material('aged-bronze', '#87633a', .3);
  const marker=(oval:boolean)=>{
    const texture=new DynamicTexture(oval?'laurel target':'ready corners',512,scene,false);texture.hasAlpha=true;
    const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0,0,512,512);ctx.strokeStyle='#ffffff';ctx.fillStyle='#ffffff';ctx.lineWidth=5;ctx.lineCap='round';
    if(oval){
      for(let i=0;i<4;i++){ctx.save();ctx.translate(256,256);ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.moveTo(-19,-230);ctx.lineTo(0,-248);ctx.lineTo(19,-230);ctx.stroke();ctx.beginPath();ctx.arc(0,0,226,-Math.PI/2+.16,-Math.PI/2+.48);ctx.stroke();ctx.restore();}
    }else{
      for(const [x,y,sx,sy] of [[19,19,1,1],[493,19,-1,1],[19,493,1,-1],[493,493,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*66);ctx.lineTo(x,y);ctx.lineTo(x+sx*66,y);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(232,9);ctx.lineTo(256,28);ctx.lineTo(280,9);ctx.stroke();
    }
    texture.update();return texture;
  };
  const ovalMarker=marker(true),cardMarker=marker(false);
  const board = MeshBuilder.CreatePlane('painted Roman arena', { width: 32, height: 20 }, scene);
  board.position.z = 1.7; board.isPickable = false;
  const boardMaterial = material('painted arena surface', '#ffffff', 0);
  const painting = new Texture('/ui/arena-lab/native/roman-board-ten-orders.webp', scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, request, request);
  painting.wrapU = Texture.CLAMP_ADDRESSMODE; painting.wrapV = Texture.CLAMP_ADDRESSMODE;
  boardMaterial.diffuseTexture = painting; boardMaterial.emissiveTexture = painting; boardMaterial.emissiveColor = new Color3(.32,.32,.32); board.material = boardMaterial;
  let portraitPainting:Texture|undefined;
  // The clocks and deck are painted into the same board, light and perspective.
  // Only these invisible hit surfaces and state overlays remain dynamic.
  function inset(name:string,w:number,h:number,target:ArenaTarget){
    const root=new TransformNode(name,scene);
    const hit=MeshBuilder.CreatePlane(`${name}:hit`,{width:w/50,height:h/50},scene);
    hit.parent=root;hit.visibility=0;hit.isPickable=true;hit.metadata=target;return root;
  }
  const hourglass=inset('embedded hourglass',75,110,{kind:'command',uid:'turn-command',owner:0});
  const clock=inset('embedded water clock',85,120,{kind:'block',uid:'block-counter',owner:0});
  const deckStack=inset('embedded deck',110,150,{kind:'deck',uid:'own-deck',owner:0});
  const sandMaterial=material('falling ivory sand','#eed6a4',0);
  const sandStream=MeshBuilder.CreateCylinder('falling sand',{diameter:.026,height:.35,tessellation:6},scene);
  sandStream.parent=hourglass;sandStream.material=sandMaterial;sandStream.isPickable=false;sandStream.position.set(0,-.13,-.6);sandStream.setEnabled(false);
  const gasRack=new TransformNode('orders anchor',scene);
  function gasFill(state:GameState){
    const layout=ordersLayout(portrait);
    gasRack.position.copyFrom(point(layout.anchorX,layout.anchorY));
    const counter=entities.get('gas-counter');
    if(counter)paint(counter,ordersFace(state));
  }

  function paint(entry: Entity, face: Face) {
    entry.painted = face;
    const rendered = ['hero','power','deck'].includes(face.kind) ? { ...face, model: entry.modelReady } as Face : face;
    const signature = JSON.stringify(rendered);
    if (entry.signature !== signature) { entry.texture.update(rendered); entry.signature = signature; }
  }

  function entity(keyId: string, data: ArenaTarget, face: Face, width: number, height: number): Entity {
    const known = entities.get(keyId);
    if (known) {
      if(known.width!==width||known.height!==height){
        // Keep the same visible card and texture when the formation gets denser.
        // Resize its geometry; keep() compensates with a settling root scale.
        const x=width/known.width,y=height/known.height;
        for(const mesh of [known.face,known.backing]){mesh.scaling.x*=x;mesh.scaling.y*=y;}
        known.halo.scaling.x*=x;
        known.halo.scaling.y*=y;
        known.width=width;known.height=height;
      }
      return known;
    }
    const root = new TransformNode(keyId, scene); root.rotation.x = 0;
    const oval = face.kind === 'hero' || face.kind === 'power';
    const backing = oval
      ? MeshBuilder.CreateSphere(`${keyId}-thickness`, { diameter: 1, segments: 12 }, scene)
      : MeshBuilder.CreateBox(`${keyId}-thickness`, { width: width * .95, height: height * .93, depth: .13 }, scene);
    if (oval) backing.scaling.set(width * .85, height * .85, .17);
    backing.parent = root; backing.position.z = .09; backing.material = bronze; backing.isPickable = false;
    if (['hero','power','command','gas','orders','block','deck','scroll','queueTitle'].includes(face.kind)) backing.setEnabled(false);
    const faceMesh = MeshBuilder.CreatePlane(`${keyId}-face`, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    const texture = textures.make(`${keyId}-ink`, face);
    const mat = new StandardMaterial(`${keyId}-material`, scene); mat.diffuseTexture = texture.texture; mat.emissiveTexture = texture.texture; mat.emissiveColor = Color3.White(); mat.diffuseColor = Color3.Black(); mat.disableLighting = true; mat.specularColor = Color3.Black(); mat.useAlphaFromDiffuseTexture = true;
    faceMesh.parent = root; faceMesh.position.z = -.01; faceMesh.material = mat; faceMesh.metadata = data;
    const halo = MeshBuilder.CreatePlane(`${keyId}-engraved-marker`,{width:width*1.08,height:height*1.06},scene);
    const haloMat = new StandardMaterial(`${keyId}-halo-material`, scene); haloMat.diffuseColor = Color3.Black(); haloMat.emissiveColor = Color3.FromHexString('#427650'); haloMat.alpha = oval ? .9 : .22; haloMat.disableLighting = true;
    haloMat.diffuseTexture=oval?ovalMarker:cardMarker;haloMat.emissiveTexture=haloMat.diffuseTexture;haloMat.useAlphaFromDiffuseTexture=true;
    halo.parent = root; halo.position.z = -.03; halo.material = haloMat; halo.isPickable = false; halo.setEnabled(false);
    const hitArea=['command','power','gas','block','deck','scroll'].includes(data.kind)
      ? MeshBuilder.CreatePlane(`${keyId}-touch-target`,{size:1,sideOrientation:Mesh.DOUBLESIDE},scene) : null;
    if(hitArea){hitArea.parent=root;hitArea.position.z=-.02;hitArea.visibility=0;hitArea.metadata=data;}
    const entry: Entity = { root, face: faceMesh, halo, material: mat, haloMaterial: haloMat, texture, data, base: Vector3.Zero(), signature: '', width, height, backing, modelReady: false, painted: face,hoverLift:0,hoverTarget:0,fanAngle:0,hitArea };
    entities.set(keyId, entry); return entry;
  }

  function destroy(entry: Entity) { entry.root.dispose(false, false); entry.texture.dispose(); entry.material.dispose(); entry.haloMaterial.dispose(); }

  function highlights() {
    const legal = shown ? (shown as GameState & {presentationActions?:Action[]}).presentationActions??legalActions(shown) : [];
    const targets = legal.filter(a => a.type === 'attack' && a.attackerUid === selected).map(a => a.type === 'attack' ? a.target : '');
    entities.forEach(entry => {
      const ready = shown?.turn === 0 && legal.some(a => a.type === 'attack' && a.attackerUid === entry.data.uid);
      const powerReady = entry.data.kind === 'power' && shown?.turn === 0 && legal.some(a=>a.type==='hero-power');
      const target = entry.data.owner === 1 && targets.includes(entry.data.kind === 'hero' ? 'hero' : entry.data.uid);
      const active = selected === entry.data.uid;
      entry.halo.setEnabled(!activeBatch && (ready || powerReady || target || active));
      const color = target ? '#f5d593' : active ? '#fff0bc' : '#7adccc';
      entry.haloMaterial.emissiveColor = Color3.FromHexString(color);
      entry.haloMaterial.alpha = target || active ? 1 : .85;
      entry.hoverTarget=!overlayOpen&&!activeBatch&&entry.data.kind==='hand'&&entry.data.owner===0&&hovered===entry.data.uid?1:0;
    });
    updateAim();
    request();
  }

  function sync(state: GameState) {
    const changed=shown!==null&&shown!==state;
    shown = state;
    // Online rendering uses the server's allowed moves; it never infers hidden reserve cards.
    const stateActions=(state as GameState & {presentationActions?: Action[]}).presentationActions ?? legalActions(state);
    const readyAttackers=new Set(!activeBatch&&state.turn===0?stateActions.flatMap(action=>action.type==='attack'?[action.attackerUid]:[]):[]);
    const playableCards=new Set(!activeBatch&&state.turn===0?stateActions.flatMap(action=>action.type==='play-minion'||action.type==='cast-spell'?[action.uid]:[]):[]);
    const used = new Set<string>();
    const keep = (id: string, data: ArenaTarget, face: Face, w: number, h: number, x: number, y: number, z = 0) => {
      used.add(id);const old=entities.get(id),previous=old?.root.position.clone(),previousScale=old?.root.scaling.clone(),oldWidth=old?.width,oldHeight=old?.height; const entry = entity(id,data,face,w/50,h/50);
      entry.data=data;entry.face.metadata=data;entry.root.setEnabled(true);
      if(entry.hitArea){
        const minimum=44*(camera.orthoTop!-camera.orthoBottom!)/Math.max(1,canvas.clientHeight);
        entry.hitArea.scaling.set(Math.max(entry.width,minimum),Math.max(entry.height,minimum),1);
        entry.hitArea.metadata=data;
      }
      paint(entry,face);
      entry.base.copyFrom(point(x,y,z)); entry.root.position.copyFrom(entry.base); entry.root.scaling.setAll(1);
      const resized=oldWidth!==undefined&&(oldWidth!==entry.width||oldHeight!==entry.height);
      if(changed&&previous&&old===entry&&(data.kind==='minion'||data.kind==='hand'&&data.owner===0)&&(resized||Vector3.DistanceSquared(previous,entry.base)>.001)&&!options.reducedMotion){
        const startScale=resized?new Vector3((oldWidth!/entry.width)*(previousScale?.x??1),(oldHeight!/entry.height)*(previousScale?.y??1),1):undefined;
        layoutMoves=layoutMoves.filter(m=>m.entry!==entry);layoutMoves.push({entry,start:previous,target:entry.base.clone(),elapsed:0,startScale});entry.root.position.copyFrom(previous);if(startScale)entry.root.scaling.copyFrom(startScale);
      }
      entry.fanAngle=data.kind === 'hand' && data.owner === 0 ? -(x-800)*.00015 : 0;
      entry.root.rotation.z = entry.fanAngle;
      return entry;
    };
    state.players.forEach((player,index)=>{
      const owner = index as 0|1;
      const socket=rulerSocket(owner,portrait);
      const heroScale=compact?(owner===0?.72:.82):1;
      keep(`hero-${owner}`,{kind:'hero',uid:`hero-${owner}`,owner},{kind:'hero',heroId:player.heroId,treasury:player.treasury,aspect:socket.width/socket.height,framed:compact},socket.width*384/312*heroScale,socket.height*384/312*heroScale,heroX(owner),heroY(owner),-1.6);
      const formation=row(player.board.length,owner);
      player.board.forEach((m,i)=>keep(m.uid,{kind:'minion',uid:m.uid,owner,cardId:m.cardId},{kind:'minion',minion:m,ready:readyAttackers.has(m.uid),readiness:fighterReadiness(state,owner,m,stateActions),compact},formation.width,formation.height,formation.center+(i-(player.board.length-1)/2)*formation.spacing,formation.y,-.15));
    });
    const hand = state.players[0].hand;
    const spacing = Math.min(portrait?116:130,(portrait?670:900)/Math.max(1,hand.length-1));
    hand.forEach((c,i)=>{const x=800+(i-(hand.length-1)/2)*spacing,h=compact?240:portrait?196:234;keep(c.uid,{kind:'hand',uid:c.uid,owner:0,cardId:c.cardId},{kind:'card',cardId:c.cardId,playable:playableCards.has(c.uid)},h*CARD_FACE.ratio,h,x,handY()+Math.abs(x-800)*.024,-1-i*.015);});
    const backs = Math.min(8,state.players[1].hand.length);
    for(let i=0;i<backs;i++){const e=keep(`back-${i}`,{kind:'hand',uid:`back-${i}`,owner:1},{kind:'back'},50,70,800+(i-(backs-1)/2)*40,portrait?-93:35,.5);e.face.isPickable=false;}
    for(const owner of [0,1] as const){
      const spells=mempoolOf(state,owner);
      spells.slice(0,3).forEach((spell,i)=>{
        const id=`queued-${spell.uid}`;
        const e=keep(id,{kind:'queue',uid:id,owner,cardId:spell.cardId},{kind:'queued',cardId:spell.cardId,owner,count:spells.length,ordinal:i+1},QUEUED_CARD.width,QUEUED_CARD.height,queueX()+i*7,queueY(owner)-i*7,-1+i*.03);
        e.face.metadata=e.data;e.face.alphaIndex=3-i;
      });
    }
    const native = (id:string,kind:ArenaTarget['kind'],face:Face,w:number,h:number,x:number,y:number)=>keep(id,{kind,uid:id,owner:0},face,w,compact&&face.kind!=='power'?h*yScale:h,x,y,-.5);
    const me=state.players[0];
    const turn=turnSocket(portrait);
    native('turn-command','command',{kind:'command',state:activeBatch?'busy':battleCommand(state,stateActions),engraved:true,portrait,compact},turn.width,turn.height,turn.x,turn.y);
    const power=powerSocket(portrait);
    native('hero-power','power',{kind:'power',heroId:me.heroId,cost:effectivePowerCost(state,0),available:state.turn===0&&stateActions.some(a=>a.type==='hero-power'),aspect:power.width/power.height},power.width*384/322,power.height*384/322,power.x,compact?610:power.y);
    const orders=ordersLayout(portrait);
    native('gas-counter','gas',ordersFace(state),orders.width,orders.height,orders.x,orders.y);
    native('block-counter','block',{kind:'block',block:state.block},60,78,portrait?446:234,portrait?70:220);
    const deck=native('own-deck','deck',{kind:'deck',count:me.deck.length,reinforcement:!activeBatch&&state.turn===0&&stateActions.some(a=>a.type==='buy-card')},80,112,portrait?1163:1390,portrait?202:238);deck.modelReady=true;paint(deck,deck.painted);
    const register=edictRegister(portrait);
    native('battle-scroll','scroll',{kind:'queueTitle',own:mempoolOf(state,0).length,enemy:mempoolOf(state,1).length},register.width,register.height,register.x,register.y);
    hourglass.position.copyFrom(point(portrait?1178:1442,portrait?514:352,-.5));
    clock.position.copyFrom(point(portrait?446:234,portrait?57:218,-.5));
    deckStack.position.copyFrom(point(portrait?1163:1390,portrait?99:175,-.5));
    gasFill(state);
    entities.forEach((entry,id)=>{if(!used.has(id)){destroy(entry);entities.delete(id);}});highlights();
  }

  type Press = { entity: Entity; startX: number; startY: number; dragged: boolean; start: Vector3 };
  let press: Press | null = null;
  let released: { uid: string; position: Vector3; scaling: Vector3; rotation: number } | null = null;
  const ground = Plane.FromPositionAndNormal(new Vector3(0,0,-1), new Vector3(0,0,-1));
  function positionOnTable() {
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera);
    const distance = ray.intersectsPlane(ground);
    return distance === null ? null : ray.origin.add(ray.direction.scale(distance));
  }
  function hitTarget(exclude?: string) {
    const picked = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh.isPickable && Boolean(mesh.metadata) && mesh.metadata.uid !== exclude);
    return picked?.hit ? picked.pickedMesh?.metadata as ArenaTarget : null;
  }
  function updateAim() {
    if(!selected||activeBatch){effects.hideAim();return;}
    const source=entities.get(selected);if(!source){effects.hideAim();return;}
    const target=hitTarget(press?.entity.data.uid);
    const valid=target?.owner===1&&!!shown&&legalActions(shown).some(a=>a.type==='attack'&&a.attackerUid===selected&&a.target===(target.kind==='hero'?'hero':target.uid));
    const to=valid&&target?entities.get(target.uid)?.base:positionOnTable();
    if(to){
      const dx=to.x-source.base.x,dy=to.y-source.base.y,destination=valid&&target?entities.get(target.uid):undefined;
      const sourceEdge=targetingEdge(dx,dy,source.width*50*.94,source.height*50*.94);
      const targetEdge=destination?targetingEdge(dx,dy,destination.width*50*(destination.data.kind==='hero'?.8125:.94),destination.height*50*(destination.data.kind==='hero'?.8125:.94),destination.data.kind==='hero'):0;
      const insets=targetingInsets(Math.hypot(dx,dy)*50,sourceEdge,targetEdge);
      effects.aim(source.base,to,valid,insets.sourceInset,insets.targetInset,insets.headLength);
    }else effects.hideAim();
    canvas.style.cursor=valid?'crosshair':'pointer';
  }
  function clearPress(animateReturn=false) {
    if (press) {
      const entry=press.entity;
      if(animateReturn&&press.dragged&&!options.reducedMotion){
        layoutMoves=layoutMoves.filter(move=>move.entry!==entry);
        layoutMoves.push({entry,start:entry.root.position.clone(),target:entry.base.clone(),elapsed:0,startScale:entry.root.scaling.clone(),startRotation:entry.root.rotation.z});
        entry.hoverLift=0;entry.hoverTarget=0;
        hovered=null;reportedHover=null;
      }else {entry.root.position.copyFrom(entry.base);entry.root.scaling.setAll(1);}
    }
    press = null; highlights();
  }
  scene.onPointerObservable.add(info => {
    if (activeBatch || !shown) return;
    // Babylon listens for release on the window. A DOM inspector/menu button
    // must never also activate the board beneath its last canvas coordinates.
    if (info.event.target !== canvas && !press) return;
    if (info.type === PointerEventTypes.POINTERDOWN) {
      const target = hitTarget(); if (!target || target.owner !== 0) return;
      const entry = entities.get(target.uid); if (!entry) return;
      press = { entity: entry, startX: scene.pointerX, startY: scene.pointerY, dragged: false, start: entry.root.position.clone() };
      const pointerId = (info.event as PointerEvent).pointerId;
      if (typeof pointerId === 'number') canvas.setPointerCapture(pointerId);
    } else if (info.type === PointerEventTypes.POINTERMOVE) {
      if (press) {
        const legal = legalActions(shown);
        const canDrag = shown.turn === 0 && legal.some(a => ((a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === press?.entity.data.uid) || (a.type === 'attack' && a.attackerUid === press?.entity.data.uid));
        if (canDrag && Math.hypot(scene.pointerX - press.startX, scene.pointerY - press.startY) > 9) {
          press.dragged = true;
          const at = positionOnTable(); if (at) { press.entity.root.position.set(at.x, at.y, -2.5); press.entity.root.scaling.setAll(1.1); }
          selected = press.entity.data.kind === 'minion' ? press.entity.data.uid : null;
          highlights();
        }
      } else {
        const target = hitTarget(); hovered = target?.uid ?? null;
        if (reportedHover !== hovered) { reportedHover = hovered; options.onHover(target); highlights(); }
        canvas.style.cursor = target ? 'pointer' : 'default';
      }
      if(selected)updateAim();
    } else if (info.type === PointerEventTypes.POINTERUP) {
      const current = press, target = hitTarget(current?.dragged ? current.entity.data.uid : undefined), at = positionOnTable();
      if (current?.dragged) {
        const data = current.entity.data;
        // Save the actual release pose before highlights restore the hand layout.
        released = { uid:data.uid, position:current.entity.root.position.clone(), scaling:current.entity.root.scaling.clone(), rotation:current.entity.root.rotation.z };
        clearPress(true);
        if (data.kind === 'hand' && at && Math.abs(at.x) < 11.5 && at.y > -3 && at.y < 5) options.onPlay(data.uid);
        if (data.kind === 'minion' && target?.owner === 1 && (target.kind === 'minion' || target.kind === 'hero')) options.onAttack(data.uid, target.kind === 'hero' ? 'hero' : target.uid);
        released = null;
      } else {
        clearPress();
        if (target) options.onPick(target);
      }
      const event = info.event as PointerEvent;
      if (typeof event.pointerId === 'number' && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
  });
  const cancelPointer = () => { clearPress(true); options.onHover(null); };
  const leavePointer = () => { if (!press) { hovered = null; reportedHover = null; options.onHover(null); highlights(); } };
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('pointerleave', leavePointer);

  function resize() {
    engine.setHardwareScalingLevel(1/pixelRatio(canvas.clientWidth,canvas.clientHeight,window.devicePixelRatio,options.quality??'auto'));
    engine.resize(); const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
    const viewport=arenaViewport(canvas.clientWidth,canvas.clientHeight);
    const changedLayout=portrait!==viewport.portrait||compact!==viewport.compact||Math.abs(yScale-viewport.yScale)>.001;
    // A phone rotation changes the projection of every contact. Settle the
    // already-authoritative result instead of continuing a flight in old coordinates.
    const settled=changedLayout?activeBatch?.after:undefined;
    portrait=viewport.portrait;compact=viewport.compact;yScale=viewport.yScale;
    canvas.parentElement?.setAttribute('data-compact-arena',String(compact));
    if(portrait&&!portraitPainting){portraitPainting=new Texture('/ui/arena-lab/roman-board-integrated-portrait.webp',scene,false,true,Texture.TRILINEAR_SAMPLINGMODE,request,request);portraitPainting.wrapU=Texture.CLAMP_ADDRESSMODE;portraitPainting.wrapV=Texture.CLAMP_ADDRESSMODE;}
    board.scaling.set(portrait?18/32:1,portrait?25.2/20:yScale,1);
    boardMaterial.diffuseTexture=portrait?portraitPainting!:painting;boardMaterial.emissiveTexture=boardMaterial.diffuseTexture;
    const height=viewport.halfHeight;
    camera.orthoTop=height;camera.orthoBottom=-height;camera.orthoLeft=-height*aspect;camera.orthoRight=height*aspect;
    const menu=point(portrait?1175:1515,portrait?1070:915);
    canvas.parentElement?.style.setProperty('--arena-menu-x',`${(menu.x/(height*aspect)+1)*canvas.clientWidth/2}px`);
    canvas.parentElement?.style.setProperty('--arena-menu-y',`${(1-menu.y/height)*canvas.clientHeight/2}px`);
    if(settled){cancel();sync(settled);}else if(shown&&!activeBatch)sync(shown);request();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const visibility = () => {
    if (document.hidden) { engine.stopRenderLoop(render); running = false; }
    else request();
  };
  document.addEventListener('visibilitychange', visibility);
  function reportMetrics(){
    const meshes=scene.meshes.filter(mesh=>mesh.isEnabled());
    options.onMetrics({meshes:meshes.length,triangles:meshes.reduce((n,mesh)=>n+mesh.getTotalIndices()/3,0),drawCalls:instrument.drawCallsCounter.current,renderScale:engine.getHardwareScalingLevel(),renderWidth:engine.getRenderWidth(),renderHeight:engine.getRenderHeight(),models:0,failedModels:0,frames:frameSamples.length,frameMedianMs:percentile(frameSamples,.5),frameP95Ms:percentile(frameSamples,.95),renderP95Ms:percentile(renderSamples,.95),gpu:engine.getGlInfo().renderer,pending:meshes.filter(mesh=>mesh.isVisible&&mesh.visibility>0&&!mesh.isReady(true)).slice(0,6).map(mesh=>mesh.name)});
  }
  function render() {
    if (disposed || document.hidden || paused) return;
    if(!readyReported){
      const visibleReady=scene.meshes.every(mesh=>!mesh.isEnabled()||!mesh.isVisible||mesh.visibility<=0||mesh.isReady(true));
      if(shown&&textures.isReady()&&painting.isReady()&&(!portrait||portraitPainting?.isReady())&&visibleReady){
        readyReported=true;options.onReady?.();
      }
    }
    const time = performance.now(), rawDelta=Math.max(0,time-last), delta=rawDelta; last = time;
    scheduler.tick(delta);
    videoEffects.tick(delta);
    deployments.tick(delta);
    layoutMoves=layoutMoves.filter(move=>{
      if(move.entry.root.isDisposed()||move.entry.root===press?.entity.root)return false;
      move.elapsed+=delta;
      const progress=smooth(move.elapsed/160);
      move.entry.root.position.copyFrom(Vector3.Lerp(move.start,move.target,progress));
      if(move.startScale){move.entry.root.scaling.copyFrom(Vector3.Lerp(move.startScale,Vector3.One(),progress));move.entry.root.rotation.z=(move.startRotation??0)*(1-progress)+move.entry.fanAngle*progress;}
      return move.elapsed<160;
    });
    let settling=layoutMoves.length>0;
    if(!activeBatch)entities.forEach(entry=>{
      if(entry.data.kind!=='hand'||entry.data.owner!==0||entry.root===press?.entity.root)return;
      if(layoutMoves.some(move=>move.entry===entry&&move.startScale))return;
      entry.hoverLift=options.reducedMotion?entry.hoverTarget:settle(entry.hoverLift,entry.hoverTarget,delta,MOTION.hoverMs);
      const lift=entry.hoverLift;
      if(!layoutMoves.some(m=>m.entry===entry))entry.root.position.copyFrom(entry.base);
      const hoverLimit=portrait?5.7:12;
      entry.root.position.x+=(Math.max(-hoverLimit,Math.min(hoverLimit,entry.base.x))-entry.base.x)*lift;
      entry.root.position.y+=3.5*lift;entry.root.position.z-=6*lift;
      entry.root.scaling.setAll(1+1.1*lift);entry.root.rotation.z=entry.fanAngle*(1-lift);
      entry.root.getChildMeshes().forEach(mesh=>mesh.renderingGroupId=lift>.02?2:0);
      settling ||= entry.hoverLift!==entry.hoverTarget;
    });
    effects.flush();
    scene.render();
    if(options.measure){frameSamples.push(rawDelta);renderSamples.push(performance.now()-time);if(frameSamples.length>300){frameSamples.shift();renderSamples.shift();}}
    if(options.measure&&time>=nextMetricAt){nextMetricAt=time+1000;reportMetrics();}
    // Parallel shader compilation may outlive the first few requested frames.
    // Keep the clock alive until the newly introduced materials can draw.
    // Disabled arrows/cached effects cannot keep an otherwise idle board rendering forever.
    if (scene.meshes.some(mesh=>mesh.isEnabled()&&mesh.isVisible&&mesh.visibility>0&&!mesh.isReady(true))) { dirty = 3; return; }
    if (!scheduler.active && !videoEffects.active && !deployments.active && !settling && --dirty <= 0) {
      engine.stopRenderLoop(render); running = false;
      reportMetrics();
    }
  }
  engine.onContextLostObservable.add(() => options.onFailure('context-lost'));
  engine.onContextRestoredObservable.add(() => { options.onFailure(''); request(); });
  resize();

  function releaseArrival(){if(heldArrival){destroy(heldArrival);heldArrival=null;}}
  function releaseDraws(){drawFlights.forEach(f=>{if(f.temporary){entities.delete(f.entry.data.uid);destroy(f.entry);}else if(!f.entry.root.isDisposed()){f.entry.root.rotation.y=0;paint(f.entry,f.face);}});drawFlights=[];}
  function resetClock(){sandStream.setEnabled(false);}
  function cancel() { scheduler.cancel(); releaseArrival(); releaseDraws();layoutMoves=[];effects.clear();projectiles.clear();abilities.clear();deployments.clear(); videoEffects.cancel(); activeBatch = null; released=null; entities.forEach(entry=>{entry.material.alpha=1;entry.backing.visibility=1;entry.hoverLift=0;entry.root.rotation.x=0;entry.root.rotation.y=0;}); resetClock(); clearPress(); if (shown) sync(shown); }

  async function present(batch: PresentationBatch, impact: () => void) {
    scheduler.cancel(); releaseArrival();releaseDraws();layoutMoves=[]; activeBatch = batch; options.onHover(null); hovered = null; selected = null; highlights();
    const command = entities.get('turn-command'); if (command) paint(command, { kind: 'command', state: 'busy', engraved: true, portrait,compact });
    const attack = batch.action.type === 'attack' ? batch.action : null;
    const attacker = attack ? entities.get(attack.attackerUid) : null;
    const combat = combatStyle(attacker?.data.cardId);
    const defender = attack ? entities.get(attack.target === 'hero' ? `hero-${batch.before.turn === 0 ? 1 : 0}` : attack.target) : null;
    const handUid = batch.action.type === 'play-minion' || batch.action.type === 'cast-spell' ? batch.action.uid : null;
    const rejected=batch.action.type==='mulligan'?batch.action.uids.flatMap(uid=>{
      const index=batch.before.players[batch.before.turn].hand.findIndex(card=>card.uid===uid);
      const entry=entities.get(batch.before.turn===0?uid:`back-${index}`);
      if(!entry)return [];
      entry.root.getChildMeshes().forEach(mesh=>mesh.renderingGroupId=2);
      return [{entry,start:entry.root.position.clone(),scale:entry.root.scaling.clone(),rotation:entry.root.rotation.z,flipped:false}];
    }):[];
    let moving = attacker ?? (handUid ? entities.get(handUid) : null);
    if(handUid&&!moving){
      const card=batch.before.players[batch.before.turn].hand.find(c=>c.uid===handUid);
      if(card){moving=entity(handUid,{kind:'hand',uid:handUid,owner:batch.before.turn,cardId:card.cardId},{kind:'card',cardId:card.cardId},234*CARD_FACE.ratio/50,234/50);moving.base.copyFrom(point(800,portrait?-93:35,-2));moving.root.position.copyFrom(moving.base);entities.get(`back-${Math.min(7,batch.before.players[1].hand.length-1)}`)?.root.setEnabled(false);}
    }
    if(handUid&&moving)moving.root.getChildMeshes().forEach(mesh=>mesh.renderingGroupId=2);
    const release = released?.uid === moving?.data.uid ? released : null;
    const start = release?.position.clone() ?? moving?.root.position.clone();
    const startScale = release?.scaling.clone() ?? moving?.root.scaling.clone() ?? Vector3.One();
    const startRotation = release?.rotation ?? moving?.root.rotation.z ?? 0;
    const defenderStart = defender?.root.position.clone();
    const owner = batch.before.turn;
    const added = batch.after.players[owner].board.find(m => !batch.before.players[owner].board.some(old=>old.uid===m.uid));
    const boardSize = batch.after.players[owner].board.length;
    const boardRow=row(boardSize,owner);
    const addedIndex = added ? batch.after.players[owner].board.findIndex(m=>m.uid===added.uid) : 0;
    const pending = mempoolOf(batch.after, owner), pendingIndex = Math.min(5,pending.length-1);
    const immediate=batch.events?.spellImmediate;
    const directTargets=immediate?batch.events?.effectResults?.find(r=>r.mempoolUid===immediate.fromHandUid)?.targets??[]:[];
    const affected=directTargets.flatMap(t=>{const entry=entities.get(t.uid);return entry?[entry.root.position]:[];});
    const spell=immediate?CARDS[immediate.cardId].spell:undefined;
    const effectOwner=spell?.kind==='damage-all-enemy-minions'||spell?.kind==='weaken-random-enemy'?1-owner:owner;
    const spellRow=row(1,effectOwner);
    const instantTarget=affected.length?affected.reduce((sum,p)=>sum.add(p),Vector3.Zero()).scale(1/affected.length):point(spellRow.center,spellRow.y,-1);
    const target = defender?.root.position.clone() ?? (immediate?instantTarget:batch.action.type === 'cast-spell'
      ? point(queueX()+Math.min(2,pendingIndex)*7,queueY(owner)-Math.min(2,pendingIndex)*7,-1)
      : point(boardRow.center+(addedIndex-(boardSize-1)/2)*boardRow.spacing,boardRow.y,-.15));
    const queuedCast=batch.action.type==='cast-spell'&&!immediate;
    const landingScale = moving ? new Vector3((queuedCast?QUEUED_CARD.width:boardRow.width)/(moving.width*50),(queuedCast?QUEUED_CARD.height:boardRow.height)/(moving.height*50),1) : Vector3.One();
    const settling = handUid ? batch.after.players[owner].board.flatMap((m,index)=>{
      const entry=entities.get(m.uid); return entry ? [{entry,start:entry.root.position.clone(),target:point(boardRow.center+(index-(boardSize-1)/2)*boardRow.spacing,boardRow.y,-.15)}] : [];
    }) : [];
    let landed: Entity | undefined;
    const deaths = new Set(batch.events?.deaths?.map(dead => dead.uid) ?? []);
    const deadObjects = Array.from(entities.values()).filter(entry => deaths.has(entry.data.uid));
    const playedCard=handUid?CARDS[moving?.data.cardId??'']:undefined;
    const legendaryPlay=!!playedCard&&playedCard.type==='minion'&&(playedCard.cost>=6||playedCard.rarity==='legendary')&&!options.reducedMotion;
    const publicPlay=handUid!==null&&(owner===1||legendaryPlay)&&!options.reducedMotion;
    const revealAt=legendaryPlay?point(800,475,-7):point(portrait?1070:1205,325,-6),revealSize=legendaryPlay?1.95:portrait?1.85:1.65,revealScale=new Vector3(revealSize,revealSize,1);
    const spec=attack?MOTION.attack:handUid?(legendaryPlay?MOTION.legendaryPlay:publicPlay?MOTION.enemyPlay:MOTION.play):batch.action.type==='hero-power'?MOTION.power:MOTION.turn;
    const drawn=batch.after.players.flatMap((p,owner)=>p.hand.filter(c=>!batch.before.players[owner].hand.some(old=>old.uid===c.uid)).map(c=>({...c,owner:owner as 0|1,index:p.hand.findIndex(h=>h.uid===c.uid)})));
    textures.preloadCards(drawn.filter(c=>c.owner===0).map(c=>c.cardId));
    const timeline=effectTimeline(batch,options.reducedMotion);
    const investmentPayout=validatorPayout(batch);
    const paintOrdersFrame=(paid:boolean)=>{
      const ordersState:GameState=investmentPayout?.owner===0&&!paid?{...batch.after,players:[{...batch.after.players[0],gas:batch.after.players[0].gas-investmentPayout.amount},batch.after.players[1]]}:batch.after;
      const counter=entities.get('gas-counter');if(counter)paint(counter,ordersFace(ordersState));
      gasFill(ordersState);
    };
    let frameKey:string|null=null;
    const paintFrame=(elapsedMs:number)=>{
      if(!timeline)return;
      const key=timeline.windows.filter(w=>elapsedMs>=w.contactMs).map(w=>w.key).join(':')+(elapsedMs>=timeline.tailMs?':final':'');
      if(key===frameKey)return;frameKey=key;
      const frame=effectFrame(batch,timeline,elapsedMs);
      frame.fighters.forEach(minion=>{const entry=entities.get(minion.uid);if(entry&&!entry.root.isDisposed())paint(entry,{kind:'minion',minion,ready:false,compact});});
      batch.after.players.forEach((player,p)=>{const entry=entities.get(`hero-${p}`);if(entry)paint(entry,{kind:'hero',heroId:player.heroId,treasury:frame.treasuries[p],aspect:rulerSocket(p,portrait).width/rulerSocket(p,portrait).height,framed:compact});});
      if(investmentPayout?.owner===0)paintOrdersFrame(elapsedMs>=timeline.tailMs||timeline.windows.some(w=>w.key==='aftermath'&&elapsedMs>=w.contactMs));
    };
    const contactMs=options.reducedMotion?72:Math.max(spec.duration*spec.contact,(batch.events?.spellResolved?.length??0)*75+90);
    const duration=options.reducedMotion?Math.max(180,contactMs+(timeline?.tailMs??0)):Math.max(spec.duration,contactMs+(timeline?.tailMs??230)+(drawn.length?MOTION.drawMs+Math.max(0,drawn.length-1)*65:0));
    const impactAt=contactMs/duration;
    if(batch.after.winner!==null)videoEffects.cancel();
    // Victory belongs inside the result dialog; ordinary accents belong on battle pieces.
    const cues=videoCues(batch).filter(cue=>cue.id!=='06-victory');
    const spriteContacts=new Set<string>();
    if(!options.reducedMotion)videoEffects.prepare(cues);
    const locate=(uid:string)=>{
      if(immediate&&uid===immediate.fromHandUid)return target.clone();
      if(uid==='arena-center')return Vector3.Zero();
      if(uid==='row-0'||uid==='row-1')return point(row(1,0).center,rowY(uid==='row-0'?0:1));
      if(uid==='gas-counter')return gasRack.position.clone();
      // Plays reflow the row: feedback belongs at the final socket, including
      // the new fighter which has no entity until the contact callback.
      for(const p of [0,1]){const board=batch.after.players[p].board,index=board.findIndex(m=>m.uid===uid);if(index>=0){const formation=row(board.length,p);return point(formation.center+(index-(board.length-1)/2)*formation.spacing,formation.y);}}
      const existing=entities.get(uid);if(existing)return existing.base.clone();
      const queued=queueAnchor(uid,[batch.after,batch.before],portrait);if(queued)return point(queued.x,queued.y,-1);
    };
    const cuePositions=new Map(cues.map(cue=>[cue.anchor,locate(cue.anchor)]));
    const locateSprite=(uid:string)=>entities.get(uid)?.root.position??cuePositions.get(uid);
    const cueBounds=(uid:string)=>{
      for(const owner of [0,1]){
        const board=batch.after.players[owner].board;
        if(board.some(m=>m.uid===uid)){
          const formation=row(board.length,owner);
          return {width:formation.width/50,height:formation.height/50,spacing:formation.spacing/50};
        }
      }
    };
    effects.begin(batch,locate,timeline);
    projectiles.begin(combat,attack?attacker?.base:undefined,attack?defender?.base:undefined);
    abilities.begin(batch,locate,timeline);
    const resolving=(batch.events?.spellResolved??[]).flatMap((s,i)=>{const entry=entities.get(`queued-${s.mempoolUid}`);return entry?[{entry,start:entry.base.clone(),delay:i*.075}]:[];});
    await scheduler.play(duration, impactAt, progress => {
      rejected.forEach(item=>{
        if(item.entry.root.isDisposed()||progress>=impactAt)return;
        const raw=Math.min(1,progress/impactAt),t=raw*raw*raw,destination=batch.before.turn===0?deckStack.position:point(portrait?1156:1370,portrait?95:90,-4);
        item.entry.root.position.copyFrom(Vector3.Lerp(item.start,destination,t));item.entry.root.position.z=-5;
        item.entry.root.scaling.copyFrom(Vector3.Lerp(item.scale,new Vector3(.45,.45,.45),t));item.entry.root.rotation.z=item.rotation*(1-t);
        item.entry.root.rotation.y=batch.before.turn===0?Math.sin(Math.min(1,raw/.5)*Math.PI)*Math.PI/2:0;
        if(batch.before.turn===0&&!item.flipped&&raw>.25){paint(item.entry,{kind:'back'});item.flipped=true;}
      });
      if (moving && start && !moving.root.isDisposed()) {
        // Attacks lunge and return. A played card travels once and stays at its destination.
        const eased = handUid?smooth(progress/impactAt):attackTravel(progress);
        if(publicPlay&&progress<impactAt){
          const phase=publicPlayPhase(progress/impactAt);
          const approach=Vector3.Lerp(start,revealAt,phase.approach);
          moving.root.position.copyFrom(Vector3.Lerp(approach,target,phase.landing));
          moving.root.scaling.copyFrom(Vector3.Lerp(Vector3.Lerp(startScale,revealScale,phase.approach),landingScale,phase.landing));
          moving.root.rotation.z=startRotation*(1-phase.approach);
          if(legendaryPlay){const rise=Math.sin(phase.approach*Math.PI/2)*(1-phase.landing);moving.root.rotation.x=-.18*rise;moving.root.rotation.y=.3*rise*(1-phase.landing);moving.root.position.z-=rise*1.4;}
        }else{
          const recoil=combat.delivery==='melee'?combat.recoil:combat.recoil*Math.min(1,2/Math.max(.001,Vector3.Distance(start,target)));
          moving.root.position.copyFrom(Vector3.Lerp(start, target, handUid ? eased : options.reducedMotion ? 0 : eased * recoil));
          moving.root.position.z -= Math.sin(Math.max(0,eased) * Math.PI) * (options.reducedMotion ? 0 : .35);
          if(heldArrival===moving)moving.root.position.z-=.65;
          if(handUid){moving.root.scaling.copyFrom(Vector3.Lerp(startScale,landingScale,eased));moving.root.rotation.z=startRotation*(1-eased);moving.root.rotation.x=0;moving.root.rotation.y=0;}
          else moving.root.scaling.setAll(options.reducedMotion?1:1 + Math.sin(progress * Math.PI) * .04);
        }
      }
      if(handUid){const t=Math.min(1,progress/impactAt),ease=t*t*(3-2*t);settling.forEach(({entry,start,target})=>{if(!entry.root.isDisposed())entry.root.position.copyFrom(Vector3.Lerp(start,target,ease));});}
      if(landed&&!landed.root.isDisposed()){
        const fade=options.reducedMotion?1:smooth((progress-impactAt)*duration/MOTION.arrivalFadeMs);
        landed.material.alpha=fade;landed.backing.visibility=fade;
        if(heldArrival){heldArrival.material.alpha=1-fade;heldArrival.backing.visibility=1-fade;if(fade===1)releaseArrival();}
        landed.root.scaling.setAll(.98+.02*fade);
      }
      drawFlights.forEach(f=>{
        const elapsed=(progress-impactAt)*duration-(timeline?.tailMs??0)-f.delay;
        f.entry.root.setEnabled(options.reducedMotion||elapsed>=0);
        const t=options.reducedMotion?1:Math.max(0,Math.min(1,elapsed/MOTION.drawMs));
        const own=f.entry.data.owner===0,phase=drawPhase(t);
        const reveal=own?point(portrait?1040:1080,665,-7):Vector3.Lerp(f.start,f.target,.65);
        const approach=Vector3.Lerp(f.start,reveal,phase.approach);
        f.entry.root.position.copyFrom(Vector3.Lerp(approach,f.target,phase.landing));
        f.entry.root.position.z=-7+phase.landing*5;
        const readScale=own?1.18:.8;
        f.entry.root.scaling.setAll((.45+(readScale-.45)*phase.approach)*(1-phase.landing)+phase.landing);
        f.entry.root.rotation.z=f.entry.fanAngle*phase.landing;
        if(own){
          f.entry.root.rotation.y=phase.flip<.5?phase.flip*Math.PI:-(1-phase.flip)*Math.PI;
          if(phase.flip>=.5&&!f.revealed){paint(f.entry,f.face);f.revealed=true;}
        }
        f.entry.root.getChildMeshes().forEach(mesh=>mesh.renderingGroupId=2);
      });
      resolving.forEach(({entry,start,delay})=>{
        if(entry.root.isDisposed())return;
        if(timeline){
          const window=timeline.windows.find(w=>w.key===entry.data.uid);
          const elapsed=(progress-impactAt)*duration;
          if(window){const t=Math.max(0,Math.min(1,(elapsed-window.startMs)/(window.endMs-window.startMs)));entry.root.position.copyFrom(start);if(!options.reducedMotion){entry.root.position.y+=Math.sin(t*Math.PI)*.25;entry.root.scaling.setAll(1+Math.sin(t*Math.PI)*.1);}entry.material.alpha=elapsed<window.contactMs?1:Math.max(0,1-(elapsed-window.contactMs)/(window.endMs-window.contactMs));entry.root.setEnabled(elapsed<window.endMs);}
          return;
        }
        if(progress>=impactAt)return;const t=smooth((progress*duration/1000-delay)/Math.max(.12,contactMs/1000-delay));entry.root.position.copyFrom(start);entry.root.position.y+=.8*t;entry.root.scaling.setAll(1+.55*t);entry.material.alpha=1-.65*t;
      });
      effects.tick(progress,impactAt,options.reducedMotion,duration);
      projectiles.tick(progress,impactAt,options.reducedMotion);
      abilities.tick(progress,impactAt,options.reducedMotion,duration);
      if(timeline)for(const window of timeline.windows){
        if((progress-impactAt)*duration<window.contactMs||spriteContacts.has(window.key))continue;
        spriteContacts.add(window.key);videoEffects.trigger(cues.filter(c=>c.wave===window.key),locateSprite,options.reducedMotion,window.endMs-window.contactMs,cueBounds);
      }
      if(progress>impactAt)paintFrame((progress-impactAt)*duration);
      deadObjects.forEach(entry=>{
        if(entry.root.isDisposed())return;
        const window=timeline?deathWindow(batch,timeline,entry.data.uid):undefined;
        const death=window?smooth(((progress-impactAt)*duration-window.contactMs)/Math.max(1,window.endMs-window.contactMs)):deathProgress(progress,impactAt);
        if(death>0){if(options.reducedMotion)entry.root.setEnabled(false);else entry.root.scaling.setAll(Math.max(.02,1-death));}
      });
      if (!options.reducedMotion) {
        if (batch.action.type === 'end-turn'){sandStream.setEnabled(progress>.15&&progress<.8);}
        if (batch.action.type === 'hero-power') entities.get('hero-power')?.root.scaling.setAll(1+Math.sin(progress*Math.PI)*.04);
        if (defender && defenderStart && progress>impactAt && !defender.root.isDisposed()) defender.root.position.x = defenderStart.x+Math.sin((progress-impactAt)*Math.PI*10)*.09*(1-progress);
      }
    }, () => {
      if (activeBatch?.id !== batch.id) return;
      hapticContact(batch.action.type);
      videoEffects.trigger(timeline?cues.filter(c=>!c.wave):cues,locateSprite,options.reducedMotion,undefined,cueBounds);
      const authoredLanding=cues.find(cue=>isSurfaceLanding(cue.id)&&cue.anchor===added?.uid);
      if((batch.events?.play||added)&&!(authoredLanding&&videoEffects.ready(authoredLanding.id)))deployments.begin(batch.events?.play?.cardId??added!.cardId,target,{width:boardRow.width/50,height:boardRow.height/50,spacing:boardRow.spacing/50},options.reducedMotion,added?()=>entities.get(added.uid)?.root.position:undefined);
      if(handUid){
        // Replace the arriving card with its battlefield/queue form at the same position,
        // at contact rather than after a return to the hand or a blank frame.
        if(moving){entities.delete(handUid);heldArrival=moving;moving.face.isPickable=false;moving.root.position.copyFrom(target);moving.root.position.z-=.65;}
        deadObjects.forEach(entry=>entities.delete(entry.data.uid));
        sync(batch.after);
        deadObjects.forEach(entry=>entities.set(entry.data.uid,entry));
        landed=added?entities.get(added.uid):!immediate&&pending.length?entities.get(`queued-${pending[pending.length-1].uid}`):undefined;
        if(landed&&!options.reducedMotion){landed.material.alpha=0;landed.backing.visibility=0;}else releaseArrival();
      }else if(drawn.length||resolving.length||added){
        // Retain doomed pieces until their death phase, while real hand/queue changes commit.
        const retained=[...deadObjects,...(timeline?resolving.map(r=>r.entry):[])];
        retained.forEach(entry=>entities.delete(entry.data.uid));sync(batch.after);retained.forEach(entry=>entities.set(entry.data.uid,entry));
        if(added){landed=entities.get(added.uid);if(landed&&!options.reducedMotion){landed.material.alpha=0;landed.backing.visibility=0;}}
      }
      drawn.forEach((c,i)=>{
        let entry=c.owner===0?entities.get(c.uid):c.index<8?entities.get(`back-${c.index}`):undefined;
        const temporary=!entry;
        if(!entry)entry=entity(`draw-${c.owner}-${c.uid}`,{kind:'hand',uid:`draw-${c.owner}-${c.uid}`,owner:c.owner},{kind:'back'},1,1.4);
        const face:Face=c.owner===0?{kind:'card',cardId:c.cardId}:{kind:'back'};
        const target=entry.base.clone();if(temporary)target.copyFrom(point(800+120,c.owner===0?handY():portrait?-93:35,.5));
        const start=c.owner===0?deckStack.position.clone():point(portrait?1156:1370,portrait?95:90,-4);
        paint(entry,{kind:'back'});entry.root.position.copyFrom(start);entry.root.scaling.setAll(.45);entry.face.isPickable=false;if(timeline)entry.root.setEnabled(false);
        drawFlights.push({entry,start,target,face,delay:i*65,revealed:false,temporary});
      });
      // Keep doomed figures for a short death phase; stats/HUD commit at contact.
      deadObjects.forEach(entry=>{
        if(entry.root.isDisposed()||entry.data.kind!=='minion')return;
        const previous=batch.before.players[entry.data.owner].board.find(m=>m.uid===entry.data.uid);
        if(previous)paint(entry,{kind:'minion',minion:{...previous,health:0},ready:false,compact});
      });
      batch.after.players.forEach((player, owner) => {
        const hero = entities.get(`hero-${owner}`);
        if (hero) paint(hero,{ kind: 'hero', heroId: player.heroId, treasury: player.treasury,aspect:rulerSocket(owner,portrait).width/rulerSocket(owner,portrait).height,framed:compact });
        player.board.forEach(minion => { const entry = entities.get(minion.uid); if (entry) paint(entry, { kind: 'minion', minion,readiness:fighterReadiness(batch.after,owner as 0|1,minion),compact }); });
      });
      paintOrdersFrame(!timeline||investmentPayout?.owner!==0);
      const clock = entities.get('block-counter'); if (clock) paint(clock, { kind: 'block', block: batch.after.block });
      // Queue results are already computed by the rules, but the board reveals
      // each public stat change only at that source's presentation contact.
      paintFrame(-1);
      if (defender && !defender.root.isDisposed()) defender.haloMaterial.emissiveColor = Color3.FromHexString('#ec9a58');
      impact();
    }, () => {
      if (activeBatch?.id !== batch.id) return;
      releaseArrival();releaseDraws();if(landed&&!landed.root.isDisposed()){landed.material.alpha=1;landed.backing.visibility=1;}
      entities.forEach(entry=>{entry.material.alpha=1;entry.face.isPickable=entry.data.owner===0||entry.data.kind!=='hand';entry.root.rotation.y=0;entry.root.rotation.x=0;});
      activeBatch = null; sync(batch.after);
      effects.clear();projectiles.clear();abilities.clear();
      resetClock();
    });
    request();
  }

  return {
    sync: (state: GameState) => { if (!activeBatch) sync(state); },
    select: (uid: string | null) => { selected = uid; highlights(); },
    setOverlayOpen: (open:boolean) => {overlayOpen=open;if(open){hovered=null;reportedHover=null;}highlights();},
    setPaused: (value:boolean) => {if(paused===value)return;paused=value;scheduler.setPaused(value);if(value){engine.stopRenderLoop(render);running=false;}else request();},
    setLocale: (locale: Locale) => textures.setLocale(locale),
    setQuality: (quality: RenderQuality) => {options.quality=quality;resize();},
    setReducedMotion: (reduced: boolean) => { options.reducedMotion = reduced; if(reduced){videoEffects.cancel();deployments.clear();} },
    present,
    cancel,
    dispose: () => {
      disposed = true; scheduler.cancel(); releaseArrival();releaseDraws(); resizeObserver.disconnect(); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('pointerleave', leavePointer);
      engine.stopRenderLoop(render); videoEffects.dispose(); effects.dispose();projectiles.dispose();abilities.dispose();deployments.dispose(); textures.dispose(); instrument.dispose(); scene.dispose(); engine.dispose(); entities.clear();
    },
  };
}

export type ArenaRenderer = ReturnType<typeof createArena>;
