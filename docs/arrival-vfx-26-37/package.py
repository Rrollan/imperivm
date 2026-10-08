"""Format generated assets and package the generation brief; no image painting."""
from pathlib import Path
import hashlib
import html
import json
import zipfile
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
DOC = Path(__file__).resolve().parent
OUT = ROOT / 'public/ui/arena-lab/imperivm-arrival-vfx-26-37'
jobs = json.loads((DOC / 'jobs.json').read_text())
ledger = json.loads((DOC / 'generation-ledger.json').read_text())
assert len(jobs) == len(ledger) == 12, 'Finish all twelve individual generations first'
OUT.mkdir(parents=True, exist_ok=True)
for job, record in zip(jobs, ledger):
    assert job['id'] == record['id']
    folder = OUT / job['id']
    folder.mkdir(exist_ok=True)
    number = str(job['n'])
    for legacy in ['START.png', 'END.png', 'PROMPT.txt']:
        (folder / legacy).unlink(missing_ok=True)
    master = DOC / record.get('master', 'originals/' + job['id'] + '-START.png')
    with Image.open(master) as image:
        image = ImageOps.pad(image.convert('RGB'), (1280, 720), color='black', method=Image.Resampling.LANCZOS)
        image.save(folder / (number + '-START.png'), optimize=True)
    Image.new('RGB', (1280, 720), 'black').save(folder / (number + '-END.png'), optimize=True)
    prompt = (
        f'IMPERIVM isolated game VFX. Image1={number}-START.png, Image2={number}-END.png. '
        '16:9, 1280x720, 4 seconds, one output.\n'
        + job['motion'] + '\n'
        + f"From {job['active']:.2f}s until 4.00s every pixel must be flat pure black #000000, no residual glow or particles. "
        + 'Fixed framing and camera throughout; no zoom, pan, crop or reframing. '
        + 'Preserve the reference proportions and empty margins. '
        + 'Pure black background, no scenery, floor texture, card, frame, UI, lettering, numbers, logo or watermark. '
        + 'No audio; the game adds synchronized sound. Simplified premium Greco-Roman crypto fantasy materials, broad readable shapes.\n'
        + 'Return the MP4 as ' + job['id'] + '.mp4.\n'
    )
    (folder / (number + '-PROMPT.txt')).write_text(prompt)
    job['prompt'] = prompt
    job['installed'] = False
    job['pivot'] = {'x': .5, 'y': .8 if job['kind'] == 'apparition' else .5}
    job['plane'] = 'standing-billboard' if job['kind'] == 'apparition' else 'board-xy'
    job['sha256'] = hashlib.sha256((folder / (number + '-START.png')).read_bytes()).hexdigest()
    record['masterSha256'] = hashlib.sha256(master.read_bytes()).hexdigest()
    record['master'] = 'originals/' + master.name
    if job.get('reference'):
        art = next((ROOT / 'public/ui/arena-lab/character-art-50/art').glob(f"{job['reference']:02d}-*.webp"))
        (folder / 'CHARACTER-REFERENCE.webp').write_bytes(art.read_bytes())
readme = (DOC / '00-START-HERE.md').read_text()
(OUT / '00-START-HERE.txt').write_text(readme)
(OUT / 'manifest.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
(DOC / 'generation-ledger.json').write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
for label, batch in [('A', jobs[:6]), ('B', jobs[6:])]:
    text = ('Generate exactly six separate IMPERIVM VFX videos using the supplied numbered folders. '
            'One clip per job, 16:9, 720p, 4 seconds, one variant. For job NN, use its unique NN-START.png as Image1 and NN-END.png as Image2. '
            'Do not combine clips or redesign the framing.\n\n')
    for job in batch:
        text += f"JOB {job['id']} — {job['title']} / {job['n']}-START.png + {job['n']}-END.png\n" + job['prompt'] + '\n'
    text += 'Return all six MP4 files with the exact requested filenames.\n'
    (OUT / f'AGENT-BATCH-{label}.txt').write_text(text)
cards = []
for job in jobs:
    title, hook = html.escape(job['title']), html.escape(job['hook'])
    cards.append(f'''<article><a href="{job['id']}/{job['n']}-START.png"><img src="{job['id']}/{job['n']}-START.png" alt="{title}" loading="lazy"></a><div class="copy"><small>{job['id']} · {job['active']:.2f} с · видео ещё не подключено</small><h2>{title}</h2><p>{hook}</p><nav><a href="{job['id']}/{job['n']}-START.png" download>START</a><a href="{job['id']}/{job['n']}-END.png" download>END</a><a href="{job['id']}/{job['n']}-PROMPT.txt" download>PROMPT</a></nav></div></article>''')
page = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IMPERIVM — анимации 26–37</title><style>
*{box-sizing:border-box}body{margin:0;background:#171d19;color:#eee7d2;font:17px/1.55 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:36px 24px}header{max-width:920px;margin-bottom:30px}h1{font:600 clamp(30px,5vw,52px)/1.1 Georgia,serif;margin:12px 0}h2{font:600 24px/1.2 Georgia,serif;margin:10px 0}p{color:#cdd1c5}small{color:#b9c0af}nav{display:flex;flex-wrap:wrap;gap:10px}a{color:#f1d394;text-underline-offset:3px}nav a,.zip{display:inline-block;background:#cfb273;color:#19221a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:650;min-height:44px}.zip{margin:12px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:22px}article{background:#252c24;border:1px solid #455044;border-radius:14px;overflow:hidden}article img{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#000}.copy{padding:20px}@media(max-width:500px){main{padding:24px 16px}.copy{padding:16px}}
</style><main><header><small>IMPERIVM / ПОЯВЛЕНИЕ · КОНТАКТ · ПОПАДАНИЕ</small><h1>12 новых анимаций</h1><p>Семь приземлений, три появления персонажей и два попадания. Готовые кадры и промпты; видео сгенерируйте в Omni Flash.</p><a class="zip" href="imperivm-arrival-vfx-26-37.zip" download>Скачать весь пак</a><p><strong>16:9 · 720p · 4 секунды · 1 результат.</strong><br>Прикрепите START и END одного номера, вставьте его PROMPT. Сначала 26, 32 и 36.</p><p>Контакт расходится по плоскости карты. У стоящих персонажей стопы закреплены на одной точке. Посейдон, Гефест и Дионис — арт для будущего расширения, способности ещё не реализованы.</p><nav><a href="AGENT-BATCH-A.txt">Агент: 26–31</a><a href="AGENT-BATCH-B.txt">Агент: 32–37</a><a href="00-START-HERE.txt">Инструкция</a></nav></header><div class="grid">''' + ''.join(cards) + '</div></main></html>'
(OUT / 'index.html').write_text(page)
archive = OUT / 'imperivm-arrival-vfx-26-37.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for file in sorted(OUT.rglob('*')):
        if file.is_file() and file != archive:
            package.write(file, file.relative_to(OUT))
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert sum(name.endswith('-START.png') for name in package.namelist()) == 12
    assert sum(name.endswith('-END.png') for name in package.namelist()) == 12
    assert sum(name.endswith('-PROMPT.txt') for name in package.namelist()) == 12
print(json.dumps({'jobs': len(jobs), 'bytes': archive.stat().st_size, 'archive': str(archive)}, ensure_ascii=False))
