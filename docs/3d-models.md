# Local 3D accents

The first available asset is the supplied Whale bas relief. Its original GLB remains at `/Users/a11111/Downloads/обьекты/кит.glb`; the application ships a mobile sized derivative at `/models/hero-whale.glb`.

| Asset | File bytes | Vertices | Triangles | Textures |
| --- | ---: | ---: | ---: | --- |
| Supplied Whale | 30,255,308 | 875,543 | 1,693,366 | Three 4096 × 4096 textures |
| Application Whale | 2,832,516 | 72,659 | 118,534 | Three 1024 × 1024 textures |

The original and derivative use one mesh and one PBR material, with color, normal and metallic/roughness textures. Both use `EXT_meshopt_compression` and `KHR_mesh_quantization`. The source dimensions are approximately 0.195 × 0.995 × 0.998; its face lies in the YZ plane. The manifest rotates it by −π/2 about Y, and the renderer centers and scales the loaded bounds.

The transparent 600 × 600 fallback `/models/hero-whale.webp` is a local WebGL rendering of this same derivative. It keeps the supplied coin visible during loading, when WebGL2 is unavailable, when loading/rendering fails, or after a lost WebGL context.

The eight additional optimized models are now supplied and discovered automatically:

| Model | Bytes | Vertices | Triangles |
| --- | ---: | ---: | ---: |
| hero-builder | 831,808 | 41,586 | 68,330 |
| hero-degen | 983,364 | 47,142 | 78,642 |
| hero-validator | 955,592 | 45,485 | 76,116 |
| coin-rug | 779,880 | 48,452 | 76,336 |
| trophy | 819,260 | 48,400 | 75,303 |
| chest | 875,128 | 55,080 | 76,226 |
| column | 1,130,148 | 87,625 | 77,042 |
| bust | 764,400 | 47,728 | 76,504 |

These use local Meshopt compression, mesh quantization and embedded WebP textures. Their dominant faces lie in XY, so the default rotation is correct; the Whale retains its special Y rotation. Runtime discovery's file trace includes `public/models/**/*` for server deployments. Only the clicked corner mounts WebGL; switching corners releases that preview. Both heroes and the power coin remain small DOM-embedded accents.

## Integration

Import the lightweight entry point from a client route:

```tsx
import { Whale3D, VictoryCoin, CoinPreview } from '@/components/3d/CoinPreview';

<Whale3D size={160} speed={0.18} label="Золотая монета Кита" />
<Whale3D size={58} autoRotate={false} label="Золотая монета Кита" />
<VictoryCoin size={156} label={t('Монета победы', 'Victory coin')} />
```

`size` accepts pixels or a CSS size; `speed` is radians per second; `autoRotate` defaults to true. All exports also accept `className`, `label` and `fallbackSrc`. `CoinPreview` and `VictoryCoin` accept a typed `model` key. VictoryCoin defaults to the trophy accent, with an original illustrated fallback until the trophy GLB arrives.

The entry point uses `next/dynamic` with `ssr: false` to import `Coin3D.tsx` after a preview approaches the viewport. Routes that do not import the entry point do not load the renderer. Static, hidden, off screen and reduced motion previews use the demand frame loop. Rotating previews use DPR 1–1.5. The scene has no controls, post processing or shadow passes.

Lighting is a single frame local `Environment` with procedural `Lightformer` panels and warm direct lights. There is no HDR preset, remote asset or CDN decoder. `useGLTF(path, false, true)` disables Draco and enables the locally bundled Meshopt decoder.

## Available assets and discovery

`modelManifest.ts` defines a fixed allowlist: `hero-whale`, `hero-builder`, `hero-degen`, `hero-validator`, `coin-rug`, `trophy`, `chest`, `column`, `bust`, `brazier`, `gas-crystal`, `treasury`, `scales`, `aquila`, `dice`, `laurel-wreath`, `water-clock`. The server route `/api/models` discovers local files at runtime. Drop `<name>.glb` and optionally `<name>.webp` or `<name>.png` into `public/models/`; no availability flag needs editing. Missing GLBs are never requested; unavailable discovery, loading failures and WebGL errors preserve the 2D fallback. The allowlist accepts no browser filesystem paths.

Hero artwork is the final fallback for heroes. Other accents use original PNG illustrations in `public/ornaments/` (editable SVG sources are retained). Supplied WebP/PNG posters take precedence. Each model is centered and normalized automatically; if a supplied object faces another axis, adjust its manifest rotation. Serve the public directory alongside the application (including when using a standalone deployment).

## Reproducing the delivery model

```sh
npx --yes @gltf-transform/cli@4.3.0 optimize \
  '/Users/a11111/Downloads/обьекты/кит.glb' public/models/hero-whale.glb \
  --compress meshopt --simplify-ratio 0.07 --simplify-error 0.001 \
  --texture-size 1024 --texture-compress auto
```

The pinned runtime packages are React Three Fiber 8.18.0, Drei 9.122.0 and Three 0.170.0, paired with the existing React 18. Three 0.170 requires WebGL2.

## Review

The supplied GLB header/JSON and the derivative were inspected locally, and the derivative was rendered in a separate local browser preview to confirm the visible Whale face and texture quality. The fallback was rendered and visually inspected. The UI rebuild was exercised in the production application at 1440 × 900 and 390 × 844. All three new hero GLBs, the chest, column, bust and $RUG coin rendered in local Chromium. Injected WebGL context loss restored the 2D poster. Physical mobile GPU performance remains a device acceptance check.

References: [React Three Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [Drei useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf), [Drei Environment](https://drei.docs.pmnd.rs/staging/environment), [glTF Transform CLI](https://gltf-transform.dev/cli).
