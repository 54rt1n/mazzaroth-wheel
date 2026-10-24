#!/usr/bin/env python3
"""Reproducible, public catalogue subset for the Mazzaroth sky-wheel.

Gaia DR2 is queried from ESA's archive; Hipparcos and BSC5 from CDS.
No catalogue source IDs or positions are synthesized. Epoch propagation is a
linear tangent-vector calculation in ICRS, not precession or an ancient sky.
"""
import csv
import gzip
import io
import json
import math
import pathlib
import concurrent.futures
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from scipy.spatial import cKDTree

ROOT = pathlib.Path(__file__).resolve().parent
GAIA_QUERY = """SELECT g.source_id,g.ra,g.dec,g.ref_epoch,g.pmra,g.pmdec,g.parallax,g.phot_g_mean_mag,g.bp_rp,h.original_ext_source_id AS hip
FROM gaiadr2.gaia_source AS g
LEFT OUTER JOIN gaiadr2.hipparcos2_best_neighbour AS h ON g.source_id=h.source_id
WHERE g.phot_g_mean_mag <= 6.5"""
URLS = {
    'gaia_dr2_bright.csv': 'https://gea.esac.esa.int/tap-server/tap/sync?' + urllib.parse.urlencode({'REQUEST':'doQuery','LANG':'ADQL','FORMAT':'csv','QUERY':GAIA_QUERY}),
    'hipparcos_main.tsv': 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?' + urllib.parse.urlencode({'-source':'I/239/hip_main','-out.max':'unlimited','-out':'HIP,HD,Vmag,RAICRS,DEICRS,pmRA,pmDE,Plx,B-V'}),
    'bsc5_catalog.gz': 'https://cdsarc.cds.unistra.fr/ftp/cats/V/50/catalog.gz',
    'bsc_ReadMe': 'https://cdsarc.cds.unistra.fr/ftp/cats/V/50/ReadMe',
}

def fetch(item):
    name, url = item
    target = ROOT/name
    if not target.exists():
        req=urllib.request.Request(url,headers={'User-Agent':'MazzarothResearchSkyWheel/1.0 (public scientific catalogue subset)'})
        with urllib.request.urlopen(req, timeout=240) as r:
            body = r.read()
        target.write_bytes(body)
    print(f'{name}: {target.stat().st_size} bytes', flush=True)

def num(value):
    try:
        x=float(value)
        return x if math.isfinite(x) else None
    except (ValueError,TypeError):
        return None

def integer(value):
    x=num(value)
    return int(x) if x is not None else None

def propagate(ra, dec, pmra, pmdec, epoch):
    """Move tangent vector from native epoch to epoch J2000, preserving ICRS.
    pmra is mu_alpha*cos(delta), in mas/year. No radial-velocity perspective
    or annual parallax is applied. Missing proper motion leaves position fixed.
    """
    if ra is None or dec is None:
        return None,None,False
    if pmra is None or pmdec is None:
        return ra,dec,False
    a,d=math.radians(ra),math.radians(dec)
    k=math.pi/(180*3600000)*(2000.0-epoch)
    v=[math.cos(d)*math.cos(a),math.cos(d)*math.sin(a),math.sin(d)]
    ea=[-math.sin(a),math.cos(a),0]
    ed=[-math.sin(d)*math.cos(a),-math.sin(d)*math.sin(a),math.cos(d)]
    p=[v[i]+k*(pmra*ea[i]+pmdec*ed[i]) for i in range(3)]
    return math.degrees(math.atan2(p[1],p[0]))%360,math.degrees(math.atan2(p[2],math.hypot(p[0],p[1]))),True

def gaia_rows():
    result=[]
    for r in csv.DictReader(io.StringIO((ROOT/'gaia_dr2_bright.csv').read_text())):
        ra,dec=num(r['ra']),num(r['dec'])
        pra,pde=num(r['pmra']),num(r['pmdec'])
        epoch=num(r['ref_epoch']) or 2015.5
        a,d,moved=propagate(ra,dec,pra,pde,epoch)
        result.append({'id':'Gaia DR2 '+r['source_id'],'gaiaDr2Id':r['source_id'],'hip':integer(r.get('hip')),
                       'raDeg':round(a,8),'decDeg':round(d,8),'mag':num(r['phot_g_mean_mag']),'magBand':'Gaia G',
                       'bpRp':num(r.get('bp_rp')),'pmRaMasYr':pra,'pmDecMasYr':pde,'parallaxMas':num(r.get('parallax')),
                       'nativeRaDeg':ra,'nativeDecDeg':dec,'nativeEpoch':epoch,'coordinateEpoch':2000.0 if moved else epoch,
                       'coordinateFrame':'ICRS','properMotionApplied':moved,'coordinateSource':'Gaia DR2',
                       'sourceUrl':'https://gea.esac.esa.int/archive/'} )
    return result

