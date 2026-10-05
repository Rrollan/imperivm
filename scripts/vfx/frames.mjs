import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sharp=createRequire(new URL('../tripo/package.json',import.meta.url))('sharp');
const frames=JSON.parse(await readFile(resolve(root,'docs/flow-vfx/frames.json'),'utf8'));
for(const frame of frames){
  const png=resolve(root,'docs/flow-vfx',frame.firstFrame);
  await sharp(frame.source).resize(1280,720,{fit:'contain',background:'#000000'}).png().toFile(png);
  await sharp(png).resize(640,360).webp({quality:84}).toFile(resolve(root,'public/ui/arena-lab/flow-kit',`${frame.id}.webp`));
}
console.log(`${frames.length} start frames: 1280×720 PNG and 640×360 WebP previews.`);
