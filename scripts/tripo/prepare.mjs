import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, dedup, flatten, join, weld, simplify, prune, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const source = resolve(process.argv[2] || resolve(root, 'verification/tripo-source'));
const output = resolve(process.argv[3] || resolve(root, 'public/arena-assets/models'));
const profiles = {
  'roman-table': [24000, 768, .006],
  'hero-frame': [12000, 512, .006],
  'hero-builder': [18000, 768, .004], 'hero-degen': [18000, 768, .004],
  'hero-validator': [18000, 768, .004], 'hero-whale': [18000, 768, .004],
  'gas-crystal-small': [1800, 256, .025], 'gas-crystal': [4000, 384, .015],
  'end-turn-hourglass': [8000, 512, .012], 'mempool-scroll': [6000, 512, .012],
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
await mkdir(output, { recursive: true });
const manifest = { version: 1, sourceArchive: 'imperivm-models-full-21.zip', tools: { gltfTransform: '4.5.1', meshoptimizer: '0.25.0', sharp: '0.35.5' }, models: [] };
for (const file of (await readdir(source)).filter(f => f.endsWith('.glb')).sort()) {
  const name = file.slice(0, -4), raw = await readFile(resolve(source, file));
  if (raw.toString('ascii', 0, 4) !== 'glTF') throw new Error(`Invalid GLB: ${file}`);
  const json = JSON.parse(raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)).trim());
  const sourceTriangles = json.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (json.accessors[p.indices ?? p.attributes.POSITION].count / 3), 0), 0);
  const [targetTriangles, textureSize, error] = profiles[name] || [8000, 512, .009];
  const doc = await io.read(resolve(source, file)); doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const sourceBounds = getBounds(doc.getRoot().listScenes()[0]);
  await doc.transform(dequantize(), dedup(), flatten(), join(), weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, targetTriangles / sourceTriangles), error, lockBorder: false }),
    prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [textureSize, textureSize], quality: 86, effort: 65 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const triangles = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const bytes = await io.writeBinary(doc);
  await writeFile(resolve(output, file), bytes);
  manifest.models.push({ id: name, file: `/arena-assets/models/${file}`, sourceBytes: raw.byteLength, bytes: bytes.byteLength,
    sourceTriangles, triangles, targetTriangles, textureSize, error, sourceSha256: hash(raw), sha256: hash(bytes),
    sourceBounds, bounds: getBounds(doc.getRoot().listScenes()[0]),
    animations: doc.getRoot().listAnimations().length, skins: doc.getRoot().listSkins().length,
    textures: doc.getRoot().listTextures().map(t => ({ size: t.getSize(), mimeType: t.getMimeType() })) });
  console.log(`${name}: ${sourceTriangles.toLocaleString()} → ${triangles.toLocaleString()} tris, ${(raw.byteLength/1e6).toFixed(2)} → ${(bytes.byteLength/1e6).toFixed(2)} MB`);
}
if (manifest.models.length !== 21) throw new Error(`Expected the complete 21-model export, received ${manifest.models.length}`);
await writeFile(resolve(output, '../manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const vendor = resolve(output, '../vendor'); await mkdir(vendor, { recursive: true });
await copyFile(resolve(here, 'node_modules/meshoptimizer/meshopt_decoder.js'), resolve(vendor, 'meshopt_decoder.js'));
await copyFile(resolve(here, 'node_modules/meshoptimizer/LICENSE.md'), resolve(vendor, 'meshoptimizer-LICENSE.md'));
console.log(`Prepared ${manifest.models.length} assets; manifest and local decoder written.`);
