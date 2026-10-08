"""Package generated raster masters; only resize, encode and assemble review sheets."""
import hashlib
import html
import json
import math
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'public/ui/arena-lab/character-art-50'
ART = OUT / 'art'
CARDS = json.loads((ROOT / 'docs/art-direction/flow-characters-50-20261007/catalogue.json').read_text())['characters']
assert len(CARDS) == 50 and len({c['id'] for c in CARDS}) == 50
sources = [HERE / 'originals' / f"{i:02d}-{c['id']}.png" for i, c in enumerate(CARDS, 1)]
assert all(p.is_file() for p in sources), 'Generate all 50 masters before packaging'
ART.mkdir(parents=True, exist_ok=True)
manifest = []
for i, (c, source) in enumerate(zip(CARDS, sources), 1):
    with Image.open(source) as original:
        assert original.size == (1024, 1536), f'Unexpected master aspect: {source}'
        image = original.convert('RGB').resize((768, 1152), Image.Resampling.LANCZOS)
        destination = ART / f"{i:02d}-{c['id']}.webp"
        image.save(destination, 'WEBP', quality=88, method=6)
    manifest.append({**c, 'index': i, 'status': 'concept-art', 'art': f'art/{destination.name}', 'width': 768, 'height': 1152, 'bytes': destination.stat().st_size, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})
(OUT / 'catalogue.json').write_text(json.dumps({'version': 1, 'status': 'concept-art-not-playable', 'characters': manifest}, ensure_ascii=False, indent=2) + '\n')

