import { Suspense } from 'react';
import ArenaGates from '../../components/ArenaGates';
export default function ArenaPage() {
  return <Suspense fallback={<div className="arena-scene" />}><ArenaGates /></Suspense>;
}
