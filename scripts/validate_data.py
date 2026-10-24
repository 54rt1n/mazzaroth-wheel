#!/usr/bin/env python3
"""Checks historical-grid and catalogue data integrity before publication."""
import json,math,sys
from pathlib import Path
p=Path(__file__).resolve().parents[1]
d=json.loads((p/'.data/data.json').read_text())
e=d['entries']; s=d['stars']
assert len(e)==36, f'Expected 36 monthly entries, got {len(e)}'
assert len({x['id'] for x in e})==36, 'Entry IDs must be unique'
assert {(x['month'],x['path']) for x in e}=={(m,p) for m in range(1,13) for p in ['Ea','Anu','Enlil']}, 'Monthly grid incomplete'
for x in e:
    assert x['ancientName'] and x['modernIdentification'] and x['sources'], x['id']
    assert x['confidence'] and x['notes'], x['id']
    ra,dec=x.get('raDeg'),x.get('decDeg')
    assert (ra is None)==(dec is None), x['id']
    if ra is not None:
        assert 0<=ra<360 and -90<=dec<=90, x['id']
        assert x.get('coordinateSource') and x.get('coordinateNote'), x['id']
for x in s:
    assert isinstance(x['raDeg'],(int,float)) and math.isfinite(x['raDeg'])
    assert 0<=x['raDeg']<360 and -90<=x['decDeg']<=90
    assert math.isfinite(x['mag'])
    if x.get('gaiaDr2Id') is not None:
        assert isinstance(x['gaiaDr2Id'],str), 'Gaia IDs must not lose precision in JavaScript'
assert len(s)>100, 'Catalogue starfield absent'
print(json.dumps({'entries':len(e),'months':12,'paths':3,'positioned_entries':sum(x.get('raDeg') is not None for x in e),'unpositioned_entries':sum(x.get('raDeg') is None for x in e),'catalogue_stars':len(s),'status':'passed'}))
