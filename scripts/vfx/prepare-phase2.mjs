// Technical export only: preserve generated artwork and convert it to delivery sizes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(new URL('../tripo/package.json',import.meta.url))('sharp');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/vfx/prepare-phase2.mjs <generated-sources.json>');
const {frames,cards}=JSON.parse(await readFile(input,'utf8'));
const source=resolve(root,'docs/flow-vfx'),preview=resolve(root,'public/ui/arena-lab/flow-kit');
await mkdir(resolve(source,'prompts'),{recursive:true});await mkdir(preview,{recursive:true});
for(const frame of frames){
  const target=resolve(source,frame.firstFrame);
  await sharp(frame.source).resize(1280,720,{fit:'contain',background:'#000000'}).png().toFile(target);
  await sharp(target).resize(640,360).webp({quality:88}).toFile(resolve(preview,`${frame.id}.webp`));
  await writeFile(resolve(source,`prompts/${frame.id}-v3.txt`),`${frame.videoPrompt}\n`);
}
await writeFile(resolve(source,'frames-phase2.json'),`${JSON.stringify(frames,null,2)}\n`);
for(const card of cards)await sharp(card.source).resize(512,768,{fit:'contain',background:'#30241b'}).webp({quality:89}).toFile(resolve(root,`public/cards/${card.id}.webp`));
await writeFile(resolve(root,'docs/new-edicts-art.json'),`${JSON.stringify(cards,null,2)}\n`);
const cells=await Promise.all(frames.map(async(frame,index)=>({input:await sharp(resolve(source,frame.firstFrame)).resize(320,180).toBuffer(),left:(index%2)*320,top:Math.floor(index/2)*180})));
await sharp({create:{width:640,height:720,channels:3,background:'#000000'}}).composite(cells).png().toFile('/tmp/imperivm-phase2/effects-contact.png');
const art=await Promise.all(cards.map(async(card,index)=>({input:await sharp(resolve(root,`public/cards/${card.id}.webp`)).resize(320,480).toBuffer(),left:index*320,top:0})));
await sharp({create:{width:640,height:480,channels:3,background:'#30241b'}}).composite(art).png().toFile('/tmp/imperivm-phase2/cards-contact.png');
console.log('Exported eight 1280×720 START frames, previews, exact prompts and two card artworks.');
