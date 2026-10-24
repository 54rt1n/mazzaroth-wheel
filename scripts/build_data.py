#!/usr/bin/env python3
"""Join the attested monthly list to explicitly selected modern locators."""
import csv, json, math
from resource_io import read_json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
read = lambda p: read_json(ROOT / p)
OUTPUT = ROOT / '.data'
OUTPUT.mkdir(exist_ok=True)
entries = read('research/astrolabe36.json')
cultures = read('research/cultural_names.json')
catalogue = read('catalogue/stars.json')
resolver = read('catalogue/resolver.json')
gaia_by_hip = {str(s['hip']): s for s in catalogue['stars'] if s.get('hip') and s.get('coordinateSource') == 'Gaia DR2'}
MOTION_FIELDS = ['pmRaMasYr', 'pmDecMasYr', 'nativeRaDeg', 'nativeDecDeg', 'nativeEpoch']
labels = {
 'https://undena.com/EL-UP/Edited_PDF/BM2.2.pdf': 'Reiner & Pingree (1981), Table II and commentary',
 'https://cdli.earth/articles/cdlj/2023-1': 'Cifola & Hughey (2023): Astrolabe B reinterpretation',
 'https://cdli.earth/artifacts/281769': 'Original tablet: KAV 218 / VAT 9416',
 'https://journals.sagepub.com/doi/10.1177/00218286221110919': 'Monroe (2022): preserved circular diagrams',
 'https://dokumen.pub/mesopotamian-cosmic-geography-0931464994-9780931464997.html': 'Horowitz: Mesopotamian Cosmic Geography',
}
def source(s):
    if isinstance(s, dict): return s
    return {'url':s, 'label':labels.get(s, ('All Skies Encyclopedia: '+s.rsplit('/',1)[-1].replace('_',' ')) if 'ase.exopla.net' in s else s)}
def resolve(name):
    s = resolver.get('byName',{}).get(name) or resolver.get('byProperName',{}).get(name)
    # BSC HR5054 is 79 zeta UMa; its HD116656 cross-identifies HIP65378.
    if name == 'Mizar' and not s: s = resolver['byBayerFlamsteed']['79Zet UMa']
    if not s: raise ValueError('Unresolved modern reference star: '+name)
    s = gaia_by_hip.get(str(s.get('hip')), s).copy()
    s['locatorName'] = name
    return s
def centroid(stars):
    v=[0.,0.,0.]
    for s in stars:
        a,d=map(math.radians,(s['raDeg'],s['decDeg']))
        for i,x in enumerate((math.cos(d)*math.cos(a),math.cos(d)*math.sin(a),math.sin(d))):v[i]+=x
    return round(math.degrees(math.atan2(v[1],v[0]))%360,7),round(math.degrees(math.atan2(v[2],math.hypot(v[0],v[1]))),7)
for e in entries:
    extra=cultures.get(e['id'],{})
    e['culturalNames']=extra.get('culturalNames',{})
    e['sources']=[source(s) for s in e['sources']+extra.get('sources',[])]
    e['sources']=list({s['url']:s for s in e['sources']}.values())
    e.update(raDeg=None,decDeg=None,mag=None,coordinateSource=None,coordinateEpoch=None)
    stars=[resolve(n) for n in e['referenceStars']]
    e['anchorStars']=stars
    if not stars:
        e['coordinateRole']='unresolved'
        e['coordinateNote']='No defensible catalogue locator is assigned. The name remains in its transmitted monthly slot; its original astronomical referent is unresolved.'
        continue
    e['raDeg'],e['decDeg']=centroid(stars)
    e['coordinateSource']=' / '.join(sorted({s['coordinateSource'] for s in stars}))
    epochs=sorted({s['coordinateEpoch'] for s in stars})
    e['coordinateEpoch']=epochs[0] if len(epochs)==1 else 'Mixed native/propagated epochs; see anchor records'
    if len(stars)==1:
        s=stars[0]
        for k in ['mag','magBand','hip','gaiaDr2Id','hr'] + MOTION_FIELDS:
            if s.get(k) is not None:e[k]=s[k]
        e['motionRole']='catalogue proper motion' if all(s.get(k) is not None for k in MOTION_FIELDS[:2]) else 'proper motion unavailable'
        e['coordinateRole']='representative star' if e['kind']!='star' else 'identified star'
        e['coordinateNote']=f"Catalogue position of {s['locatorName']}. "+('This is an illustrative locator for a wider proposed figure, not its ancient extent. ' if e['kind']!='star' else '')+'Proper motion is applied to epoch 2000 where available; no ancient-epoch precession.'
    else:
        e['coordinateRole']='illustrative centroid'
        e['motionRole']='Propagate each anchor star, then recompute the unweighted spherical centroid; no single proper-motion vector is assigned.'
        e['coordinateNote']='Unweighted spherical centroid of '+', '.join(s['locatorName'] for s in stars)+'. This is a modern locator chosen for this atlas, not a recovered ancient outline or a measured star. Individual catalogue records are included in the JSON dataset.'
    for s in stars:
        if not any(x['url']==s['sourceUrl'] for x in e['sources']):e['sources'].append({'label':s['coordinateSource'],'url':s['sourceUrl']})