def hip_rows():
    lines=[x for x in (ROOT/'hipparcos_main.tsv').read_text().splitlines() if x and not x.startswith('#')]
    headers=lines[0].split('\t')
    rows=[]
    for line in lines[3:]:
        r=dict(zip(headers,[x.strip() for x in line.split('\t')]))
        hip=integer(r.get('HIP'))
        ra,dec=num(r.get('RAICRS')),num(r.get('DEICRS'))
        if hip is None or ra is None or dec is None:continue
        pra,pde=num(r.get('pmRA')),num(r.get('pmDE'))
        a,d,moved=propagate(ra,dec,pra,pde,1991.25)
        rows.append({'id':f'HIP {hip}','hip':hip,'hd':integer(r.get('HD')),'raDeg':round(a,8),'decDeg':round(d,8),
                     'mag':num(r.get('Vmag')),'magBand':'Johnson V','bV':num(r.get('B-V')),
                     'pmRaMasYr':pra,'pmDecMasYr':pde,'parallaxMas':num(r.get('Plx')),
                     'nativeRaDeg':ra,'nativeDecDeg':dec,'nativeEpoch':1991.25,'coordinateEpoch':2000.0 if moved else 1991.25,
                     'coordinateFrame':'ICRS','properMotionApplied':moved,'coordinateSource':'Hipparcos (ESA 1997)',
                     'sourceUrl':'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239'})
    return rows

def bsc_rows():
    rows=[]
    for line in gzip.decompress((ROOT/'bsc5_catalog.gz').read_bytes()).decode('ascii').splitlines():
        hr=integer(line[0:4]);hd=integer(line[25:31]);name=line[4:14].strip()
        if not line[75:77].strip():continue
        ra=15*(float(line[75:77])+float(line[77:79])/60+float(line[79:83])/3600)
        dec=(float(line[84:86])+float(line[86:88])/60+float(line[88:90])/3600)*(-1 if line[83:84]=='-' else 1)
        rows.append({'id':f'HR {hr}','hr':hr,'hd':hd,'bayerFlamsteed':name,'raDeg':round(ra,8),'decDeg':round(dec,8),
                     'mag':num(line[102:107]),'magBand':'Johnson V','coordinateEpoch':2000.0,'coordinateFrame':'FK5/J2000',
                     'coordinateSource':'Bright Star Catalogue, 5th Revised Ed.','sourceUrl':'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50'})
    return rows

def direction(star):
    a,d=math.radians(star['raDeg']),math.radians(star['decDeg'])
    return (math.cos(d)*math.cos(a),math.cos(d)*math.sin(a),math.sin(d))

def coalesce_display(gaia, fallback, arcsec=3.0):
    """Coalesce overlapping markers, without claiming an astrophysical match.

    Some bright HIP sources have a DR2 position but no published HIP crossmatch.
    Prefer the HIP fallback marker (with its native Johnson V magnitude), and
    suppress all Gaia markers within the stated display tolerance. Preserve
    their raw rows and an explicit audit so this is not a catalogue alteration.
    """
    tree=cKDTree([direction(s) for s in gaia])
    chord=2*math.sin(math.radians(arcsec/3600)/2)
    suppressed=set();audit=[]
    for h in fallback:
        v=direction(h)
        for i in tree.query_ball_point(v,chord):
            g=gaia[i];w=direction(g)
            separation=math.degrees(2*math.asin(min(1,math.sqrt(sum((v[j]-w[j])**2 for j in range(3)))/2)))*3600
            suppressed.add(i)
            audit.append({'retainedHip':h['hip'],'retainedV':h['mag'],
                          'suppressedGaiaDr2Id':g['gaiaDr2Id'],'suppressedG':g['mag'],
                          'officialGaiaHip':g.get('hip'),'separationArcsec':round(separation,6)})
    (ROOT/'display_deduplication.json').write_text(json.dumps({'displayToleranceArcsec':arcsec,
        'method':'Display-only positional coalescence; these are not new asserted physical crossmatches.',
        'suppressedGaiaRows':len(suppressed),'pairs':audit},indent=2))
    return [s for i,s in enumerate(gaia) if i not in suppressed],len(suppressed)

