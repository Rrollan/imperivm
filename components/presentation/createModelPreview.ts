import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ArenaAssets, type ModelId } from './ArenaAssets';

export function createModelPreview(canvas: HTMLCanvasElement, id:ModelId, angle:number, ready:()=>void, failure:()=>void) {
  const engine = new Engine(canvas,true,{powerPreference:'low-power'});
  engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.4));
  const scene = new Scene(engine); scene.clearColor = new Color4(.062,.075,.064,1);
  const camera = new ArcRotateCamera('inspection',-Math.PI/2,Math.PI*.46,4.1,Vector3.Zero(),scene);
  camera.attachControl(canvas,true); camera.lowerRadiusLimit=1.7; camera.upperRadiusLimit=7;
  const sky = new HemisphericLight('sky',Vector3.Up(),scene); sky.intensity=.8;
  const key = new DirectionalLight('key',new Vector3(.5,-1,.4),scene); key.intensity=1.2; key.diffuse=Color3.FromHexString('#ffe5ba');
  const assets = new ArenaAssets(scene,null,()=>{dirty=5;});
  const root = new TransformNode('preview',scene);
  let dirty=5, disposed=false;
  void assets.attach(id,root,{width:2.2,height:2.2,depth:2.2,yaw:angle*Math.PI/180}).then(handle=>{if(disposed)return;handle?ready():failure();dirty=5;});
  // The gallery follows camera input; gameplay has a separate event-driven render loop.
  engine.runRenderLoop(()=>{if(!document.hidden && (!scene.isReady() || dirty-->0 || camera.inertialAlphaOffset || camera.inertialBetaOffset || camera.inertialRadiusOffset)) scene.render();});
  const request=()=>{dirty=5;}; canvas.addEventListener('pointermove',request); canvas.addEventListener('wheel',request);
  const resize = new ResizeObserver(()=>{engine.resize();request();}); resize.observe(canvas);
  return ()=>{disposed=true;resize.disconnect();canvas.removeEventListener('pointermove',request);canvas.removeEventListener('wheel',request);assets.dispose();scene.dispose();engine.dispose();};
}