meta=catalogue['meta']
counts=meta['counts']
payload={'entries':entries,'stars':[{k:s[k] for k in ['raDeg','decDeg','mag','magBand','hip','gaiaDr2Id','coordinateSource','coordinateEpoch'] + MOTION_FIELDS if s.get(k) is not None} for s in catalogue['stars']], 'meta':{
 'title':'Astrolabe B — Thirty-Six Monthly Entries',
 'description':'The monthly list of Astrolabe B (KAV 218 / VAT 9416), organized as twelve months with one name in each of the Ea, Anu and Enlil paths. This is a comparison for investigating Mazzaroth; their identity is not established.',
 'methodology':'The original names, their later uses, and our modern catalogue locators are separate layers. Dilbat, Šulpae, Salbatanu and Marduk have planetary associations in other texts, but their original referents here are unresolved. Reiner and Pingree proposed older fixed-star meanings. This atlas assigns neither fixed planetary positions nor invented replacement stars. The paths retain the tablet’s classifications, not modern declination bands.',
 'notes':'Cifola and Hughey (2023) interpret the monthly triads as seasonal reminders within a narrative and religious framework. This is an attributed scholarly proposal; continuity through the Median Magi is not established. Constellation markers are explicitly chosen modern reference stars or spherical centroids. Month numbers are schematic calendar assignments, not Gregorian dates or measured longitudes. Ring order follows preserved circular astrolabes: Enlil inside, Anu middle, Ea outside (Monroe 2022). Equal radii and angles within cells are drawing choices, not recovered individual-star measurements.',
 'coordinateLabel':'ICRS · epoch 2000 where proper motion is available',
 'coordinateEpoch':2000,
 'properMotionNote':'pmRaMasYr is mu_alpha*cos(delta), and pmDecMasYr is mu_delta, both in milliarcseconds per Julian year. Native position and epoch are retained where available. Missing motion is not replaced by an invented measurement. A linear tangent-vector propagation omits radial-velocity perspective acceleration, orbital motion, and catalogue covariance; ancient extrapolations remain approximate. Group locators require propagation of their individual anchors followed by a new spherical centroid.',
 'catalogueSummary':f"{counts['gaiaDr2']:,} Gaia DR2 records retrieved (G ≤ 6.5). The displayed background contains {counts['gaiaDr2Displayed']:,} Gaia DR2 and {counts['hipparcosBrightFallback']:,} Hipparcos records (V ≤ 6.5), after suppressing {counts['gaiaDr2DisplaySuppressed']:,} Gaia display points within 3 arcseconds of a Hipparcos fallback marker. This display-overlap rule does not establish a new physical crossmatch. BSC5 supplies cross-identifications and a resolver fallback. "+meta['epochNote']+' '+meta['photometryNote']+' No additional astrometric-quality cut is applied; an archive match is not validation of an ancient identification.',
 'catalogueProvenance':meta,
 'sources':[source(s) for s in labels]+[{'label':'Enūma Eliš V: celestial Marduk (primary-text discussion)','url':'https://www.cambridge.org/core/journals/iraq/article/celestial-marduk-in-and-beyond-enuma-elis/C61559BDDB991E16F1FE9E2BC9F796F5'}],
}}
calibration=read('catalogue/pole_calibration.json')
payload['calibrationStars']=calibration['stars']
for star in payload['calibrationStars']:
    # Preserve the coordinate source used by the pole-calibration file. In
    # particular, do not silently replace a Hipparcos calibrator with Gaia.
    matching=[s for s in catalogue['stars'] if str(s.get('hip')) == str(star.get('hip')) and s.get('coordinateSource') == star.get('coordinateSource')]
    record=next(iter(matching), None)
    if record is None:
        record=resolver.get('byHip', {}).get(str(star.get('hip')))
    if record and record.get('coordinateSource') == star.get('coordinateSource'):
        for key in MOTION_FIELDS:
            if record.get(key) is not None:star[key]=record[key]
payload['meta']['poleCalibration']={
 'summary':'Polaris lies 0.7359° (44.1534 arcminutes) from the fixed ICRS north pole at stellar epoch 2000. It is close to the center, not coincident with it.',
 'projection':'The plot is defined around the ICRS north pole. Its radius is proportional to 90° minus declination. That coordinate choice does not independently identify the center of an ancient diagram.',
 'orientation':'At zero rotation: 0h RA is up, 6h right, 12h down, 18h left. RA increases clockwise. A star’s plotted angle equals its RA in degrees plus the rotation setting; this is a stated chart orientation, not a local compass bearing.',
 'epochNote':'Stellar positions are propagated to epoch 2000 where proper motion is available. No ancient precession is applied. The current apparent celestial pole and its historical positions require date-dependent Earth-orientation and precession models.',
}
(OUTPUT/'data.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
fields=['name','hip','gaiaDr2Id','raDeg','decDeg','polarDistanceDeg','mag','magBand','coordinateSource','coordinateEpoch','ancientEntryIds']
refs={}
for e in entries:
    for s in e['anchorStars']:
        key=s.get('hip') or s['id']
        if key not in refs:refs[key]={**s,'name':s['locatorName'],'polarDistanceDeg':90-s['decDeg'],'ancientEntryIds':[]}
        refs[key]['ancientEntryIds'].append(e['id'])
for s in payload['calibrationStars']:
    key=s.get('hip') or s['name']
    if key not in refs:refs[key]={**s,'polarDistanceDeg':90-s['decDeg'],'ancientEntryIds':[]}
with (OUTPUT/'star-coordinates.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader()
    for s in refs.values():s['ancientEntryIds']=';'.join(s['ancientEntryIds']);writer.writerow(s)
print(f"Built {len(entries)} entries; {sum(e['raDeg'] is not None for e in entries)} modern locators; {len(payload['stars'])} background records.")