font_path = next((p for p in ['/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if Path(p).is_file()), None)
font = ImageFont.truetype(font_path, 18) if font_path else ImageFont.load_default()
heading = ImageFont.truetype(font_path, 30) if font_path else ImageFont.load_default()
for faction in ['DeFi', 'NFT', 'DePIN', 'Meme']:
    items = [c for c in manifest if c['faction'] == faction]
    sheet = Image.new('RGB', (7 * 256, 80 + math.ceil(len(items) / 7) * 428), '#171814')
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 20), f'IMPERIVM / {faction} / {len(items)}', fill='#f6e8c9', font=heading)
    for j, c in enumerate(items):
        x, y = (j % 7) * 256, 80 + (j // 7) * 428
        with Image.open(OUT / c['art']) as im:
            sheet.paste(im.resize((240, 360), Image.Resampling.LANCZOS), (x + 8, y))
        label = f"{c['index']:02d} {c['nameEn']}"
        words, lines = label.split(), ['']
        for word in words:
            candidate = (lines[-1] + ' ' + word).strip()
            if draw.textlength(candidate, font=font) <= 240:
                lines[-1] = candidate
            else:
                lines.append(word)
        draw.multiline_text((x + 8, y + 368), '\n'.join(lines), fill='#f6e8c9', font=font, spacing=3)
    sheet.save(OUT / f'contact-{faction.lower()}.jpg', quality=93)

sections = []
for faction in ['DeFi', 'NFT', 'DePIN', 'Meme']:
    items = [c for c in manifest if c['faction'] == faction]
    tiles = ''.join(f'''<article data-faction="{faction}"><button class="portrait" data-index="{c['index']-1}" aria-label="Просмотреть: {html.escape(c['nameRu'])}"><img src="{c['art']}" width="768" height="1152" loading="lazy" alt="{html.escape(c['nameRu'])}"></button><p class="eyebrow">{c['index']:02d} · {faction}</p><h3>{html.escape(c['nameRu'])}</h3><p class="english">{html.escape(c['nameEn'])}</p></article>''' for c in items)
    sections.append(f'<section data-faction="{faction}"><h2>{faction} <span>{len(items)}</span></h2><div class="grid">{tiles}</div></section>')
page = '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>50 персонажей — IMPERIVM</title>
<style>
:root{color-scheme:dark;--ink:#f5ead4;--muted:#c0b299;--gold:#d6b879}*{box-sizing:border-box}body{margin:0;background:#151613;color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1480px;margin:auto;padding:32px clamp(16px,4vw,60px) 70px}a{color:var(--gold)}header{max-width:850px;padding:30px 0}.eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}h1{font:clamp(38px,7vw,70px)/1.1 Georgia,serif;margin:14px 0}header p{color:var(--muted);max-width:660px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:28px 0}button,.download{font:inherit;cursor:pointer;border:1px solid #665939;border-radius:8px;padding:10px 18px;background:#292922;color:var(--ink);text-decoration:none}button[aria-pressed=true],.download{background:#d6b879;color:#201c15}button:focus-visible,a:focus-visible{outline:3px solid #e6c786;outline-offset:4px}h2{font:32px Georgia,serif;margin:40px 0 20px}h2 span{font:14px system-ui;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:24px 18px}article{min-width:0}.portrait{display:block;padding:0;width:100%;border:1px solid #554f3e;background:#28251e;border-radius:12px;overflow:hidden}.portrait img{display:block;width:100%;height:auto;aspect-ratio:2/3}.portrait:hover{border-color:var(--gold)}h3{font:21px/1.2 Georgia,serif;margin:6px 0}article .eyebrow{margin:12px 0 6px}.english{font-size:13px;color:var(--muted);margin:5px 0}.toolbar button{min-height:44px}[hidden]{display:none!important}dialog{border:1px solid #766442;border-radius:14px;background:#1b1c18;color:var(--ink);padding:18px;max-width:96vw;max-height:96dvh;width:min(760px,96vw)}dialog::backdrop{background:#000c}dialog img{display:block;margin:auto;max-height:68dvh;max-width:100%;width:auto;border-radius:8px}dialog h2{font-size:24px;margin:14px 0 4px}dialog p{margin:0;color:var(--muted);font-size:14px}.viewer-nav{display:flex;justify-content:space-between;gap:8px;margin-top:16px}.viewer-nav button{min-height:44px}@media(max-width:480px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 12px}h3{font-size:19px}.toolbar button{padding:10px 14px}main{padding-top:16px}header{padding:20px 0}}
</style><main><a href="/arena-lab">← Арена</a><header><p class="eyebrow">IMPERIVM / Арт будущего расширения</p><h1>Лица новой агоры.</h1><p>50 отдельных иллюстраций: DeFi, NFT, DePIN и Meme. Античные персонажи, криптоюмор и единый живописный стиль. Нажми на портрет, чтобы рассмотреть.</p><p>Сейчас это арт-концепты. Способности и баланс для новых карт будут отдельным этапом.</p></header><nav class="toolbar" aria-label="Фракции"><button aria-pressed="true" data-filter="all">Все 50</button><button aria-pressed="false" data-filter="DeFi">DeFi</button><button aria-pressed="false" data-filter="NFT">NFT</button><button aria-pressed="false" data-filter="DePIN">DePIN</button><button aria-pressed="false" data-filter="Meme">Meme</button><a class="download" href="imperivm-50-character-art.zip" download>Скачать все 50</a></nav>SECTIONS</main><dialog aria-labelledby="viewer-title"><img id="viewer-image" alt=""><h2 id="viewer-title"></h2><p id="viewer-meta"></p><div class="viewer-nav"><button id="previous" aria-label="Предыдущий персонаж">← Назад</button><button id="close">Закрыть</button><button id="next" aria-label="Следующий персонаж">Далее →</button></div></dialog>
<script>
const cards=CARDS,dialog=document.querySelector('dialog');let filter='all',current=0;
function show(index){current=index;const c=cards[index];document.querySelector('#viewer-image').src=c.art;document.querySelector('#viewer-image').alt=c.nameRu;document.querySelector('#viewer-title').textContent=c.nameRu;document.querySelector('#viewer-meta').textContent=c.faction+' · '+c.nameEn+' · '+c.index+'/50';if(!dialog.open)dialog.showModal()}
document.querySelectorAll('[data-index]').forEach(b=>b.addEventListener('click',()=>show(Number(b.dataset.index))));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('section[data-faction]').forEach(s=>s.hidden=filter!=='all'&&s.dataset.faction!==filter)}));
function step(direction){const active=cards.filter(c=>filter==='all'||c.faction===filter).map(c=>c.index-1);show(active[(active.indexOf(current)+direction+active.length)%active.length])}
document.querySelector('#close').addEventListener('click',()=>dialog.close());document.querySelector('#previous').addEventListener('click',()=>step(-1));document.querySelector('#next').addEventListener('click',()=>step(1));dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1)});
</script></html>'''
page = page.replace('SECTIONS', ''.join(sections)).replace('CARDS', json.dumps(manifest, ensure_ascii=False))
(OUT / 'index.html').write_text(page)
(OUT / 'README.txt').write_text((HERE / 'README.md').read_text())
archive = OUT / 'imperivm-50-character-art.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as pack:
    for p in sorted(OUT.rglob('*')):
        if p.is_file() and p != archive:
            pack.write(p, p.relative_to(OUT))
print(f'Packaged {len(manifest)} illustrations: {sum(c["bytes"] for c in manifest):,} bytes; ZIP {archive.stat().st_size:,} bytes')
