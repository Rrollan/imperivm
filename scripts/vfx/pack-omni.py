"""Package existing approved frames with Omni-specific prompts; no image edits."""
import io
import json
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
items = json.loads((ROOT / 'docs/flow-vfx/frames-phase2.json').read_text())
guide = ROOT / 'docs/omni-vfx/00-START-HERE.md'
motions = {
    'legionary': 'The existing bronze dust arc settles down once; its six copper flecks drift outward a few pixels.',
    'guard': 'One ivory glint travels up the existing steel-blue shield contour; the contour stays open and then fades.',
    'commander': 'One warm gold highlight travels along the existing crimson and gold laurel; its few sparks rise a short distance.',
    'minister': 'One violet highlight traces the existing imperial seal rim; the small violet particles fall a short distance.',
    'priest': 'The existing jade olive branches shimmer once; the turquoise motes rise gently through the empty centre.',
    'engineer': 'One cyan highlight travels around the existing bronze schematic segments; the amber sparks settle down.',
    'weaken': 'The existing broken vermilion seal and pale steel spear contour dim; their three burgundy fragments fall slightly.',
    'heal': 'One soft ivory highlight travels around the existing open turquoise halo; its six jade motes rise gently.',
}
manifest = []
archive = ROOT / 'public/ui/arena-lab/imperivm-omni-flash-vfx.zip'
downloads = ROOT / 'public/ui/arena-lab/omni-kit'
downloads.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    bundle.write(guide, '00-START-HERE.md')
    for item in items:
        number = item['id'].split('-')[0]
        active = f"{item['activeSeconds']:.2f}"
        prompt = (
            '[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image2]\n\n'
            f"Create one isolated IMPERIVM game VFX clip, landscape 16:9, 720p. Image1 is {number}-START.png: use it as the exact starting frame. Image2 is {number}-END.png: use it as the exact final frame.\n\n"
            'A single continuous shot, locked frontal orthographic camera. Keep the exact starting silhouette, palette, size, position and empty black centre. Uniform pure black RGB 0,0,0 background throughout.\n\n'
            f"[0.00-0.12s] {motions[item['role']]}\n"
            f'[0.12-{active}s] The existing contours and particles fade smoothly and completely to black. Keep the effect within its starting footprint.\n'
            f'[{active}s-end] Hold completely pure black. The clip may be 4 seconds or the shortest available duration; do not stretch or repeat the active effect to fill it.\n\n'
            'No scene cuts, camera movement, extra objects, additional rings, opaque centre, card, person, arena, UI, letters, numbers, smoke, bloom or full-screen flash. Silent audio: no music, speech or sound effects. The game supplies its own sounds.\n'
        )
        (ROOT / f"docs/omni-vfx/prompts/{item['id']}.txt").write_text(prompt)
        (downloads / f'{number}-PROMPT.txt').write_text(prompt)
        for phase in ('START', 'END'):
            source = ROOT / f'public/ui/arena-lab/flow-kit/{number}-{phase}.png'
            data = source.read_bytes()
            image = Image.open(io.BytesIO(data)).convert('RGB')
            assert image.size == (1280, 720), source
            if phase == 'END':
                assert image.getbbox() is None, f'End must be pure black: {source}'
            else:
                assert image.getbbox() is not None, f'Start must contain an effect: {source}'
            bundle.writestr(f"{item['id']}/{number}-{phase}.png", data)
        bundle.writestr(f"{item['id']}/{number}-PROMPT.txt", prompt)
        bundle.writestr(f"{item['id']}/OUTPUT.txt", f"Сохрани результат как {item['id']}.mp4\nАктивный эффект: {active} с; дальше только чёрный кадр.\n")
        manifest.append({'id': item['id'], 'title': item['title'], 'activeSeconds': item['activeSeconds'], 'prompt': prompt})
    bundle.writestr('MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
(ROOT / 'docs/omni-vfx/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
    assert sum(name.endswith('-START.png') for name in check.namelist()) == 8
    assert sum(name.endswith('-END.png') for name in check.namelist()) == 8
    assert sum(name.endswith('-PROMPT.txt') for name in check.namelist()) == 8
print(f'OMNI PACK OK: 8 validated START/END pairs, 8 prompts, {archive.stat().st_size} bytes')
