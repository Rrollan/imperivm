import type { Metadata } from 'next';
import frames from '../../../docs/flow-vfx/frames-phase2.json';
import omni from '../../../docs/omni-vfx/manifest.json';
import FlowKit from '../../../components/presentation/FlowKit';

export const metadata:Metadata={title:'Анимации для Omni Flash — IMPERIVM'};
export default function Page(){return <FlowKit items={[...frames].sort((a,b)=>a.id.localeCompare(b.id)).map(({id,title,duration,videoPrompt})=>({id,title,duration,prompt:videoPrompt,omniPrompt:omni.find(item=>item.id===id)!.prompt}))}/>;}
