'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import { ACESFilmicToneMapping, Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { MODEL_MANIFEST } from './modelManifest';
import type { ModelKey } from './modelManifest';
import styles from './CoinPreview.module.css';

interface Coin3DProps {
  model?: ModelKey;
  size?: number | string;
  speed?: number;
  autoRotate?: boolean;
  active?: boolean;
  onReady?: () => void;
  onFailure?: () => void;
}

function ContextGuard({ onFailure }: { onFailure?: () => void }) {
  const canvas = useThree(state => state.gl.domElement);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure?.(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [canvas, onFailure]);
  return null;
}

function CoinModel({ model, speed, rotating, onReady }: {
  model: ModelKey; speed: number; rotating: boolean; onReady?: () => void;
}) {
  const manifest = MODEL_MANIFEST[model];
  // Meshopt's decoder is bundled locally by drei/three-stdlib. Draco is explicitly disabled.
  const { scene } = useGLTF(manifest.path, false, true);
  const spinner = useRef<Group>(null);
  const notified = useRef(false);
  const invalidate = useThree(state => state.invalidate);
  const prepared = useMemo(() => {
    const clone = scene.clone(true);
    const materials: MeshStandardMaterial[] = [];
    clone.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const cloneMaterial = (material: MeshStandardMaterial) => {
        const copy = material.clone();
        copy.envMapIntensity = 0.9;
        materials.push(copy);
        return copy;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(material => cloneMaterial(material as MeshStandardMaterial))
        : cloneMaterial(object.material as MeshStandardMaterial);
    });
    const bounds = new Box3().setFromObject(clone);
    const center = bounds.getCenter(new Vector3());
    const dimensions = bounds.getSize(new Vector3());
    clone.position.sub(center);
    return { clone, materials, scale: 1.95 / Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001) };
  }, [scene]);

  useEffect(() => { notified.current = false; invalidate(); }, [prepared, invalidate]);
  useEffect(() => () => prepared.materials.forEach(material => material.dispose()), [prepared]);
  useFrame((_state, delta) => {
    if (spinner.current && rotating) spinner.current.rotation.y += Math.min(delta, 0.05) * speed;
    if (!notified.current) { notified.current = true; onReady?.(); }
  });

  return <group ref={spinner} rotation={[0, 0, -0.035]}>
    <group rotation={manifest.rotation} scale={prepared.scale}>
      <primitive object={prepared.clone} dispose={null} />
    </group>
  </group>;
}

function GoldStudio() {
  return <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[-3, 4, 5]} intensity={2.2} color="#fff3d8" />
    <directionalLight position={[3, -1, 2]} intensity={0.65} color="#d9a851" />
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" position={[-3, 2, 4]} target={[0, 0, 0]} scale={[3, 5, 1]} intensity={2.5} color="#fff4df" />
      <Lightformer form="rect" position={[3, 1, 2]} target={[0, 0, 0]} scale={[2, 4, 1]} intensity={1.5} color="#ffc973" />
      <Lightformer form="ring" position={[0, 3, -3]} target={[0, 0, 0]} scale={4} intensity={2} color="#ecd197" />
    </Environment>
  </>;
}

/** WebGL implementation; use CoinPreview/Whale3D/VictoryCoin as the lazy public entry point. */
export default function Coin3D({
  model = 'hero-whale', size, speed = 0.18, autoRotate = true, active = true, onReady, onFailure,
}: Coin3DProps) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // Three r170 requires WebGL2. Renderer creation errors are caught by PreviewBoundary.
    if (!('WebGL2RenderingContext' in window)) { onFailure?.(); return; }
    setSupported(true);
  }, [onFailure]);
  const rotating = active && autoRotate && Number.isFinite(speed) && speed !== 0;
  if (!supported) return null;

  return <div className={styles.canvas} style={size === undefined ? undefined : { width: size, height: size }} aria-hidden="true">
    <Canvas dpr={[1, 1.5]} frameloop={rotating ? 'always' : 'demand'}
      camera={{ position: [0, 0, 3.6], fov: 35, near: 0.1, far: 20 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
      <ContextGuard onFailure={onFailure} />
      <Suspense fallback={null}>
        <GoldStudio />
        <CoinModel model={model} speed={speed} rotating={rotating} onReady={onReady} />
      </Suspense>
    </Canvas>
  </div>;
}
