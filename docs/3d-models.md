# Local 3D coins

The first available asset is the supplied Whale bas relief. Its original GLB remains at `/Users/a11111/Downloads/обьекты/кит.glb`; the application ships a mobile sized derivative at `/models/hero-whale.glb`.

| Asset | File bytes | Vertices | Triangles | Textures |
| --- | ---: | ---: | ---: | --- |
| Supplied Whale | 30,255,308 | 875,543 | 1,693,366 | Three 4096 × 4096 textures |
| Application Whale | 2,832,516 | 72,659 | 118,534 | Three 1024 × 1024 textures |

The original and derivative use one mesh and one PBR material, with color, normal and metallic/roughness textures. Both use `EXT_meshopt_compression` and `KHR_mesh_quantization`. The source dimensions are approximately 0.195 × 0.995 × 0.998; its face lies in the YZ plane. The manifest rotates it by −π/2 about Y, and the renderer centers and scales the loaded bounds.

The transparent 600 × 600 fallback `/models/hero-whale.webp` is a local WebGL rendering of this same derivative. It keeps the supplied coin visible during loading, when WebGL2 is unavailable, when loading/rendering fails, or after a lost WebGL context.

## Integration

Import the lightweight entry point from a client route:

```tsx
import { Whale3D, VictoryCoin, CoinPreview } from '@/components/3d/CoinPreview';

<Whale3D size={160} speed={0.18} label="Золотая монета Кита" />
<Whale3D size={58} autoRotate={false} label="Золотая монета Кита" />
<VictoryCoin size={156} label={t('Монета победы', 'Victory coin')} />
```

`size` accepts pixels or a CSS size; `speed` is radians per second; `autoRotate` defaults to true. All exports also accept `className`, `label` and `fallbackSrc`. `CoinPreview` and `VictoryCoin` accept a typed `model` key. VictoryCoin currently defaults to the confirmed Whale coin.

The entry point uses `next/dynamic` with `ssr: false` to import `Coin3D.tsx` after a preview approaches the viewport. Routes that do not import the entry point do not load the renderer. Static, hidden, off screen and reduced motion previews use the demand frame loop. Rotating previews use DPR 1–1.5. The scene has no controls, post processing or shadow passes.

Lighting is a single frame local `Environment` with procedural `Lightformer` panels and warm direct lights. There is no HDR preset, remote asset or CDN decoder. `useGLTF(path, false, true)` disables Draco and enables the locally bundled Meshopt decoder.

## Future assets

`modelManifest.ts` reserves `hero-builder`, `hero-degen`, `hero-validator`, `coin-rug`, `trophy` and `chest`. They have `available: false`, so their GLB paths are never requested. Add the real file, inspect its bounds, update its rotation/fallback and only then set `available: true`.

## Reproducing the delivery model

```sh
npx --yes @gltf-transform/cli@4.3.0 optimize \
  '/Users/a11111/Downloads/обьекты/кит.glb' public/models/hero-whale.glb \
  --compress meshopt --simplify-ratio 0.07 --simplify-error 0.001 \
  --texture-size 1024 --texture-compress auto
```

The pinned runtime packages are React Three Fiber 8.18.0, Drei 9.122.0 and Three 0.170.0, paired with the existing React 18. Three 0.170 requires WebGL2.

## Review

The supplied GLB header/JSON and the derivative were inspected locally, and the derivative was rendered in a separate local browser preview to confirm the visible Whale face and texture quality. The fallback was rendered and visually inspected. Production route layout, real mobile GPU performance and injected WebGL context loss require review in the final application build.

References: [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [Drei useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf), [Drei Environment](https://drei.docs.pmnd.rs/staging/environment), [glTF Transform CLI](https://gltf-transform.dev/cli).
