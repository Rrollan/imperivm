import type { Metadata } from 'next';
import frames from '../../../docs/flow-vfx/frames-phase2.json';
import omni from '../../../docs/omni-vfx/manifest.json';
import FlowKit from '../../../components/presentation/FlowKit';
import registry from '../../../public/ui/arena-lab/fx/manifest.json';
import olympus from '../../../docs/olympus-vfx/manifest.json';

export const metadata:Metadata={title:'Анимации для Omni Flash — IMPERIVM'};
export default function Page({searchParams}:{searchParams:{pack?:string}}){
  const clips=registry.clips as Record<string,{maxMs:number}>;
  if(searchParams.pack!=='roles')return <FlowKit items={olympus.map(({installed,...item})=>({...item,...(clips[item.id]?{installed:{preview:`/ui/arena-lab/fx/previews/${item.id}.mp4`,seconds:clips[item.id].maxMs/1000}}:{})}))} olympus/>;
  return <FlowKit items={[...frames].sort((a,b)=>a.id.localeCompare(b.id)).map(({id,title,duration,videoPrompt})=>({id,title,duration,prompt:videoPrompt,omniPrompt:omni.find(item=>item.id===id)!.prompt,...(clips[id]?{installed:{preview:`/ui/arena-lab/fx/previews/${id}.mp4`,seconds:clips[id].maxMs/1000}}:{})}))}/>;
}
