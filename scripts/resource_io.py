"""Read local catalogue snapshots, preferring explicitly refreshed loose files."""
import gzip
import json
from pathlib import Path


def read_bytes(path):
    path = Path(path)
    if path.exists():
        return path.read_bytes()
    with gzip.open(path.with_name(path.name + '.gz'), 'rb') as source:
        return source.read()


def read_text(path):
    return read_bytes(path).decode('utf-8')


def read_json(path):
    return json.loads(read_text(path))
