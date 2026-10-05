import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { getBounds } from '@gltf-transform/functions';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(await readFile(resolve(root,'public/arena-assets/manifest.json'),'utf8'));
assert.equal(manifest.models.length,21); assert.equal(new Set(manifest.models.map(m=>m.id)).size,21);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for (const model of manifest.models) {
  const bytes = await readFile(resolve(root,`public${model.file}`));
  assert.equal(bytes.byteLength,model.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);
  const doc = await io.readBinary(bytes);
  const primitives = doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
  const triangles = primitives.reduce((n,p)=>n+p.getIndices().getCount()/3,0);
  assert.equal(triangles,model.triangles); assert(triangles < model.sourceTriangles,`${model.id}: no geometric reduction`);
  assert(doc.getRoot().listTextures().every(t=>t.getMimeType()==='image/webp' && t.getSize().every(size=>size<=model.textureSize)),`${model.id}: unbounded texture`);
  assert(primitives.every(p=>p.getAttribute('POSITION').getArray().every(Number.isFinite)),`${model.id}: invalid position`);
  const bounds = getBounds(doc.getRoot().listScenes()[0]);
  for (let axis=0;axis<3;axis++) {
    const extent = bounds.max[axis]-bounds.min[axis];
    const sourceExtent = model.sourceBounds.max[axis]-model.sourceBounds.min[axis];
    assert(extent>sourceExtent*.75 && extent<sourceExtent*1.1,`${model.id}: bounds changed unexpectedly`);
  }
}
const model = id=>manifest.models.find(m=>m.id===id);
assert(model('gas-crystal-small').triangles<=2000); assert(model('hero-frame').triangles<=14000); assert(model('roman-table').triangles<=26000);
const total=manifest.models.reduce((n,m)=>n+m.bytes,0); assert(total<7_000_000);
const decoder=await readFile(resolve(root,'public/arena-assets/vendor/meshopt_decoder.js'),'utf8'); assert(decoder.includes('decodeGltfBufferAsync'));
console.log(`MODELS OK: all 21 GLBs decode, hashes/materials/bounds verified; ${(total/1e6).toFixed(2)} MB total.`);
