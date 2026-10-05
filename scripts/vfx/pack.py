"""Export a self-contained START/END/prompt folder for every Flow video."""
from pathlib import Path
import json
import shutil
import struct
import zipfile

root = Path(__file__).resolve().parents[2]
source = root / 'docs/flow-vfx'
frames = sorted(json.loads((source / 'frames.json').read_text()), key=lambda frame: frame['id'])
public = root / 'public/ui/arena-lab'
files = public / 'flow-kit'
files.mkdir(parents=True, exist_ok=True)
output = public / 'imperivm-flow-vfx-pairs.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(source / 'START-HERE.txt', '00-START-HERE.txt')
    for index, frame in enumerate(frames, 1):
        number = frame['id'].split('-')[0]
        assert number == f'{index:02}', 'Video numbers must match their folder and filenames'
        prompt = (source / f"prompts/{frame['id']}-v2.txt").read_text()
        assert prompt.strip() == frame['videoPrompt'].strip()
        exported = {
            f'{number}-START.png': source / frame['firstFrame'],
            f'{number}-END.png': source / frame['lastFrame'],
            f'{number}-PROMPT.txt': source / f"prompts/{frame['id']}-v2.txt",
        }
        for name, original in exported.items():
            if original.suffix == '.png':
                header = original.read_bytes()[:24]
                assert header[:8] == b'\x89PNG\r\n\x1a\n'
                assert struct.unpack('>II', header[16:24]) == (1280, 720)
            shutil.copyfile(original, files / name)
            archive.write(original, f"{frame['id']}/{name}")
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == 1 + 3 * len(frames)
print(f'Flow pairs ZIP OK: {len(frames)} folders, START + END + PROMPT each, {output.stat().st_size} bytes')
