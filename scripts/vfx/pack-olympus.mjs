import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const sharp=createRequire(new URL('../tripo/package.json',import.meta.url))('sharp');
const root=resolve(new URL('../..',import.meta.url).pathname),out=resolve(root,'public/ui/arena-lab/olympus-kit'),docs=resolve(root,'docs/olympus-vfx');
const generated='/Users/a11111/.codex/generated_images/01a10813-1873-74c2-a5e1-250044ecd604';
const specs=[
 ['18-olympian-lightning','Молния Олимпа','exec-8eb0d318-09cb-4edb-85bd-70e80e4fda3d.png',.7,'A cyan lightning spear fractures outward in three readable forks. A single white-gold contact flash at 0.12s, a turquoise shock ring at 0.2s, then energy retracts. Zeus lightning, precise and powerful.'],
 ['19-diamond-phalanx','Алмазная фаланга','exec-deadd0e9-e806-42ea-b036-6d4206a09866.png',.7,'A faceted turquoise diamond shield materializes with one gold rim flash, expands a protective teal wave, then dissolves into six broad diamond fragments. Protection, not damage.'],
 ['20-underworld-rift','Разлом Аида','exec-f7ba6674-34c8-4165-ad15-98555a23e0fb.png',.75,'A violet underworld rift opens, pulls three emerald coins into its dark center, then closes with a thin purple shock ring. One readable implosion, no explosion of debris.'],
 ['21-legendary-descent','Печать легенды','exec-f3883caa-70d7-4432-83a9-deae25082cf6.png',1.2,'A gold summoning seal expands in perspective. Three teal rays rise from it, one broad gold halo peaks at 0.35s, then the rays sink and the seal dissolves. No character in this clip.'],
 ['22-titan-cleave','Рассечение титана','exec-a56278ef-9266-417d-93cb-37ddb6dfa651.png',.65,'A single broad white-gold blade crescent sweeps diagonally once. Impact at 0.15s creates six amber sparks and a brief gold contact ring. Fade the trail immediately after the strike.'],
 ['23-zeus-apparition','Выход Зевса','exec-3a43d99d-c651-4e7c-8568-bc6ad377ccd8.png',1.55,'Preserve Zeus face, silver hair, violet cloak, gold armor and cyan spear from Image1. At 0.0s the figure is already readable, at 0.2s lift him slightly with a brief teal-gold silhouette glow. He lowers the spear once, cloak follows with restrained motion. Hold the readable full figure to 0.8s, then dissolve feet to head into cyan light by 1.55s. No locomotion, no new camera angle.'],
 ['24-athena-apparition','Выход Афины','exec-13ed74c4-0e44-4f75-b8be-a751a330345c.png',1.55,'Preserve Athena face, owl helmet, ivory cloth, teal cape, gold spear and diamond shield from Image1. She raises her shield slightly once, a broad teal shield pulse peaks at 0.35s. Hold a proud readable stance to 0.8s; dissolve into six broad diamond facets from 0.9s to 1.55s. Keep limbs, identity and props stable.'],
 ['25-hades-apparition','Выход Аида','exec-00f10d33-db35-45a1-87ec-69ea1ac1adb8.png',1.55,'Preserve Hades face, dark hair, purple-black robes, gold armor and burgundy rug from Image1. He gives the rug one small theatrical pull, emerald coins briefly fall into a violet rift at his feet. Hold the recognizable figure to 0.8s, then dissolve into violet shadow by 1.55s. No camera movement, no extra limbs or character redesign.'],
];
await mkdir(out,{recursive:true});await mkdir(docs,{recursive:true});
const items=[];
for(const [id,title,file,activeSeconds,choreography] of specs){
 const number=id.slice(0,2),input=resolve(generated,file),buf=await readFile(input);
 await sharp(buf).resize(1280,720,{fit:'contain',background:'#000000'}).png().toFile(resolve(out,`${number}-START.png`));
 await sharp(resolve(out,`${number}-START.png`)).webp({quality:85}).toFile(resolve(out,`${id}.webp`));
 await copyFile(resolve(root,'docs/flow-vfx/frames/black-end.png'),resolve(out,`${number}-END.png`));
 const prompt=`IMPERIVM game VFX, Image1 to Image2, 16:9, 1280x720, 4 seconds.\nImage1 is the authored START. Image2 is an entirely black END.\n${choreography}\nThe complete active animation MUST finish by ${activeSeconds} seconds. From ${activeSeconds} seconds to the final frame: perfectly flat black #000000, with no residual particles or glow. Fixed camera, fixed framing, no zoom, no pan, no crop. Keep the whole effect within the image bounds. Pure black background throughout; no floor, environment, shadows, UI, text, logo or watermark. Broad readable shapes, limited particles, simplified stylized 3D materials. No sound; the game adds synchronized audio. Do not render a game board or cards.\nReturn the file as ${id}.mp4.\n`;
 await writeFile(resolve(out,`${number}-PROMPT.txt`),prompt);
 items.push({id,title,duration:4,activeSeconds,prompt,omniPrompt:prompt,sourceImage:file,sha256:createHash('sha256').update(buf).digest('hex'),generator:'Built-in image_gen, 2026-10-07',installed:false});
}
const instructions=`# IMPERIVM / Olympus 18–25\n\n8 новых роликов. Они ещё НЕ подключены: сейчас игра использует процедурные эффекты и объёмное появление карты.\n\nOmni Flash: 16:9, 720p, 4 секунды. Для каждого номера прикрепите ровно две картинки: NN-START.png как Image1 и NN-END.png как Image2. Вставьте весь NN-PROMPT.txt. Камера неподвижна, фон чёрный; звук добавляет игра. Первые 0.65–1.55 с — действие, затем чистый чёрный кадр. Не растягивайте действие на все 4 секунды.\n\n18 — Зевс/молния; 19 — Афина/защита; 20 — Аид/разлом; 21 — печать выхода дорогой карты; 22 — тяжёлое рассечение; 23–25 — короткие появления персонажей.\n\nСохраните восемь результатов под именами из PROMPT и пришлите одним ZIP. Не запекайте в ролики поле, интерфейс, цифры и сами карточки.\n\nИмпорт после визуальной проверки: node scripts/vfx/atlas.mjs ID /absolute/path/ID.mp4 0 ACTIVE_SECONDS. Скрипт сохраняет атлас и manifest. Для 23–25 допустимо до 1.6 с, для обычного удара — до 1 с. Нельзя ускорять 4-секундное действие целиком: нарушается читаемость.\n`;
await writeFile(resolve(out,'00-START-HERE.md'),instructions);await writeFile(resolve(docs,'00-START-HERE.md'),instructions);
await writeFile(resolve(docs,'manifest.json'),JSON.stringify(items,null,2)+'\n');
await writeFile(resolve(out,'MANIFEST.json'),JSON.stringify(items.map(({sourceImage,sha256,generator,...item})=>item),null,2)+'\n');
const staging=resolve(root,'verification/olympus-20261007/zip');await mkdir(staging,{recursive:true});
for(const item of items){const dir=resolve(staging,item.id),n=item.id.slice(0,2);await mkdir(dir,{recursive:true});for(const suffix of ['START.png','END.png','PROMPT.txt'])await copyFile(resolve(out,`${n}-${suffix}`),resolve(dir,`${n}-${suffix}`));}
await copyFile(resolve(out,'00-START-HERE.md'),resolve(staging,'00-START-HERE.md'));
const zip=resolve(root,'public/ui/arena-lab/imperivm-omni-olympus-18-25.zip');
execFileSync('zip',['-q','-r','-FS',zip,...items.map(i=>i.id),'00-START-HERE.md'],{cwd:staging});
console.log(`Prepared ${items.length} START/END/PROMPT folders: ${zip}`);
