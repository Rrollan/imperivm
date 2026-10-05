import { Engine } from '@babylonjs/core/Engines/engine';
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
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { mempoolOf, legalActions, effectivePowerCost } from '../../lib/engine/engine';
import type { GameState, Minion } from '../../lib/engine/types';
import type { Locale } from '../../lib/locale';
import { ArenaTextures, type Face } from './ArenaTextures';
import { PresentationScheduler } from './PresentationScheduler';
import { ArenaAssets, type ModelId, type ModelFit, type ModelHandle } from './ArenaAssets';
import { ArenaEffects } from './ArenaEffects';
import { ArenaSpriteEffects } from './ArenaSpriteEffects';
import { videoCues, VIDEO_IDS } from './videoCue';
import type { PresentationBatch } from './GameSession';
import {MOTION, smooth, settle, attackTravel} from './motionSpec';
import {ArenaAbilityEffects} from './ArenaAbilityEffects';
import {ArenaDeploymentEffects} from './ArenaDeploymentEffects';
import {pixelRatio, type RenderQuality} from './renderQuality';

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
  modelKey: string;
  modelReady: boolean;
  modelHandles: ModelHandle[];
  painted: Face;
  hoverLift: number;
  hoverTarget: number;
  fanAngle: number;
};

// One artwork coordinate system for the board, every socket, piece and hit target.
const point = (x: number, y: number, z = 0) => new Vector3((x - 800) / 50, (500 - y) / 50, z);

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
  const shadows = new ShadowGenerator(512, key);
  shadows.usePercentageCloserFiltering = true; shadows.filteringQuality = ShadowGenerator.QUALITY_LOW; shadows.bias = .002; shadows.normalBias = .035;
  const shadowMap=shadows.getShadowMap();if(shadowMap)shadowMap.refreshRate=0;
  key.shadowMinZ = 1; key.shadowMaxZ = 55; shadows.setDarkness(.55);
  const instrument = new SceneInstrumentation(scene);
  let frameSamples:number[]=[],renderSamples:number[]=[];
  let nextMetricAt=0;
  const percentile=(samples:number[],fraction:number)=>samples.length?Math.round([...samples].sort((a,b)=>a-b)[Math.floor((samples.length-1)*fraction)]*10)/10:0;
  const scheduler = new PresentationScheduler();
  let disposed = false, running = false, dirty = 3, last = 0, portrait = false, readyReported=false;
  let shown: GameState | null = null, selected: string | null = null;
  let hovered: string | null = null, reportedHover: string | null = null, overlayOpen=false;
  let activeBatch: PresentationBatch | null = null;
  const rowY=(owner:number)=>owner===0?535:portrait?260:335;
  // Measured recess centers in the delivered artwork. Portrait pixels map to
  // x=350+.9*px, y=-130+.9*py; landscape uses its 1600×1000 pixels directly.
  const heroX=()=>portrait?793:800;
  const heroY=(owner:number)=>owner===0?(portrait?774:686):(portrait?20:148);
  const queueX=()=>portrait?443:230;
  const queueY=(owner:number)=>owner===0?525:339;
  const handY=()=>portrait?1020:865;
  const entities = new Map<string, Entity>();
  let heldArrival: Entity | null = null;
  let drawFlights:{entry:Entity;start:Vector3;target:Vector3;face:Face;delay:number;revealed:boolean;temporary:boolean}[]=[];
  let layoutMoves:{entry:Entity;start:Vector3;target:Vector3;elapsed:number;startScale?:Vector3;startRotation?:number}[]=[];
  const materials = new Map<string, StandardMaterial>();
  const request = () => {
    if (disposed) return;
    dirty = 3;
    if (!running && !document.hidden) { running = true; last = performance.now(); engine.runRenderLoop(render); }
  };
  const textures = new ArenaTextures(scene, options.locale, request);
  const effects = new ArenaEffects(scene,request);
  const abilities = new ArenaAbilityEffects(scene,request);
  const deployments=new ArenaDeploymentEffects(scene,request);
  const videoEffects = new ArenaSpriteEffects(scene,request);
  // Warm every small combat atlas during loading, before its first contact.
  if(!options.reducedMotion)videoEffects.prepare(VIDEO_IDS.filter(id=>id!=='06-victory').map(id=>({id,anchor:'arena-center',width:4})));
  const assets = new ArenaAssets(scene, shadows, () => { shadowMap?.resetRefreshCounter();if (shown && !activeBatch) sync(shown); request(); });

  function material(name: string, color: string, specular = .2) {
    const known = materials.get(name); if (known) return known;
    const mat = new StandardMaterial(name, scene); mat.diffuseColor = Color3.FromHexString(color); mat.specularColor = new Color3(specular, specular * .86, specular * .6); mat.specularPower = 40;
    materials.set(name, mat); return mat;
  }
  const bronze = material('aged-bronze', '#87633a', .3);
  const board = MeshBuilder.CreatePlane('painted Roman arena', { width: 32, height: 20 }, scene);
  board.position.z = 1.7; board.isPickable = false; board.receiveShadows = true;
  const boardMaterial = material('painted arena surface', '#ffffff', 0);
  const painting = new Texture('/ui/arena-lab/roman-board-integrated.webp', scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, request, request);
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
    gasRack.position.copyFrom(point(portrait?811:1347,portrait?905:760));
    const counter=entities.get('gas-counter');
    if(counter)paint(counter,{kind:'orders',gas:state.players[0].gas,max:state.players[0].maxGas});
  }

  function paint(entry: Entity, face: Face) {
    entry.painted = face;
    const rendered = ['hero','power','deck'].includes(face.kind) ? { ...face, model: entry.modelReady } as Face : face;
    const signature = JSON.stringify(rendered);
    if (entry.signature !== signature) { entry.texture.update(rendered); entry.signature = signature; }
  }

  function modelPortrait(entry: Entity, face: Face) {
    if (face.kind !== 'hero' && face.kind !== 'power') return;
    const key = `${face.kind}-${face.heroId}`;
    if (entry.modelKey === key) return;
    entry.modelHandles.forEach(handle => handle.dispose()); entry.modelHandles = []; entry.modelKey = key; entry.modelReady = false;
    const attach = async (id: ModelId, fit: ModelFit, position: Vector3) => {
      const handle = await assets.attach(id, entry.root, fit, entry.data);
      if (!handle) return null;
      if (entry.root.isDisposed() || entry.modelKey !== key) { handle.dispose(); return null; }
      handle.root.position.copyFrom(position); entry.modelHandles.push(handle); return handle;
    };
    if (face.kind === 'hero') {
      // The Whale bas-relief's fine silhouette is clearer in its existing,
      // well-lit model poster at this small size, with no extra GLB or shader.
      if(face.heroId==='whale'){entry.backing.setEnabled(false);return;}
      // The painted socket is the frame; one real relief coin sits inside it.
      // Avoid two conflicting frames and the incomplete inner geometry of the Tripo ring.
      void attach(`hero-${face.heroId}` as ModelId, {width:(portrait?125:144)/50,height:(portrait?116:128)/50,depth:.20,stretch:true},new Vector3(0,0,-.65)).then(handle=>{
        if(handle&&!entry.root.isDisposed()&&entry.modelKey===key){entry.modelReady=true;entry.backing.setEnabled(false);entry.face.position.z=-.84;paint(entry,entry.painted);request();}
      });
    } else {
      // A painted relief has the same light and circular profile as its socket.
      // The Tripo bust/treasury silhouettes were floating above a generic sphere.
      entry.backing.setEnabled(false);
    }
  }

  function entity(keyId: string, data: ArenaTarget, face: Face, width: number, height: number): Entity {
    const known = entities.get(keyId);
    if (known && known.width === width && known.height === height) return known;
    if (known) { destroy(known); entities.delete(keyId); }
    const root = new TransformNode(keyId, scene); root.rotation.x = 0;
    const oval = face.kind === 'hero' || face.kind === 'minion' || face.kind === 'power';
    const backing = oval
      ? MeshBuilder.CreateSphere(`${keyId}-thickness`, { diameter: 1, segments: 12 }, scene)
      : MeshBuilder.CreateBox(`${keyId}-thickness`, { width: width * .95, height: height * .93, depth: .13 }, scene);
    if (oval) { backing.scaling.set(width * .85, height * .8, .17); backing.position.y = height * .055; }
    backing.parent = root; backing.position.z = .09; backing.material = bronze; backing.isPickable = false;
    if (['hero','power','command','gas','orders','block','deck','scroll','queueTitle'].includes(face.kind)) backing.setEnabled(false);
    const faceMesh = MeshBuilder.CreatePlane(`${keyId}-face`, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    const texture = textures.make(`${keyId}-ink`, face);
    const mat = new StandardMaterial(`${keyId}-material`, scene); mat.diffuseTexture = texture.texture; mat.emissiveTexture = texture.texture; mat.emissiveColor = Color3.White(); mat.diffuseColor = Color3.Black(); mat.disableLighting = true; mat.specularColor = Color3.Black(); mat.useAlphaFromDiffuseTexture = true;
    faceMesh.parent = root; faceMesh.position.z = -.01; faceMesh.material = mat; faceMesh.metadata = data;
    const halo = oval ? MeshBuilder.CreateTorus(`${keyId}-halo`, { diameter: 1, thickness: .045, tessellation: 48 }, scene) : MeshBuilder.CreatePlane(`${keyId}-halo`, { width: width * 1.06, height: height * 1.04 }, scene);
    if (oval) { halo.rotation.x = Math.PI / 2; halo.scaling.set(width * .89, 1, height * .81); halo.position.y = height * .055; }
    const haloMat = new StandardMaterial(`${keyId}-halo-material`, scene); haloMat.diffuseColor = Color3.Black(); haloMat.emissiveColor = Color3.FromHexString('#427650'); haloMat.alpha = oval ? .9 : .22; haloMat.disableLighting = true;
    halo.parent = root; halo.position.z = -.03; halo.material = haloMat; halo.isPickable = false; halo.setEnabled(false);
    const entry: Entity = { root, face: faceMesh, halo, material: mat, haloMaterial: haloMat, texture, data, base: Vector3.Zero(), signature: '', width, height, backing, modelKey: '', modelReady: false, modelHandles: [], painted: face,hoverLift:0,hoverTarget:0,fanAngle:0 };
    entities.set(keyId, entry); return entry;
  }

  function destroy(entry: Entity) { entry.modelHandles.forEach(handle => handle.dispose()); entry.root.dispose(false, false); entry.texture.dispose(); entry.material.dispose(); entry.haloMaterial.dispose(); }

  function highlights() {
    const legal = shown ? legalActions(shown) : [];
    const targets = legal.filter(a => a.type === 'attack' && a.attackerUid === selected).map(a => a.type === 'attack' ? a.target : '');
    entities.forEach(entry => {
      const ready = shown?.turn === 0 && legal.some(a => a.type === 'attack' && a.attackerUid === entry.data.uid);
      const powerReady = entry.data.kind === 'power' && shown?.turn === 0 && legal.some(a=>a.type==='hero-power');
      const target = entry.data.owner === 1 && targets.includes(entry.data.kind === 'hero' ? 'hero' : entry.data.uid);
      const active = selected === entry.data.uid;
      entry.halo.setEnabled(!activeBatch && (ready || powerReady || target || active));
      const color = target ? '#ff8750' : active ? '#fff0bc' : '#c29c59';
      entry.haloMaterial.emissiveColor = Color3.FromHexString(color);
      entry.haloMaterial.alpha = target || active ? 1 : .5;
      entry.hoverTarget=!overlayOpen&&!activeBatch&&entry.data.kind==='hand'&&entry.data.owner===0&&hovered===entry.data.uid?1:0;
    });
    updateAim();
    request();
  }

  function sync(state: GameState) {
    const changed=shown!==null&&shown!==state;
    shown = state;
    const readyAttackers=new Set(!activeBatch&&state.turn===0?legalActions(state).flatMap(action=>action.type==='attack'?[action.attackerUid]:[]):[]);
    const used = new Set<string>();
    const keep = (id: string, data: ArenaTarget, face: Face, w: number, h: number, x: number, y: number, z = 0) => {
      used.add(id);const old=entities.get(id),previous=old?.root.position.clone(); const entry = entity(id,data,face,w/50,h/50);
      entry.data=data;entry.face.metadata=data;entry.root.setEnabled(true);
      paint(entry,face); modelPortrait(entry,face);
      entry.base.copyFrom(point(x,y,z)); entry.root.position.copyFrom(entry.base); entry.root.scaling.setAll(1);
      if(changed&&previous&&old===entry&&(data.kind==='minion'||data.kind==='hand'&&data.owner===0)&&Vector3.DistanceSquared(previous,entry.base)>.001&&!options.reducedMotion){
        layoutMoves=layoutMoves.filter(m=>m.entry!==entry);layoutMoves.push({entry,start:previous,target:entry.base.clone(),elapsed:0});entry.root.position.copyFrom(previous);
      }
      entry.fanAngle=data.kind === 'hand' && data.owner === 0 ? -(x-800)*.00015 : 0;
      entry.root.rotation.z = entry.fanAngle;
      return entry;
    };
    state.players.forEach((player,index)=>{
      const owner = index as 0|1;
      keep(`hero-${owner}`,{kind:'hero',uid:`hero-${owner}`,owner},{kind:'hero',heroId:player.heroId,treasury:player.treasury},portrait?190:205,portrait?205:220,heroX(),heroY(owner),-1.6);
      const spacing = Math.min(portrait?124:150,(portrait?700:980)/Math.max(1,player.board.length));
      player.board.forEach((m,i)=>keep(m.uid,{kind:'minion',uid:m.uid,owner,cardId:m.cardId},{kind:'minion',minion:m,ready:readyAttackers.has(m.uid)},portrait?120:145,portrait?162:196,800+(i-(player.board.length-1)/2)*spacing,rowY(owner),-.15));
    });
    const hand = state.players[0].hand;
    const spacing = Math.min(portrait?136:155,(portrait?670:900)/Math.max(1,hand.length-1));
    hand.forEach((c,i)=>{const x=800+(i-(hand.length-1)/2)*spacing;keep(c.uid,{kind:'hand',uid:c.uid,owner:0,cardId:c.cardId},{kind:'card',cardId:c.cardId},portrait?150:168,portrait?208:234,x,handY()+Math.abs(x-800)*.024,-1-i*.015);});
    const backs = Math.min(8,state.players[1].hand.length);
    for(let i=0;i<backs;i++){const e=keep(`back-${i}`,{kind:'hand',uid:`back-${i}`,owner:1},{kind:'back'},50,70,800+(i-(backs-1)/2)*40,portrait?-93:35,.5);e.face.isPickable=false;}
    for(const owner of [0,1] as const){
      const spells=mempoolOf(state,owner);
      spells.slice(0,3).forEach((spell,i)=>{
        const id=`queued-${spell.uid}`;
        const e=keep(id,{kind:'queue',uid:id,owner,cardId:spell.cardId},{kind:'queued',cardId:spell.cardId,owner,count:spells.length,ordinal:i+1},130,174,queueX()+i*7,queueY(owner)-i*7,-1+i*.03);
        e.face.metadata=e.data;
      });
    }
    const native = (id:string,kind:ArenaTarget['kind'],face:Face,w:number,h:number,x:number,y:number)=>keep(id,{kind,uid:id,owner:0},face,w,h,x,y,-.5);
    const me=state.players[0];
    native('turn-command','command',{kind:'command',state:activeBatch?'busy':state.winner!==null?'over':state.turn===0?'own':'enemy',engraved:true},190,72,portrait?1165:1452,portrait?621:465);
    native('hero-power','power',{kind:'power',heroId:me.heroId,cost:effectivePowerCost(state,0),available:state.turn===0&&legalActions(state).some(a=>a.type==='hero-power')},101,101,portrait?960:975,portrait?792:703);
    native('gas-counter','gas',{kind:'orders',gas:me.gas,max:me.maxGas},portrait?650:488,portrait?68:54,portrait?876:1391,portrait?905:760);
    native('block-counter','block',{kind:'block',block:state.block},60,78,portrait?446:234,portrait?70:220);
    const deck=native('own-deck','deck',{kind:'deck',count:me.deck.length},80,112,portrait?1163:1390,portrait?202:238);deck.modelReady=true;paint(deck,deck.painted);
    native('battle-scroll','scroll',{kind:'queueTitle',own:mempoolOf(state,0).length,enemy:mempoolOf(state,1).length},180,110,queueX(),190);
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
    if(to)effects.aim(source.base,to,valid);else effects.hideAim();
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
    portrait=aspect<1.1;
    if(portrait&&!portraitPainting){portraitPainting=new Texture('/ui/arena-lab/roman-board-integrated-portrait.webp',scene,false,true,Texture.TRILINEAR_SAMPLINGMODE,request,request);portraitPainting.wrapU=Texture.CLAMP_ADDRESSMODE;portraitPainting.wrapV=Texture.CLAMP_ADDRESSMODE;}
    board.scaling.set(portrait?18/32:1,portrait?25.2/20:1,1);
    boardMaterial.diffuseTexture=portrait?portraitPainting!:painting;boardMaterial.emissiveTexture=boardMaterial.diffuseTexture;
    const height=portrait?Math.max(12.6,9/aspect):Math.max(10.2,16.3/aspect);
    camera.orthoTop=height;camera.orthoBottom=-height;camera.orthoLeft=-height*aspect;camera.orthoRight=height*aspect;
    const menu=point(portrait?1175:1515,portrait?1070:915);
    canvas.parentElement?.style.setProperty('--arena-menu-x',`${(menu.x/(height*aspect)+1)*canvas.clientWidth/2}px`);
    canvas.parentElement?.style.setProperty('--arena-menu-y',`${(1-menu.y/height)*canvas.clientHeight/2}px`);
    if(shown&&!activeBatch)sync(shown);request();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const visibility = () => {
    if (document.hidden) { engine.stopRenderLoop(render); running = false; }
    else request();
  };
  document.addEventListener('visibilitychange', visibility);
  function reportMetrics(){
    const meshes=scene.meshes.filter(mesh=>mesh.isEnabled());
    options.onMetrics({meshes:meshes.length,triangles:meshes.reduce((n,mesh)=>n+mesh.getTotalIndices()/3,0),drawCalls:instrument.drawCallsCounter.current,renderScale:engine.getHardwareScalingLevel(),renderWidth:engine.getRenderWidth(),renderHeight:engine.getRenderHeight(),models:assets.loaded.size,failedModels:assets.failed.size,frames:frameSamples.length,frameMedianMs:percentile(frameSamples,.5),frameP95Ms:percentile(frameSamples,.95),renderP95Ms:percentile(renderSamples,.95),gpu:engine.getGlInfo().renderer,pending:meshes.filter(mesh=>mesh.isVisible&&mesh.visibility>0&&!mesh.isReady(true)).slice(0,6).map(mesh=>mesh.name)});
  }
  function render() {
    if (disposed || document.hidden) return;
    if(!readyReported){
      const portraitsReady=shown?.players.every(p=>p.heroId==='whale'||assets.loaded.has(`hero-${p.heroId}` as ModelId)||assets.failed.has(`hero-${p.heroId}` as ModelId));
      const visibleReady=scene.meshes.every(mesh=>!mesh.isEnabled()||!mesh.isVisible||mesh.visibility<=0||mesh.isReady(true));
      if(portraitsReady&&textures.isReady()&&painting.isReady()&&(!portrait||portraitPainting?.isReady())&&visibleReady){
        readyReported=true;options.onReady?.();
      }
    }
    const time = performance.now(), rawDelta=Math.max(0,time-last), delta=rawDelta; last = time;
    scheduler.tick(delta);
    videoEffects.tick(delta);
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
    if (!scheduler.active && !videoEffects.active && !settling && --dirty <= 0) {
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
  function cancel() { scheduler.cancel(); releaseArrival(); releaseDraws();layoutMoves=[];effects.clear();abilities.clear();deployments.clear(); videoEffects.cancel(); activeBatch = null; released=null; entities.forEach(entry=>{entry.material.alpha=1;entry.backing.visibility=1;entry.hoverLift=0;}); resetClock(); clearPress(); if (shown) sync(shown); }

  async function present(batch: PresentationBatch, impact: () => void) {
    scheduler.cancel(); releaseArrival();releaseDraws();layoutMoves=[]; activeBatch = batch; options.onHover(null); hovered = null; selected = null; highlights();
    const command = entities.get('turn-command'); if (command) paint(command, { kind: 'command', state: 'busy', engraved: true });
    const attack = batch.action.type === 'attack' ? batch.action : null;
    const attacker = attack ? entities.get(attack.attackerUid) : null;
    const defender = attack ? entities.get(attack.target === 'hero' ? `hero-${batch.before.turn === 0 ? 1 : 0}` : attack.target) : null;
    const handUid = batch.action.type === 'play-minion' || batch.action.type === 'cast-spell' ? batch.action.uid : null;
    let moving = attacker ?? (handUid ? entities.get(handUid) : null);
    if(handUid&&!moving){
      const card=batch.before.players[batch.before.turn].hand.find(c=>c.uid===handUid);
      if(card){moving=entity(handUid,{kind:'hand',uid:handUid,owner:batch.before.turn,cardId:card.cardId},{kind:'card',cardId:card.cardId},168/50,234/50);moving.base.copyFrom(point(800,portrait?-93:35,-2));moving.root.position.copyFrom(moving.base);entities.get(`back-${Math.min(7,batch.before.players[1].hand.length-1)}`)?.root.setEnabled(false);}
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
    const boardSpacing = Math.min(portrait?124:150,(portrait?700:980)/Math.max(1,boardSize));
    const addedIndex = added ? batch.after.players[owner].board.findIndex(m=>m.uid===added.uid) : 0;
    const pending = mempoolOf(batch.after, owner), pendingIndex = Math.min(5,pending.length-1);
    const target = defender?.root.position.clone() ?? (batch.action.type === 'cast-spell'
      ? point(queueX()+Math.min(2,pendingIndex)*7,queueY(owner)-Math.min(2,pendingIndex)*7,-1)
      : point(800+(addedIndex-(boardSize-1)/2)*boardSpacing,rowY(owner),-.15));
    const landingScale = moving ? new Vector3((batch.action.type==='cast-spell'?130:portrait?120:145)/(moving.width*50),(batch.action.type==='cast-spell'?174:portrait?162:196)/(moving.height*50),1) : Vector3.One();
    const settling = handUid ? batch.after.players[owner].board.flatMap((m,index)=>{
      const entry=entities.get(m.uid); return entry ? [{entry,start:entry.root.position.clone(),target:point(800+(index-(boardSize-1)/2)*boardSpacing,rowY(owner),-.15)}] : [];
    }) : [];
    let landed: Entity | undefined;
    const deaths = new Set(batch.events?.deaths?.map(dead => dead.uid) ?? []);
    const deadObjects = Array.from(entities.values()).filter(entry => deaths.has(entry.data.uid));
    const spec=attack?MOTION.attack:handUid?MOTION.play:batch.action.type==='hero-power'?MOTION.power:MOTION.turn;
    const drawn=batch.after.players.flatMap((p,owner)=>p.hand.filter(c=>!batch.before.players[owner].hand.some(old=>old.uid===c.uid)).map(c=>({...c,owner:owner as 0|1,index:p.hand.findIndex(h=>h.uid===c.uid)})));
    textures.preloadCards(drawn.filter(c=>c.owner===0).map(c=>c.cardId));
    const contactMs=options.reducedMotion?72:Math.max(spec.duration*spec.contact,(batch.events?.spellResolved?.length??0)*75+90);
    const duration=options.reducedMotion?180:Math.max(spec.duration,contactMs+(drawn.length?420+Math.max(0,drawn.length-1)*65:230));
    const impactAt=contactMs/duration;
    if(batch.after.winner!==null)videoEffects.cancel();
    // Victory belongs inside the result dialog; ordinary accents belong on battle pieces.
    const cues=videoCues(batch).filter(cue=>cue.id!=='06-victory');
    if(!options.reducedMotion)videoEffects.prepare(cues);
    const cuePositions=new Map(cues.map(cue=>[cue.anchor,cue.anchor==='arena-center'?Vector3.Zero():cue.anchor==='row-0'?point(800,rowY(0)):cue.anchor==='row-1'?point(800,rowY(1)):cue.anchor==='gas-counter'?gasRack.position.clone():entities.get(cue.anchor)?.base.clone()]));
    const locate=(uid:string)=>{
      if(uid==='arena-center')return Vector3.Zero();
      if(uid==='row-0'||uid==='row-1')return point(800,rowY(uid==='row-0'?0:1));
      if(uid==='gas-counter')return gasRack.position.clone();
      const existing=entities.get(uid);if(existing)return existing.base.clone();
      for(const owner of [0,1]){const row=batch.after.players[owner].board,index=row.findIndex(m=>m.uid===uid);if(index>=0){const spacing=Math.min(portrait?124:150,(portrait?700:980)/row.length);return point(800+(index-(row.length-1)/2)*spacing,rowY(owner));}}
    };
    effects.begin(batch,locate,handUid?target:undefined);
    abilities.begin(batch,locate);
    const resolving=(batch.events?.spellResolved??[]).flatMap((s,i)=>{const entry=entities.get(`queued-${s.mempoolUid}`);return entry?[{entry,start:entry.base.clone(),delay:i*.075}]:[];});
    await scheduler.play(duration, impactAt, progress => {
      if (moving && start && !moving.root.isDisposed()) {
        // Attacks lunge and return. A played card travels once and stays at its destination.
        const eased = handUid?smooth(progress/impactAt):attackTravel(progress);
        moving.root.position.copyFrom(Vector3.Lerp(start, target, handUid ? eased : options.reducedMotion ? 0 : eased * .84));
        moving.root.position.z -= Math.sin(Math.max(0,eased) * Math.PI) * (options.reducedMotion ? 0 : .35);
        if(heldArrival===moving)moving.root.position.z-=.65;
        if(handUid){moving.root.scaling.copyFrom(Vector3.Lerp(startScale,landingScale,eased));moving.root.rotation.z=startRotation*(1-eased);}
        else moving.root.scaling.setAll(1 + Math.sin(progress * Math.PI) * .04);
      }
      if(handUid){const t=Math.min(1,progress/impactAt),ease=t*t*(3-2*t);settling.forEach(({entry,start,target})=>{if(!entry.root.isDisposed())entry.root.position.copyFrom(Vector3.Lerp(start,target,ease));});}
      if(landed&&!landed.root.isDisposed()){
        const fade=options.reducedMotion?1:smooth((progress-impactAt)*duration/MOTION.arrivalFadeMs);
        landed.material.alpha=fade;landed.backing.visibility=fade;
        if(heldArrival){heldArrival.material.alpha=1-fade;heldArrival.backing.visibility=1-fade;if(fade===1)releaseArrival();}
        landed.root.scaling.setAll(.98+.02*fade);
      }
      drawFlights.forEach(f=>{
        const t=options.reducedMotion?1:Math.max(0,Math.min(1,((progress-impactAt)*duration-f.delay)/420));
        const ease=smooth(t);f.entry.root.position.copyFrom(Vector3.Lerp(f.start,f.target,ease));f.entry.root.position.z=-6+ease*4;
        if(!options.reducedMotion)f.entry.root.position.y+=Math.sin(t*Math.PI)*1.5;
        f.entry.root.scaling.setAll(.45+.55*ease);f.entry.root.rotation.z=f.entry.fanAngle*ease;
        if(f.entry.data.owner===0){f.entry.root.rotation.y=t<.45?t/.45*Math.PI/2:-(1-(t-.45)/.55)*Math.PI/2;if(t>=.45&&!f.revealed){paint(f.entry,f.face);f.revealed=true;}}
        f.entry.root.getChildMeshes().forEach(mesh=>mesh.renderingGroupId=2);
      });
      resolving.forEach(({entry,start,delay})=>{if(entry.root.isDisposed()||progress>=impactAt)return;const t=smooth((progress*duration/1000-delay)/Math.max(.12,contactMs/1000-delay));entry.root.position.copyFrom(start);entry.root.position.y+=.8*t;entry.root.scaling.setAll(1+.55*t);entry.material.alpha=1-.65*t;});
      effects.tick(progress,impactAt,options.reducedMotion);
      deployments.tick(progress,impactAt,options.reducedMotion);
      abilities.tick(progress,impactAt,options.reducedMotion);
      if (progress > .55) deadObjects.forEach(entry => { if (!entry.root.isDisposed()) entry.root.scaling.setAll(Math.max(.02, 1 - (progress - .55) / .45)); });
      if (!options.reducedMotion) {
        if (batch.action.type === 'end-turn'){sandStream.setEnabled(progress>.15&&progress<.8);}
        if (batch.action.type === 'hero-power') entities.get('hero-power')?.root.scaling.setAll(1+Math.sin(progress*Math.PI)*.04);
        if (defender && defenderStart && progress>impactAt && !defender.root.isDisposed()) defender.root.position.x = defenderStart.x+Math.sin((progress-impactAt)*Math.PI*10)*.09*(1-progress);
      }
    }, () => {
      if (activeBatch?.id !== batch.id) return;
      videoEffects.trigger(cues,uid=>cuePositions.get(uid),options.reducedMotion);
      if(batch.events?.play)deployments.begin(batch.events.play.cardId,target);
      if(handUid){
        // Replace the arriving card with its battlefield/queue form at the same position,
        // at contact rather than after a return to the hand or a blank frame.
        if(moving){entities.delete(handUid);heldArrival=moving;moving.face.isPickable=false;moving.root.position.copyFrom(target);moving.root.position.z-=.65;}
        sync(batch.after);
        landed=added?entities.get(added.uid):pending.length?entities.get(`queued-${pending[pending.length-1].uid}`):undefined;
        if(landed&&!options.reducedMotion){landed.material.alpha=0;landed.backing.visibility=0;}else releaseArrival();
      }else if(drawn.length||resolving.length){
        // Retain doomed pieces until their death phase, while real hand/queue changes commit.
        deadObjects.forEach(entry=>entities.delete(entry.data.uid));sync(batch.after);deadObjects.forEach(entry=>entities.set(entry.data.uid,entry));
      }
      drawn.forEach((c,i)=>{
        let entry=c.owner===0?entities.get(c.uid):c.index<8?entities.get(`back-${c.index}`):undefined;
        const temporary=!entry;
        if(!entry)entry=entity(`draw-${c.owner}-${c.uid}`,{kind:'hand',uid:`draw-${c.owner}-${c.uid}`,owner:c.owner},{kind:'back'},1,1.4);
        const face:Face=c.owner===0?{kind:'card',cardId:c.cardId}:{kind:'back'};
        const target=entry.base.clone();if(temporary)target.copyFrom(point(800+120,c.owner===0?handY():portrait?-93:35,.5));
        const start=c.owner===0?deckStack.position.clone():point(portrait?1156:1370,portrait?95:90,-4);
        paint(entry,{kind:'back'});entry.root.position.copyFrom(start);entry.root.scaling.setAll(.45);entry.face.isPickable=false;
        drawFlights.push({entry,start,target,face,delay:i*65,revealed:false,temporary});
      });
      // Keep doomed figures for a short death phase; stats/HUD commit at contact.
      deadObjects.forEach(entry=>{
        if(entry.root.isDisposed()||entry.data.kind!=='minion')return;
        const previous=batch.before.players[entry.data.owner].board.find(m=>m.uid===entry.data.uid);
        if(previous)paint(entry,{kind:'minion',minion:{...previous,health:0},ready:false});
      });
      batch.after.players.forEach((player, owner) => {
        const hero = entities.get(`hero-${owner}`);
        if (hero) paint(hero,{ kind: 'hero', heroId: player.heroId, treasury: player.treasury });
        player.board.forEach(minion => { const entry = entities.get(minion.uid); if (entry) paint(entry, { kind: 'minion', minion }); });
      });
      const gas = entities.get('gas-counter'); if (gas) paint(gas, { kind: 'orders', gas: batch.after.players[0].gas, max: batch.after.players[0].maxGas });
      gasFill(batch.after);
      const clock = entities.get('block-counter'); if (clock) paint(clock, { kind: 'block', block: batch.after.block });
      if (defender && !defender.root.isDisposed()) defender.haloMaterial.emissiveColor = Color3.FromHexString('#ec9a58');
      impact();
    }, () => {
      if (activeBatch?.id !== batch.id) return;
      releaseArrival();releaseDraws();if(landed&&!landed.root.isDisposed()){landed.material.alpha=1;landed.backing.visibility=1;}
      entities.forEach(entry=>{entry.material.alpha=1;entry.face.isPickable=entry.data.owner===0||entry.data.kind!=='hand';entry.root.rotation.y=0;});
      activeBatch = null; sync(batch.after);
      effects.clear();abilities.clear();deployments.clear();
      resetClock();
    });
    request();
  }

  return {
    sync: (state: GameState) => { if (!activeBatch) sync(state); },
    select: (uid: string | null) => { selected = uid; highlights(); },
    setOverlayOpen: (open:boolean) => {overlayOpen=open;if(open){hovered=null;reportedHover=null;}highlights();},
    setLocale: (locale: Locale) => textures.setLocale(locale),
    setQuality: (quality: RenderQuality) => {options.quality=quality;resize();},
    setReducedMotion: (reduced: boolean) => { options.reducedMotion = reduced; if(reduced)videoEffects.cancel(); },
    present,
    cancel,
    dispose: () => {
      disposed = true; scheduler.cancel(); releaseArrival();releaseDraws(); resizeObserver.disconnect(); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('pointercancel', cancelPointer);
      canvas.removeEventListener('pointerleave', leavePointer);
      engine.stopRenderLoop(render); videoEffects.dispose(); effects.dispose();abilities.dispose();deployments.dispose(); assets.dispose(); textures.dispose(); instrument.dispose(); scene.dispose(); engine.dispose(); entities.clear();
    },
  };
}

export type ArenaRenderer = ReturnType<typeof createArena>;
