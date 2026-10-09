import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';

/** Only light leaking from the existing rim; no ornament outside the card. */
export function readinessInk(scene:Scene,oval:boolean){
  const texture=new DynamicTexture(oval?'medallion ready rim':'card ready rim',512,scene,false);texture.hasAlpha=true;
  const c=texture.getContext() as unknown as CanvasRenderingContext2D;
  const path=()=>{c.beginPath();if(oval)c.arc(256,256,206,0,Math.PI*2);else c.roundRect(16,12,480,488,22);};
  for(const [line,alpha] of [[32,.025],[22,.04],[12,.075],[5,.2]] as const){path();c.strokeStyle=`rgba(243,192,100,${alpha})`;c.lineWidth=line;c.stroke();}
  texture.update();return texture;
}

/** Two physical brackets. Geometry is measured in world space, not a stretched image. */
export class AttackCapture {
  private meshes:Mesh[]=[];private materials:StandardMaterial[]=[];
  private key='';private at=Vector3.Zero();private phase=0;private visible=false;
  constructor(private scene:Scene){
    for(const [color,width] of [['#432315',.052],['#c18043',.029],['#efbd72',.009]] as const){
      const material=new StandardMaterial('target bracket',scene);material.disableLighting=true;material.diffuseColor=Color3.Black();material.emissiveColor=Color3.FromHexString(color);this.materials.push(material);
      for(let side=0;side<2;side++){
        const paths=[Array.from({length:25},()=>Vector3.Zero()),Array.from({length:25},()=>Vector3.Zero())];
        const mesh=MeshBuilder.CreateRibbon('attack bracket',{pathArray:paths,updatable:true,sideOrientation:Mesh.DOUBLESIDE},scene);
        mesh.material=material;mesh.isPickable=false;mesh.renderingGroupId=3;mesh.setEnabled(false);mesh.metadata={strokeWidth:width,side};this.meshes.push(mesh);
      }
    }
  }
  show(at:Vector3|undefined,width:number,height:number,oval:boolean){
    this.visible=!!at;this.meshes.forEach(m=>m.setEnabled(!!at));if(!at)return;this.at.copyFrom(at);
    const key=`${width}:${height}:${oval}`;
    if(key!==this.key){this.key=key;
      this.meshes.forEach((mesh,index)=>{
        const stroke=[.052,.029,.009][Math.floor(index/2)],side=index%2;
        const points=Array.from({length:25},(_,i)=>{
          const t=i/24;
          if(oval){
            // Leave the lower-right health crystal completely clear.
            const angle=side===0?.08*Math.PI+t*.84*Math.PI:1.08*Math.PI+t*.44*Math.PI;
            return new Vector3(Math.cos(angle)*width*.435,Math.sin(angle)*height*.435,0);
          }
          // Left/right rounded clamp along the card frame, with short inward returns.
          const x=width*.51*(side===0?-1:1),y=(.5-t)*height*.91,returnX=Math.max(0,Math.abs(t-.5)-.38)/.12*width*.12;
          return new Vector3(x+(side===0?returnX:-returnX),y,0);
        });
        const paths=[[],[]] as [Vector3[],Vector3[]];
        points.forEach((p,i)=>{const d=points[Math.min(24,i+1)].subtract(points[Math.max(0,i-1)]),l=Math.max(.001,Math.hypot(d.x,d.y)),n=new Vector3(-d.y/l*stroke,d.x/l*stroke,0);paths[0].push(p.add(n));paths[1].push(p.subtract(n));});
        MeshBuilder.CreateRibbon('attack bracket',{pathArray:paths,instance:mesh});
      });
    }
    this.tick(0,true);
  }
  tick(delta:number,reduced:boolean){if(!this.visible)return;this.phase+=Math.min(delta,50)/1000;const pulse=reduced?1:1+Math.sin(this.phase*5)*.008;this.meshes.forEach((mesh,index)=>{mesh.position.set(this.at.x,this.at.y,-10-index*.005);mesh.scaling.set(pulse,pulse,1);});}
  hide(){this.visible=false;this.meshes.forEach(m=>m.setEnabled(false));}
  dispose(){this.meshes.forEach(m=>m.dispose());this.materials.forEach(m=>m.dispose());}
}
