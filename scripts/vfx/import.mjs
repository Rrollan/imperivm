import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ids=['01-impact','02-builder-heal','03-whale-impact','04-degen-draw','05-validator-gas','06-victory','07-spell-impact','08-spell-buff','09-spell-counter','10-deploy-legionary','11-deploy-guard','12-deploy-commander','13-deploy-minister','14-deploy-priest','15-deploy-engineer','16-edict-weaken','17-edict-heal','18-olympian-lightning','19-diamond-phalanx','20-underworld-rift','21-legendary-descent','22-titan-cleave','23-zeus-apparition','24-athena-apparition','25-hades-apparition','26-firmware-landing','27-hoplite-landing','28-priest-landing','29-commander-landing','30-mosaic-landing','31-meme-landing','32-colossus-landing','33-poseidon-apparition','34-hephaestus-apparition','35-dionysus-apparition','36-relay-impact','37-oracle-impact'];
const [id,sourceArg,startArg='0',endArg]=process.argv.slice(2);
if(!ids.includes(id)||!sourceArg||!endArg)throw new Error('Usage: node scripts/vfx/import.mjs <id> <original.mp4> <startSeconds> <endSeconds>');
const source=resolve(sourceArg),start=Number(startArg),end=Number(endArg),duration=end-start;
if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||duration<.2||duration>(id==='06-victory'?2:Number(id.slice(0,2))>=21?1.6:1))throw new Error('Choose a finite, short active range: combat 0.2–1s; legendary 21–37 ≤ 1.6s; victory ≤ 2s.');
if(id!=='06-victory'){
  process.argv=[...process.argv.slice(0,2),id,sourceArg,String(start),String(duration)];
  await import('./atlas.mjs');
} else {
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',maxBuffer:1024*1024}));
const original=probe(source),stream=original.streams.find(s=>s.codec_type==='video');
if(!stream||end>Number(original.format.duration)+.05)throw new Error('Range exceeds the source video.');
if(Math.abs(stream.width/stream.height-16/9)>.03)throw new Error('Expected a landscape 16:9 source.');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),out=resolve(root,'public/ui/arena-lab/fx');
await mkdir(out,{recursive:true});const temp=resolve(out,`${id}.importing.mp4`),target=resolve(out,`${id}.mp4`);
if(source===target||source===temp)throw new Error('Keep the original outside the output directory.');
// A short black fade prevents a hard cut when Flow leaves sparks past the requested beat.
const fade=Math.min(.2,duration/4);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(start),'-i',source,'-t',String(duration),'-map','0:v:0','-an','-vf',`scale=960:540:flags=lanczos,fps=30,fade=t=out:st=${duration-fade}:d=${fade}`,'-c:v','libx264','-preset','slow','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',temp],{stdio:'inherit'});
const final=probe(temp),video=final.streams.find(s=>s.codec_type==='video'),size=(await stat(temp)).size;
if(final.streams.some(s=>s.codec_type==='audio')||video.codec_name!=='h264'||video.pix_fmt!=='yuv420p'||size>(id==='06-victory'?3_000_000:1_500_000))throw new Error('Output failed codec/audio/size budget; original preserved.');
await rename(temp,target);
const registryPath=resolve(out,'manifest.json'),registry=JSON.parse(await readFile(registryPath,'utf8'));
registry.clips[id]={src:`/ui/arena-lab/fx/${id}.mp4`,maxMs:Math.round(Number(final.format.duration)*1000),bytes:size,sourceRange:[start,end]};
await writeFile(`${registryPath}.tmp`,`${JSON.stringify(registry,null,2)}\n`);await rename(`${registryPath}.tmp`,registryPath);
console.log(`Imported ${id}: ${video.width}×${video.height}, ${final.format.duration}s, ${size} bytes. Original untouched. Visually verify background, timing and orientation in the arena before shipping.`);
}
