"""Encode compact game artwork with Pillow; never overwrite source paintings.

Run from the repo with a Python that has Pillow installed.
"""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
inputs = json.loads(subprocess.check_output(
    ["node", "--import", "tsx", "scripts/card-preview-inputs.ts"], cwd=ROOT, text=True))
records = []
for item in inputs:
    source, output = ROOT / item["source"], ROOT / item["output"]
    original = source.read_bytes()
    with Image.open(source) as artwork:
        size = list(artwork.size)
        artwork.thumbnail(tuple(item["max"]), Image.Resampling.LANCZOS)
        output.parent.mkdir(parents=True, exist_ok=True)
        artwork.save(output, format="WEBP", quality=82, method=4)
        pixels = list(artwork.size)
    encoded = output.read_bytes()
    records.append({**item, "sourceSize": size, "size": pixels,
                    "sourceBytes": len(original), "bytes": len(encoded),
                    "sourceSha256": hashlib.sha256(original).hexdigest(),
                    "sha256": hashlib.sha256(encoded).hexdigest()})
manifest = ROOT / "docs/design/card-loading-20261010/manifest.json"
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps({"files": records,
    "sourceBytes": sum(r["sourceBytes"] for r in records),
    "bytes": sum(r["bytes"] for r in records)}, indent=2) + "\n")
print(f"Encoded {len(records)} previews: {sum(r['sourceBytes'] for r in records):,} → {sum(r['bytes'] for r in records):,} bytes", flush=True)
