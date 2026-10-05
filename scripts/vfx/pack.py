"""Package the reviewed Flow frames/prompts; keep links valid inside the ZIP."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[2]
source = root / 'docs/flow-vfx'
frames = json.loads((source / 'frames.json').read_text())
output = root / 'public/ui/arena-lab/imperivm-flow-vfx-v2.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['BRIEF.md', 'frames.json', 'frames/black-end.png']:
        archive.write(source / name, name)
    for frame in frames:
        prompt = 'prompts/' + frame['id'] + '-v2.txt'
        assert (source / prompt).read_text().strip() == frame['videoPrompt'].strip()
        archive.write(source / frame['firstFrame'], frame['firstFrame'])
        archive.write(source / prompt, prompt)
    motion = (root / 'docs/motion-direction.md').read_text().replace('](flow-vfx/BRIEF.md)', '](BRIEF.md)')
    archive.writestr('motion-direction.md', motion)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == 22
print(f'Flow V2 ZIP OK: {len(frames)} effects, {output.stat().st_size} bytes')
