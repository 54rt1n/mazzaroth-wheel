#!/usr/bin/env python3
"""Attach public-domain IAU/WGSN proper names and write a compact web subset.
Names require HIP plus coordinates within 1′, or concordant HIP/HR identifiers.
Only labels/identifiers are reused; no WGSN descriptive prose or images copied.
"""
import json,math,re,pathlib,urllib.request
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parent
URL='https://exopla.net/star-names/modern-iau-star-names/'

class Rows(HTMLParser):
    def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
    def handle_starttag(self,t,a):
        if t=='tr':self.row=[]
        if t in ('td','th') and self.row is not None:self.cell=[]
    def handle_endtag(self,t):
        if t in ('td','th') and self.cell is not None:self.row.append(''.join(self.cell).strip());self.cell=None
        if t=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
    def handle_data(self,t):
        if self.cell is not None:self.cell.append(t)

def distance(a,d,x,y):
    a,d,x,y=map(math.radians,(a,d,x,y))
    return math.degrees(2*math.asin(min(1,math.sqrt(math.sin((d-y)/2)**2+math.cos(d)*math.cos(y)*math.sin((a-x)/2)**2))))*3600

def main():
    html=ROOT/'iau_names_page.html'
    if not html.exists():html.write_bytes(urllib.request.urlopen(URL,timeout=60).read())
    parser=Rows();parser.feed(html.read_text())
    resolver=json.loads((ROOT/'resolver.json').read_text())
    sky=json.loads((ROOT/'stars.json').read_text())
    names={};rejected=[];coordinate_exceptions=[]
    for row in parser.rows[1:]:
        if len(row)<16:continue
        name,hip=row[0],row[3]
        # Components and non-HIP identifiers are not guessed or conflated.
        if not hip.isdigit() or hip not in resolver['byHip']:continue
        h=resolver['byHip'][hip]
        try:sep=distance(h['raDeg'],h['decDeg'],float(row[13]),float(row[14]))
        except ValueError:continue
        if sep>60:
            # A few WGSN page coordinates are misaligned. If its independent HR
            # designation agrees with the actual HIP/HD/BSC crosswalk, use that
            # identifier agreement; coordinates always come from catalogues.
            hr=re.fullmatch(r'HR\s+(\d+)',row[2].strip())
            if not hr or int(hr[1])!=h.get('hr'):
                rejected.append({'name':name,'hip':hip,'separationArcsec':round(sep,3)})
                continue
            coordinate_exceptions.append({'name':name,'hip':hip,'hr':h['hr'],'pageCoordinateSeparationArcsec':round(sep,3),'acceptedBy':'Concordant HIP and HR identifiers; WGSN page position not used.'})
        h['properName']=name;h['nameSource']=URL;h['iauBayer']=row[4]
        names[name]=h
    resolver['byProperName']=names
    by_name=dict(names)
    greek={'Alp':'Alpha','Bet':'Beta','Gam':'Gamma','Del':'Delta','Eps':'Epsilon','Zet':'Zeta','Eta':'Eta','The':'Theta','Iot':'Iota','Kap':'Kappa','Lam':'Lambda','Mu':'Mu','Nu':'Nu','Xi':'Xi','Omi':'Omicron','Pi':'Pi','Rho':'Rho','Sig':'Sigma','Tau':'Tau','Ups':'Upsilon','Phi':'Phi','Chi':'Chi','Psi':'Psi','Ome':'Omega'}
    genitives={'Psc':'Piscium','Crv':'Corvi','Cnc':'Cancri','Lup':'Lupi','Tau':'Tauri','Ori':'Orionis','UMa':'Ursae Majoris','And':'Andromedae','Peg':'Pegasi','Cen':'Centauri','CMa':'Canis Majoris','Boo':'Bootis','Leo':'Leonis','Lyr':'Lyrae','Cyg':'Cygni','Aqr':'Aquarii','PsA':'Piscis Austrini','Sco':'Scorpii','Aql':'Aquilae','Per':'Persei','Tri':'Trianguli','Gem':'Geminorum','Hya':'Hydrae','Ari':'Arietis'}
    for s in sky['stars']:
        h=resolver['byHip'].get(str(s.get('hip')),{})
        if h.get('properName'):s.update({k:h[k] for k in ('properName','iauBayer','nameSource')})
    for group in ('byHr','byBayerFlamsteed'):
        for k,s in resolver[group].items():
            h=resolver['byHip'].get(str(s.get('hip')),{})
            if h.get('properName'):s.update({x:h[x] for x in ('properName','iauBayer','nameSource')})
            if group=='byBayerFlamsteed':
                by_name[k]=s
                m=re.search(r'([A-Za-z]{2,3})([12]?)\s+([A-Za-z]{3})$',k)
                if m and m[1] in greek:
                    short=f'{greek[m[1]]}{m[2]} {m[3]}'
                    long=f'{greek[m[1]]}{m[2]} {genitives.get(m[3],m[3])}'
                    by_name[short]=s;by_name[long]=s
    # Different catalogue spellings of the same IAU proper name.
    if 'Asterope' not in by_name and 'Sterope' in by_name:by_name['Asterope']=by_name['Sterope']
    resolver['byName']=by_name
    metadata=sky['meta']
    metadata['nameCatalogue']={'name':'IAU/WGSN Catalogue of Star Names','url':URL,'acceptedNames':len(names),'rejectedCoordinateMismatches':rejected,'acceptedIdentifierMatchesWithPageCoordinateMismatch':coordinate_exceptions,
        'note':'Labels and identifiers only; public-domain scientific nomenclature. Names require a matching HIP and IAU-listed position within one arcminute, or concordant independent HIP and HR identifiers. All displayed coordinates come from Gaia/Hipparcos/BSC, never the name page.'}
    keys=('raDeg','decDeg','mag','magBand','hip','hr','gaiaDr2Id','properName','bayerFlamsteed','coordinateSource','coordinateEpoch','bpRp','bV')
    compact={'meta':metadata,'stars':[{k:s[k] for k in keys if s.get(k) is not None} for s in sky['stars']]}
    (ROOT/'background.json').write_text(json.dumps(compact,ensure_ascii=False,separators=(',',':')))
    (ROOT/'stars.json').write_text(json.dumps(sky,ensure_ascii=False,separators=(',',':')))
    (ROOT/'resolver.json').write_text(json.dumps(resolver,ensure_ascii=False,separators=(',',':')))
    (ROOT/'resolver.named.json').write_text(json.dumps(resolver,ensure_ascii=False,separators=(',',':')))
    (ROOT/'name_resolver.json').write_text(json.dumps(by_name,ensure_ascii=False,separators=(',',':')))
    (ROOT/'iau_name_crosswalk.json').write_text(json.dumps({'source':URL,'names':[{k:v.get(k) for k in ('properName','hip','hr','hd','iauBayer')} for v in names.values()],'rejected':rejected,'acceptedIdentifierMatchesWithPageCoordinateMismatch':coordinate_exceptions},ensure_ascii=False,indent=2))
    (ROOT/'provenance.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
    print(json.dumps({'named':len(names),'rejected':len(rejected),'backgroundBytes':(ROOT/'background.json').stat().st_size,'stars':len(compact['stars'])}))
if __name__=='__main__':main()
