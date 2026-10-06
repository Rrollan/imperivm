/** Replay a reviewed VFX import without modifying any original video. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,access,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const directory=process.argv[2];
if(!directory)throw new Error('Usage: node scripts/vfx/import-batch.mjs <directory-of-original-videos> [reviewed-ledger.json]');
const ledger=JSON.parse(await readFile(resolve(root,process.argv[3]??'docs/flow-vfx/imported-20261005.json'),'utf8'));
const inputs=[];
for(const clip of ledger.clips){
  let source=resolve(directory,clip.sourceName);
  try{await access(source);}catch{source=resolve(directory,`${String(clip.sourceIndex).padStart(2,'0')}-source.mp4`);}
  const digest=createHash('sha256').update(await readFile(source)).digest('hex');
  if(digest!==clip.sha256)throw new Error(`Original does not match the reviewed video: ${clip.id}`);
  const [start,end]=clip.sourceRange;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||!Number.isFinite(clip.playbackSeconds)||clip.playbackSeconds<.2)throw new Error(`Invalid reviewed range: ${clip.id}`);
  inputs.push({clip,source});
}
const temporary=await mkdtemp(join(tmpdir(),'imperivm-flow-import-'));
try{
  for(const {clip,source} of inputs){
    const prepared=join(temporary,`${clip.id}.mp4`);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(clip.sourceRange[0]),'-t',String(clip.sourceRange[1]-clip.sourceRange[0]),'-i',source,'-t',String(clip.playbackSeconds),'-an','-vf',clip.preprocess.join(','),'-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',prepared],{stdio:'inherit'});
    execFileSync(process.execPath,[resolve(root,'scripts/vfx/import.mjs'),clip.id,prepared,'0',String(clip.playbackSeconds-.001)],{stdio:'inherit',cwd:root});
  }
}finally{await rm(temporary,{recursive:true,force:true});}
