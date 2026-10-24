#!/usr/bin/env python3
"""Read the existing catalogue snapshot and calibrate its fixed north pole.

Does not retrieve data, alter the background, or model the pole of another date.
"""
import json
import math
import pathlib
import gzip

ROOT = pathlib.Path(__file__).resolve().parent


def main():
    named = json.loads((ROOT / 'name_resolver.json').read_text() if (ROOT / 'name_resolver.json').exists() else gzip.decompress((ROOT / 'name_resolver.json.gz').read_bytes()))
    background = json.loads((ROOT / 'stars.json').read_text() if (ROOT / 'stars.json').exists() else gzip.decompress((ROOT / 'stars.json.gz').read_bytes()))['stars']
    official_gaia = {s['hip']: s for s in background
                     if s.get('hip') and s.get('coordinateSource') == 'Gaia DR2'}
    stars = []
    for name in ('Polaris', 'Kochab', 'Thuban'):
        hip = named[name]
        source = official_gaia.get(hip['hip'], hip)
        assert source['coordinateEpoch'] == 2000.0
        assert source.get('coordinateFrame', 'ICRS') == 'ICRS'
        distance = 90.0 - source['decDeg']
        # Independent vector check: the pole direction is (0,0,1).
        vector_distance = math.degrees(math.acos(math.sin(math.radians(source['decDeg']))))
        assert abs(distance - vector_distance) < 1e-10
        star = {'name': name}
        for key in ('raDeg', 'decDeg', 'mag', 'magBand', 'hip', 'gaiaDr2Id',
                    'coordinateSource', 'coordinateEpoch', 'sourceUrl'):
            star[key] = source.get(key)
        star['coordinateFrame'] = 'ICRS'
        star['angularDistanceToNorthPoleDeg'] = round(distance, 8)
        star['angularDistanceToNorthPoleArcmin'] = round(distance * 60, 8)
        stars.append(star)
    assert 0.735 < stars[0]['angularDistanceToNorthPoleDeg'] < 0.737
    result = {
        'calibration': 'Fixed north coordinate pole of the ICRS chart at stellar position epoch J2000.0',
        'northPole': {'decDeg': 90.0, 'raDeg': None,
                      'rightAscensionNote': 'Right ascension is undefined at the pole; all RA meridians meet there.'},
        'method': 'Angular distance to the north coordinate pole is 90 degrees minus declination. Positions use the existing catalogue snapshot, with its proper-motion propagation to epoch J2000.0.',
        'frameNote': 'The north ICRS coordinate pole is used as the chart reference. The mean equatorial pole at J2000 differs by the small ICRS frame-bias rotation (tens of milliarcseconds), negligible for this display. This is not the true, mean, or apparent pole of the current calendar date.',
        'interpretation': 'Center a north-polar chart on the coordinate pole, not on Polaris. Polaris is about 0.736 degree from this fixed pole. Thuban and Kochab distances here are modern J2000 values and say nothing directly about their distance from an ancient pole.',
        'ancientEpochNote': 'No ancient pole has been computed here. An ancient-sky view requires an appropriate precession model, epoch-specific pole, stellar proper motion, and an explicitly stated date convention.',
        'sourceSelection': 'Prefer an official Gaia DR2 HIP match in the existing background; otherwise use the Hipparcos bright-star anchor. All three calibration stars use Hipparcos because the selected Gaia DR2 subset has no official HIP match for them. No Gaia IDs are inferred from position.',
        'stars': stars,
    }
    (ROOT / 'pole_calibration.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(stars, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
