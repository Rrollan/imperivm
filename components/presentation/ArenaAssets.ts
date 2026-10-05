import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer, InstantiatedEntries } from '@babylonjs/core/assetContainer';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

import type { ModelId } from './assetCatalog';
export type { ModelId } from './assetCatalog';
export type ModelFit = { width?: number; height?: number; depth?: number; yaw?: number; pitch?: number; stretch?: boolean; shadows?: boolean };
export type ModelHandle = { root: TransformNode; dispose: () => void };

// Both the WASM decoder and the GLBs are served by this application, with no CDN dependency.
MeshoptCompression.Configuration = { decoder: { url: '/arena-assets/vendor/meshopt_decoder.js' } };
let loader: Promise<unknown> | undefined;

/** One container per asset per scene; repeated objects share geometry, materials and textures. */
export class ArenaAssets {
  private cache = new Map<ModelId, Promise<AssetContainer>>();
  private live = new Set<ModelHandle>();
  private disposed = false;
  loaded = new Set<ModelId>();
  failed = new Set<ModelId>();
  constructor(private scene: Scene, private shadows: ShadowGenerator | null, private invalidate: () => void) {}

  private container(id: ModelId) {
    const known = this.cache.get(id); if (known) return known;
    const promise = (async () => {
      loader ??= import('@babylonjs/loaders/glTF'); await loader;
      if (this.disposed) throw new Error('Scene disposed');
      const container = await LoadAssetContainerAsync(`/arena-assets/models/${id}.glb`, this.scene);
      if (this.disposed) { container.dispose(); throw new Error('Scene disposed'); }
      container.materials.forEach((material, index) => {
        // The glTF loader imports the pure PBR implementation in a separate chunk.
        // Identify its public material contract across that module boundary.
        if (material.getClassName() === 'PBRMaterial') {
          const pbr = material as PBRMaterial;
          // These exports contain painted albedo, including their material colour and shading.
          // A metallic PBR shader without an environment map turns that painting grey.
          const painted = new StandardMaterial(`${id}:painted:${index}`, this.scene);
          painted.diffuseTexture = pbr.albedoTexture;
          painted.diffuseColor = Color3.Black();
          painted.emissiveTexture = pbr.albedoTexture;
          if(id.startsWith('hero-')&&painted.emissiveTexture)painted.emissiveTexture.level=1.12;
          painted.emissiveColor = Color3.Black();
          painted.disableLighting = true;
          painted.useEmissiveAsIllumination = true;
          painted.specularColor = new Color3(.07, .06, .04);
          painted.specularPower = 48;
          painted.backFaceCulling = material.backFaceCulling;
          painted.freeze();
          container.meshes.forEach(mesh => { if (mesh.material === material) mesh.material = painted; });
          container.materials[index] = painted;
          // Textures remain owned by the asset container and shared by its instances.
          material.dispose(false, false);
        }
      });
      this.loaded.add(id); this.invalidate(); return container;
    })();
    this.cache.set(id, promise); return promise;
  }

  async attach(id: ModelId, parent: TransformNode, fit: ModelFit, metadata?: unknown): Promise<ModelHandle | null> {
    let entries: InstantiatedEntries | undefined;
    try {
      const container = await this.container(id);
      if (this.disposed || parent.isDisposed()) return null;
      entries = container.instantiateModelsToScene(name => `${parent.name}:${name}`, false);
      const root = new TransformNode(`${parent.name}:${id}`, this.scene);
      const orientation = new TransformNode(`${id}:orientation`, this.scene);
      orientation.parent = root;
      const front = id === 'hero-whale' || id === 'end-turn-hourglass' ? Math.PI / 2 : ['hero-builder','hero-degen','hero-validator','hero-frame', 'bust', 'chest', 'water-clock'].includes(id) ? Math.PI : 0;
      orientation.rotation.set(fit.pitch ?? 0, fit.yaw ?? front, 0);
      entries.rootNodes.forEach(node => { node.parent = orientation; node.setEnabled(true); });
      orientation.computeWorldMatrix(true);
      orientation.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      const { min, max } = orientation.getHierarchyBoundingVectors(true);
      const size = max.subtract(min), center = max.add(min).scale(.5);
      orientation.position.copyFrom(center.negate());
      const ratios = new Vector3(fit.width ? fit.width / size.x : Infinity, fit.height ? fit.height / size.y : Infinity, fit.depth ? fit.depth / size.z : Infinity);
      if (fit.stretch) root.scaling.copyFrom(ratios);
      else root.scaling.setAll(Math.min(ratios.x, ratios.y, ratios.z));
      root.parent = parent;
      root.getChildMeshes().forEach(mesh => {
        // Interaction belongs to simple board proxies, never the dense relief geometry.
        mesh.isPickable = false; mesh.metadata = metadata;
        mesh.receiveShadows = true;
        if (fit.shadows !== false) this.shadows?.addShadowCaster(mesh);
      });
      const instance = entries;
      const handle = { root, dispose: () => {
        root.getChildMeshes().forEach(mesh => this.shadows?.removeShadowCaster(mesh));
        instance.dispose(); root.dispose(); this.live.delete(handle);
      } };
      this.live.add(handle); this.invalidate(); return handle;
    } catch (error) {
      entries?.dispose();
      if (!this.disposed && !parent.isDisposed()) { this.failed.add(id); console.warn(`Arena model unavailable: ${id}`, error); this.invalidate(); }
      return null;
    }
  }

  dispose() {
    this.disposed = true;
    this.live.forEach(handle => handle.dispose()); this.live.clear();
    this.cache.forEach(promise => { void promise.then(container => container.dispose()).catch(() => {}); });
    this.cache.clear();
  }
}