def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(fetch,URLS.items()))
    gaia,hip,bsc=gaia_rows(),hip_rows(),bsc_rows()
    hip_by_id={s['hip']:s for s in hip}
    hip_by_hd={s['hd']:s for s in hip if s.get('hd')}
    gaia_by_id={s['gaiaDr2Id']:s for s in gaia}
    gaia=list(gaia_by_id.values())
    gaia_by_hip={s['hip']:s for s in gaia if s.get('hip')}
    bsc_by_hd={s['hd']:s for s in bsc if s.get('hd')}
    for h in hip:
        b=bsc_by_hd.get(h.get('hd'))
        if b:
            h.update({'hr':b['hr'],'bayerFlamsteed':b['bayerFlamsteed']})
        g=gaia_by_hip.get(h['hip'])
        if g:
            g.update({k:h[k] for k in ('hd','hr','bayerFlamsteed','bV') if k in h})
            h['gaiaDr2Id']=g['gaiaDr2Id']
    fallback=[h for h in hip if h['mag'] is not None and h['mag']<=6.5 and h['hip'] not in gaia_by_hip]
    display_gaia,suppressed=coalesce_display(gaia,fallback)
    stars=sorted(display_gaia+fallback,key=lambda s:(s['mag'] if s['mag'] is not None else 99,s['id']))
    # Full HIP lookup retains verified catalogue positions for faint anchors too.
    resolver={'byHip':hip_by_id,'byHr':{b['hr']:b for b in bsc},
              'byBayerFlamsteed':{b['bayerFlamsteed']:b for b in bsc if b['bayerFlamsteed']}}
    for hr,b in list(resolver['byHr'].items()):
        chosen=hip_by_hd.get(b.get('hd'))
        if chosen:
            resolver['byHr'][hr]=gaia_by_hip.get(chosen['hip'],chosen)
            if b['bayerFlamsteed']:resolver['byBayerFlamsteed'][b['bayerFlamsteed']]=resolver['byHr'][hr]
    metadata={'retrievedUtc':datetime.now(timezone.utc).isoformat(),'gaiaDataRelease':'DR2','targetCoordinateEpoch':2000.0,
              'coordinateFrame':'ICRS (Gaia/Hipparcos); FK5 J2000 for BSC-only resolver entries',
              'epochNote':'Gaia positions at J2015.5 and Hipparcos positions at J1991.25 have been propagated to J2000 with linear proper motions. Original values and reference epochs are retained. Objects without proper motion retain their native epoch. This is not precession to an ancient epoch; annual parallax and perspective acceleration are not modeled.',
              'photometryNote':'Background is selected at Gaia G≤6.5, supplemented with unmatched Hipparcos Johnson V≤6.5. G and V are different passbands; marker sizes are illustrative, not calibrated visible-light photometry.',
              'displayDeduplicationNote':'Gaia display points within 3 arcsec of a bright Hipparcos fallback are suppressed to avoid overlapping markers. This display-only positional coalescence does not assign Gaia IDs to HIP sources or establish new physical crossmatches. All raw Gaia rows and the pair audit are retained.',
              'qualityNote':'The Gaia subset uses a G-magnitude cut only: no astrometric or photometric quality filter. DR2 is incomplete at the bright end, and individual bright-source magnitudes or solutions can be problematic. Gaia source IDs are retained as strings. The 155 Gaia sources without proper motion retain their native J2015.5 coordinate epoch.',
              'counts':{'gaiaDr2':len(gaia),'gaiaDr2Displayed':len(display_gaia),'gaiaDr2DisplaySuppressed':suppressed,'hipparcosBrightFallback':len(fallback),'backgroundTotal':len(stars),'hipparcosResolver':len(hip),'bscResolver':len(bsc)},
              'queries':{'gaiaADQL':GAIA_QUERY,'urls':URLS},
              'catalogues':[{'label':'Gaia DR2 (Gaia Collaboration 2018)','url':'https://www.cosmos.esa.int/web/gaia/dr2'},
                            {'label':'Hipparcos and Tycho Catalogues (ESA 1997), I/239','url':'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239'},
                            {'label':'Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren), V/50','url':'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50'}]}
    (ROOT/'stars.json').write_text(json.dumps({'meta':metadata,'stars':stars},ensure_ascii=False,separators=(',',':')))
    (ROOT/'resolver.json').write_text(json.dumps(resolver,ensure_ascii=False,separators=(',',':')))
    (ROOT/'provenance.json').write_text(json.dumps(metadata,indent=2))
    print(json.dumps(metadata['counts'],indent=2),flush=True)

if __name__=='__main__':main()
