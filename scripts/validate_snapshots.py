"""Verify the checksums of the committed catalogue snapshots."""
import gzip
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'catalogue'
manifest = json.loads((root / 'snapshots.json').read_text())
for name, expected in manifest['files'].items():
    content = (root / name).read_bytes()
    assert hashlib.sha256(content).hexdigest() == expected['sha256'], f'Snapshot changed: {name}'
    if 'uncompressedSha256' in expected:
        raw = gzip.decompress(content)
        assert len(raw) == expected['uncompressedBytes'], f'Snapshot length changed: {name}'
        assert hashlib.sha256(raw).hexdigest() == expected['uncompressedSha256'], f'Snapshot contents changed: {name}'
print(f"PASS: {len(manifest['files'])} pinned catalogue snapshots and metadata files")
