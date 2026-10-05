import type { Metadata } from 'next';
import frames from '../../../docs/flow-vfx/frames-phase2.json';
import FlowKit from '../../../components/presentation/FlowKit';

export const metadata:Metadata={title:'Эффекты для Flow — IMPERIVM'};
export default function Page(){return <FlowKit items={[...frames].sort((a,b)=>a.id.localeCompare(b.id)).map(({id,title,duration,videoPrompt})=>({id,title,duration,prompt:videoPrompt}))}/>;}
