import {execFileSync} from 'node:child_process';
import {readFile,writeFile,stat,mkdtemp,rename,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

// Previews are already trimmed/retimed. Do not apply their source ranges twice.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'public/ui/arena-lab/fx');
const registryPath=resolve(out,'manifest.json');
const registry=JSON.parse(await readFile(registryPath,'utf8'));
const sharp=createRequire(new URL('../tripo/package.json',import.meta.url))('sharp');
const ids=['26-firmware-landing','27-hoplite-landing','28-priest-landing','29-commander-landing','30-mosaic-landing','31-meme-landing','32-colossus-landing'];
const requested=process.argv.slice(2);
if(requested.some(id=>!ids.includes(id)))throw new Error('Expected landing IDs 26–32, or no arguments to rebuild all seven.');
const frameWidth=384,frameHeight=216,budget=300000;
const temp=await mkdtemp(resolve(tmpdir(),'imperivm-landings-'));
try{
  for(const id of requested.length?requested:ids){
    const clip=registry.clips[id],source=resolve(out,'previews',`${id}.mp4`),png=resolve(temp,`${id}.png`),encoded=resolve(temp,`${id}.webp`);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-an','-vf',`fps=${clip.fps},scale=${frameWidth}:${frameHeight}:flags=lanczos,tile=${clip.columns}x${clip.rows}`,'-frames:v','1',png],{stdio:'inherit'});
    let bytes=0,quality=92;
    for(;quality>=70;quality-=4){
      await sharp(png).webp({quality}).toFile(encoded);bytes=(await stat(encoded)).size;
      if(bytes<=budget)break;
    }
    if(bytes>budget)throw new Error(`${id} exceeds the 300 KB budget.`);
    // Write beside the target before rename: the temporary directory can be on another volume.
    const next=resolve(out,`${id}.atlas.importing.webp`);
    await writeFile(next,await readFile(encoded));await rename(next,resolve(out,`${id}.atlas.webp`));
    registry.clips[id]={...clip,frameWidth,frameHeight,bytes,composite:'black-key'};
    console.log(`${id}: ${frameWidth}×${frameHeight}/frame, ${bytes} bytes, quality ${quality}`);
  }
  registry.composite='black-key-premultiplied';
  await writeFile(registryPath,`${JSON.stringify(registry,null,2)}\n`);
}finally{await rm(temp,{recursive:true,force:true});}
