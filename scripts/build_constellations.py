#!/usr/bin/env python3
"""Build the Ground sky constellation layer from pinned, attributed sources.

Default operation is offline and deterministic. --fetch refreshes the exact
pinned upstream skyculture inputs and supplemental catalogue objects.
Line order, identifiers, membership, and upstream English/native names are
preserved; this is a format conversion, not a reconstruction of ancient lines.
"""
import argparse
import copy
import csv
import hashlib
import io
import json
import math
import pathlib
import urllib.parse
import urllib.request
import zipfile

from resource_io import read_text, read_bytes

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "research" / "skycultures"
REVISION = "0d956aacee305c29a92498860bc394ed21e0e731"
REPOSITORY = "https://github.com/Stellarium/stellarium"
RAW = f"https://raw.githubusercontent.com/Stellarium/stellarium/{REVISION}"
GAIA_ID = "5350358584482202880"
GAIA_QUERY = ("SELECT source_id,ra,dec,ref_epoch,pmra,pmdec,parallax,phot_g_mean_mag,bp_rp "
              f"FROM gaiadr3.gaia_source WHERE source_id={GAIA_ID}")
GAIA_URL = "https://gea.esac.esa.int/tap-server/tap/sync?" + urllib.parse.urlencode(
    {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": GAIA_QUERY})
DSO_NUMBERS = {2632, 5139, 6231, 6475}
DSO_SHA256 = "38a7c8c19b07bb3b2a659769acf4e5611a261732727d8e541c52ce691ab607aa"
HIP_FALLBACK_IDS = {55203, 59273, 78727, 115125}
HIP_FALLBACK_URL = "https://vizier.cds.unistra.fr/viz-bin/asu-tsv?" + urllib.parse.urlencode(
    {"-source": "I/239/hip_main", "-out.all": "1", "HIP": ",".join(map(str, sorted(HIP_FALLBACK_IDS)))})
CUSTOM_FILES = ["research/hebrew/custom.json", "research/iranian/custom.json"]
CONFIG = [
    {"id": "modern", "sourceId": "modern", "label": "Western (modern)",
     "authors": "Stellarium's team", "license": "CC BY-SA 4.0", "licensePath": "by-sa",
     "description": "The 88 modern constellations, with Stellarium's connecting lines; these line figures are a drawing convention, separate from IAU boundaries."},
    {"id": "babylonian", "sourceId": "babylonian_mulapin", "label": "Babylonian (MUL.APIN)",
     "authors": "Susanne M. Hoffmann (constellation lines and names)",
     "license": "CC BY-ND 4.0", "licensePath": "by-nd",
     "description": "Stellarium's 58 MUL.APIN figures reconstructed by Susanne M. Hoffmann, separate from the wheel's Astrolabe B identifications."},
    {"id": "chinese", "sourceId": "chinese", "label": "Chinese (traditional)",
     "authors": "Karrie Berglund; Sun Shuwei", "license": "CC BY-SA 4.0", "licensePath": "by-sa",
     "description": "Stellarium's traditional Chinese Xingguan chart: 312 figures, including single-object figures and three star-cluster centers."},
    {"id": "babylonian_seleucid", "sourceId": "babylonian_seleucid", "label": "Babylonian (Seleucid)",
     "authors": "Susanne M. Hoffmann (constellation lines and names)", "license": "CC BY-ND 4.0", "licensePath": "by-nd",
     "description": "Late Babylonian reconstruction: documented zodiac changes combined with MUL.APIN figures where later evidence is incomplete."},
    {"id": "greek_almagest", "sourceId": "greek_almagest", "label": "Greek (Almagest)",
     "authors": "Alina Schmidt; Lea Jabschinski; Marie von Seggern; Susanne M. Hoffmann", "license": "CC BY-ND 4.0", "licensePath": "by-nd",
     "description": "Stellarium's figures based on Ptolemy's catalogue and descriptions; 49 displayed figures include The Lock alongside the 48 classical constellations."},
    {"id": "egyptian_dendera", "sourceId": "egyptian_dendera", "label": "Egyptian (Dendera)",
     "authors": "Susanne M. Hoffmann", "license": "CC BY-ND 4.0", "licensePath": "by-nd",
     "description": "A reconstruction of the late Greco-Egyptian Dendera zodiac, combining Egyptian, Greek, and Babylonian figures."},
    {"id": "norse_edda", "sourceId": "norse_edda", "label": "Norse (Edda reconstruction)",
     "authors": "Jakob Eyermann, consulting Susanne M. Hoffmann; mentors Sophie Marshall and Susanne M. Hoffmann", "license": "CC BY 4.0", "licensePath": "by",
     "description": "A modern reconstruction from Eddic myths and literary scholarship; several celestial identifications are speculative.",
     "geometryNotice": "The source reconstructs Eddic myths as sky figures. Its celestial identifications include speculation, and its nonstellar shapes use source-defined J2000 outline points, not invented stars."},
    {"id": "navajo", "sourceId": "navajo", "label": "Navajo (Diné)",
     "authors": "Karrie Berglund, Digitalis Education Solutions, Inc., primarily from Don Childrey's Star Trails—Navajo", "license": "GNU GPL v2.0",
     "licenseUrl": "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
     "description": "Eight Navajo figures compiled by Karrie Berglund, primarily from Don Childrey's Star Trails—Navajo; a limited contributor collection."},
]


def digest(path):
    return hashlib.sha256(read_bytes(path)).hexdigest()


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "MazzarothSkyWheel/1.0 (public catalogue data)"})
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read()


def dso_subset(data):
    lines = data.decode("utf-8").splitlines()
    selected = [line for line in lines if line.startswith("#") or
                (line and int(line.split("\t")[16] or 0) in DSO_NUMBERS)]
    return ("\n".join(selected) + "\n").encode("utf-8")


def fetch_sources():
    for config in CONFIG:
        directory = SOURCE / config["sourceId"]
        directory.mkdir(parents=True, exist_ok=True)
        for filename in ("index.json", "description.md"):
            (directory / filename).write_bytes(download(f"{RAW}/skycultures/{config['sourceId']}/{filename}"))
    (SOURCE / "navajo" / "COPYING").write_bytes(download(f"{RAW}/COPYING"))
    (SOURCE / "gaia_dr3_supplement.csv").write_bytes(download(GAIA_URL))
    # VizieR includes retrieval timestamps in response comments. The saved
    # snapshot is the reproducible input; --fetch checks all data rows below.
    original = SOURCE / "hipparcos_missing_main.tsv"
    fresh = download(HIP_FALLBACK_URL)
    if original.exists() and table_rows(original.read_text()) != table_rows(fresh.decode("utf-8")):
        raise ValueError("Published Hipparcos fallback rows changed; inspect before updating snapshot")
    if not original.exists():
        original.write_bytes(fresh)
    dso = download(f"{RAW}/nebulae/default/catalog.txt")
    if hashlib.sha256(dso).hexdigest() != DSO_SHA256:
        raise ValueError("Pinned DSO catalogue hash does not match")
    (SOURCE / "dso_catalog_subset.tsv").write_bytes(dso_subset(dso))


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def table_rows(text):
    lines = [line for line in text.splitlines() if line and not line.startswith("#")]
    headers = lines[0].split("\t")
    return [dict(zip(headers, (value.strip() for value in line.split("\t")))) for line in lines[3:]]


def sexagesimal_positions():
    records = {}
    for row in table_rows((SOURCE / "hipparcos_missing_main.tsv").read_text()):
        hip = int(row["HIP"])
        if hip not in HIP_FALLBACK_IDS or number(row["RAICRS"]) is not None or number(row["DEICRS"]) is not None:
            raise ValueError("Unexpected Hipparcos fallback row")
        h, m, s = map(float, row["RAhms"].split())
        ra = 15 * (h + m/60 + s/3600)
        d, m, s = map(float, row["DEdms"].split())
        dec = (abs(d) + m/60 + s/3600) * (-1 if row["DEdms"].startswith("-") else 1)
        records[hip] = (ra, dec)
    if set(records) != HIP_FALLBACK_IDS:
        raise ValueError("Incomplete sexagesimal Hipparcos fallback")
    return records


def propagate(ra, dec, pmra, pmdec, epoch):
    """Same tangent-vector convention as catalogue/fetch_catalogues.py.

    pmRA is mu_alpha*cos(delta), mas/year. No precession is applied here.
    Missing proper motions retain the native epoch and position.
    """
    if pmra is None or pmdec is None:
        return ra, dec, False
    a, d = math.radians(ra), math.radians(dec)
    k = math.pi / (180 * 3600000) * (2000.0 - epoch)
    v = [math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d)]
    ea = [-math.sin(a), math.cos(a), 0]
    ed = [-math.sin(d) * math.cos(a), -math.sin(d) * math.sin(a), math.cos(d)]
    p = [v[i] + k * (pmra * ea[i] + pmdec * ed[i]) for i in range(3)]
    return math.degrees(math.atan2(p[1], p[0])) % 360, math.degrees(math.atan2(p[2], math.hypot(p[0], p[1]))), True


def hipparcos_records(required):
    lines = [line for line in read_text(ROOT / "catalogue" / "hipparcos_main.tsv").splitlines()
             if line and not line.startswith("#")]
    headers = lines[0].split("\t")
    found = {}
    fallback = sexagesimal_positions()
    for line in lines[3:]:
        row = dict(zip(headers, (value.strip() for value in line.split("\t"))))
        value = number(row.get("HIP"))
        if value is None or int(value) not in required:
            continue
        hip = int(value)
        ra, dec = number(row.get("RAICRS")), number(row.get("DEICRS"))
        uses_locator = ra is None or dec is None
        if uses_locator:
            if hip not in fallback:
                raise ValueError(f"HIP {hip} has no catalogue position")
            ra, dec = fallback[hip]
        pmra, pmdec = number(row.get("pmRA")), number(row.get("pmDE"))
        a, d, moved = propagate(ra, dec, pmra, pmdec, 1991.25)
        found[hip] = {"hip": hip, "raDeg": round(a, 8), "decDeg": round(d, 8),
                      "mag": number(row.get("Vmag")), "magBand": "Johnson V",
                      "coordinateEpoch": 2000.0 if moved else 1991.25,
                      "coordinateFrame": "ICRS", "pmRaMasYr": pmra, "pmDecMasYr": pmdec,
                      "nativeRaDeg": ra, "nativeDecDeg": dec, "nativeEpoch": 1991.25,
                      "properMotionApplied": moved, "coordinateSource": "Hipparcos (ESA 1997)",
                      "sourceUrl": "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239"}
        if uses_locator:
            found[hip].update({"coordinateRole": "published H3/H4 sexagesimal catalogue locator",
                               "coordinateSource": "Hipparcos (ESA 1997), main-table H3/H4 fields",
                               "positionNote": "The Hipparcos astrometric-solution position and proper motion fields are blank. Uses the same HIP record's published lower-precision H3/H4 position at epoch 1991.25; no component substituted and no proper motion inferred."})
    if missing := required - found.keys():
        raise ValueError(f"Missing Hipparcos catalogue endpoints: {sorted(missing)}")
    return found


def endpoint_key(value):
    if isinstance(value, int):
        return f"HIP {value}"
    if isinstance(value, list) and len(value) == 2 and all(number(v) is not None for v in value):
        return "SKY:J2000:" + json.dumps(value, separators=(",", ":"))
    if value == GAIA_ID:
        return f"Gaia DR3 {value}"
    if value in {f"DSO:NGC{number}" for number in DSO_NUMBERS}:
        return value
    raise ValueError(f"Unrecognized source endpoint: {value!r}")


def supplemental_records():
    rows = list(csv.DictReader(io.StringIO((SOURCE / "gaia_dr3_supplement.csv").read_text())))
    if len(rows) != 1 or rows[0]["source_id"] != GAIA_ID:
        raise ValueError("Gaia supplement must contain exactly the requested source")
    row = rows[0]
    ra, dec, epoch = (number(row[k]) for k in ("ra", "dec", "ref_epoch"))
    pmra, pmdec = number(row["pmra"]), number(row["pmdec"])
    a, d, moved = propagate(ra, dec, pmra, pmdec, epoch)
    key = f"Gaia DR3 {GAIA_ID}"
    records = {key: {"id": key, "key": key, "objectType": "star", "gaiaDr3Id": GAIA_ID,
                     "name": "Eta Carinae", "raDeg": round(a, 8), "decDeg": round(d, 8),
                     "mag": number(row["phot_g_mean_mag"]), "magBand": "Gaia G",
                     "bpRp": number(row["bp_rp"]), "coordinateFrame": "ICRS",
                     "coordinateEpoch": 2000.0 if moved else epoch,
                     "pmRaMasYr": pmra, "pmDecMasYr": pmdec,
                     "nativeRaDeg": ra, "nativeDecDeg": dec, "nativeEpoch": epoch,
                     "properMotionApplied": moved, "coordinateSource": "Gaia DR3 (ESA)",
                     "sourceUrl": "https://gea.esac.esa.int/archive/",
                     "positionNote": "Gaia DR3 publishes no proper motion for this source; retained at its native position and epoch."}}
    for line in (SOURCE / "dso_catalog_subset.tsv").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        ngc = int(fields[16])
        if ngc not in DSO_NUMBERS or fields[5] not in {"OC", "GC"}:
            raise ValueError("Unexpected DSO supplement row")
        key = f"DSO:NGC{ngc}"
        ra, dec = float(fields[1]), float(fields[2])
        records[key] = {"id": key, "key": key, "objectType": "cluster", "name": f"NGC {ngc}",
                        "raDeg": ra, "decDeg": dec, "mag": float(fields[4]), "magBand": "Johnson V (integrated)",
                        "coordinateEpoch": 2000.0, "coordinateFrame": "J2000 equatorial",
                        "pmRaMasYr": None, "pmDecMasYr": None,
                        "nativeRaDeg": ra, "nativeDecDeg": dec, "nativeEpoch": 2000.0,
                        "properMotionApplied": False,
                        "coordinateSource": "Stellarium DSO catalogue 3.23 (NGC data from SIMBAD)",
                        "sourceUrl": f"{REPOSITORY}/blob/{REVISION}/nebulae/default/catalog.txt",
                        "positionNote": "Catalogue cluster center, not an individual star; no cluster proper motion applied."}
    if len(records) != 5:
        raise ValueError("Incomplete supplemental endpoint catalogue")
    return records


def section(markdown, heading):
    marker = f"## {heading}\n"
    return markdown.split(marker, 1)[1].split("\n## ", 1)[0].strip()


def tradition_stats(figures):
    lines = [line for figure in figures for line in figure["lines"]]
    return {"constellationCount": len(figures), "polylineCount": len(lines),
            "segmentCount": sum(max(0, len(line)-1) for line in lines),
            "singleObjectCount": sum(len({x for line in f["lines"] for x in line}) == 1 for f in figures),
            "endpointCount": len({x for line in lines for x in line})}


def merge_custom(traditions):
    modern = next(t for t in traditions if t["id"] == "modern")
    reference = {figure["id"]: figure for figure in modern["constellations"]}
    for path in CUSTOM_FILES:
        payload = json.loads((ROOT / path).read_text())
        if payload.get("schemaVersion") != 1:
            raise ValueError(f"Unsupported custom schema: {path}")
        for original in payload["traditions"]:
            tradition = copy.deepcopy(original)
            tradition.setdefault("kind", "research-comparison")
            tradition["source"]["dataSourcePath"] = path
            tradition["source"]["dataSourceSha256"] = digest(ROOT / path)
            for figure in tradition["constellations"]:
                if reference_id := figure.get("referenceModernId"):
                    if "lines" in figure:
                        raise ValueError("Custom reference figure cannot also override lines")
                    figure["lines"] = copy.deepcopy(reference[reference_id]["lines"])
                    figure["geometrySource"] = {"traditionId": "modern", "figureId": reference_id,
                        "authors": modern["source"]["authors"], "license": modern["source"]["license"],
                        "licenseUrl": modern["source"]["licenseUrl"], "url": modern["source"]["url"],
                        "note": "Modern reference geometry for comparison; not an attested ancient outline."}
                if not figure.get("lines") or not all(figure["lines"]):
                    raise ValueError(f"Empty custom figure: {figure['id']}")
            tradition["stats"] = tradition_stats(tradition["constellations"])
            traditions.append(tradition)
    return traditions


def build():
    manifest = json.loads((SOURCE / "manifest.json").read_text())
    for relative, record in manifest["files"].items():
        if digest(SOURCE / relative) != record["sha256"]:
            raise ValueError(f"Source checksum mismatch: {relative}")
    base = json.loads((ROOT / ".data" / "data.json").read_text())
    displayed = {int(star["hip"]): star for star in base["stars"] if star.get("hip")}
    traditions, all_hips, all_keys, free_points = [], set(), set(), {}
    for config in CONFIG:
        source_id = config["sourceId"]
        upstream = json.loads((SOURCE / source_id / "index.json").read_text())
        description = (SOURCE / source_id / "description.md").read_text()
        figures = []
        for figure in upstream["constellations"]:
            name = figure["common_name"]
            lines = [[endpoint_key(value) for value in line] for line in figure["lines"]]
            all_hips.update(value for line in figure["lines"] for value in line if isinstance(value, int))
            all_keys.update(value for line in lines for value in line)
            for line in figure["lines"]:
                for value in line:
                    if isinstance(value, list):
                        key = endpoint_key(value)
                        free_points[key] = {"id": key, "key": key, "objectType": "reference-point",
                            "raDeg": value[0]*15 % 360, "decDeg": value[1], "mag": None, "magBand": "not applicable",
                            "coordinateEpoch": 2000.0, "nativeEpoch": 2000.0, "nativeRaDeg": value[0]*15 % 360,
                            "nativeDecDeg": value[1], "coordinateFrame": "J2000 equatorial",
                            "pmRaMasYr": None, "pmDecMasYr": None, "properMotionApplied": False,
                            "coordinateRole": "source-defined nonstellar outline vertex",
                            "coordinateSource": f"Stellarium {source_id} source coordinate", "sourceCoordinates": value,
                            "sourceUrl": f"{REPOSITORY}/blob/{REVISION}/skycultures/{source_id}/index.json",
                            "positionNote": "A source-defined outline vertex, not a measured star. Source [RA hours, declination degrees] in equinox J2000; no proper motion."}
            converted = {"id": figure["id"], "name": name["english"], "nativeName": name.get("native", ""),
                         "lines": lines, "sourceCommonName": name}
            if "pronounce" in name:
                converted["pronunciation"] = name["pronounce"]
            for field in ("hull_extension", "references"):
                if field in figure:
                    converted["source" + "".join(part.title() for part in field.split("_"))] = figure[field]
            figures.append(converted)
        lines = [line for figure in figures for line in figure["lines"]]
        traditions.append({"id": config["id"], "label": config["label"], "description": config["description"], "kind": "source-tradition",
            "source": {"id": source_id, "url": f"{REPOSITORY}/tree/{REVISION}/skycultures/{source_id}",
                       "descriptionUrl": f"{REPOSITORY}/blob/{REVISION}/skycultures/{source_id}/description.md",
                       "revision": REVISION, "authors": config["authors"],
                       "authorsText": section(description, "Authors"),
                       "license": config["license"], "licenseText": section(description, "License"),
                       "licenseUrl": config.get("licenseUrl") or f"https://creativecommons.org/licenses/{config['licensePath']}/4.0/",
                       "changes": "Mechanical JSON schema/identifier conversion only. All constellation line sequences and English/native names unchanged. Separate asterisms, illustrations and boundaries are not included."},
            "constellations": figures,
            "stats": tradition_stats(figures)})
        if config.get("geometryNotice"):
            traditions[-1]["geometryNotice"] = config["geometryNotice"]
        if config["id"] == "navajo":
            traditions[-1]["source"]["fullLicenseText"] = (SOURCE / "navajo" / "COPYING").read_text()
            traditions[-1]["source"]["sourcePackage"] = "constellation-sources.zip"
    traditions = merge_custom(traditions)
    all_keys = {value for tradition in traditions for figure in tradition["constellations"] for line in figure["lines"] for value in line}
    all_hips = {int(key[4:]) for key in all_keys if key.startswith("HIP ")}
    hip_records = hipparcos_records(all_hips)
    stars = {}
    for hip in sorted(all_hips):
        key = f"HIP {hip}"
        original = displayed.get(hip, hip_records[hip])
        stars[key] = {**original, "id": key, "key": key, "objectType": "star",
                      "catalogueRecordSource": "existing display catalogue" if hip in displayed else "Hipparcos full catalogue supplement"}
    stars.update(supplemental_records())
    stars.update(free_points)
    if set(stars) != all_keys:
        raise ValueError(f"Endpoint registry mismatch: {set(stars) ^ all_keys}")
    return {"schemaVersion": 1,
            "description": "Attributed sky traditions and separately labelled Hebrew/Iranian research comparisons for Ground sky. Measured stars, cluster centres, and source-defined nonstellar outline vertices remain distinct.",
            "coordinateConvention": "Same native-epoch tangent-vector proper-motion convention as the wheel catalogue. The observer renderer performs date-dependent precession once. Unknown proper motions remain null.",
            "provenance": {"stellariumRevision": REVISION,
                           "displayCatalogueSha256": digest(ROOT / ".data" / "data.json"),
                           "hipparcosCatalogueSha256": digest(ROOT / "catalogue" / "hipparcos_main.tsv"),
                           "sourceManifest": "research/skycultures/manifest.json",
                           "supplementalHipCount": len(all_hips - displayed.keys()),
                           "sexagesimalHipLocatorIds": sorted(HIP_FALLBACK_IDS),
                           "nonHipEndpointCount": len(stars)-len(all_hips),
                           "sourcePackage": "constellation-sources.zip",
                           "customSources": {path: digest(ROOT / path) for path in CUSTOM_FILES}},
            "stars": stars, "traditions": traditions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="re-download pinned upstream files before building")
    parser.add_argument("--check", action="store_true", help="verify the committed output equals a fresh offline build")
    args = parser.parse_args()
    if args.fetch:
        fetch_sources()
    (ROOT / ".data").mkdir(exist_ok=True)
    dataset = build()
    content = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
    destination = ROOT / ".data" / "constellations.json"
    if args.check:
        if destination.read_text() != content:
            raise SystemExit("constellations.json differs from its reproducible build")
    else:
        destination.write_text(content)
    archive = source_archive_bytes(dataset)
    archive_path = ROOT / ".data" / "constellation-sources.zip"
    if args.check:
        if archive_path.read_bytes() != archive:
            raise SystemExit("constellation-sources.zip differs from its reproducible build")
    else:
        archive_path.write_bytes(archive)
    print(json.dumps({"stars": len(dataset["stars"]), "traditions": {t["id"]: t["stats"] for t in dataset["traditions"]},
                      "supplementalHipCount": dataset["provenance"]["supplementalHipCount"]}, indent=2))


def source_archive_bytes(dataset):
    """An edit-ready data source bundle, including the full Navajo GPL license."""
    files = {
        "constellations.json": (json.dumps(dataset, ensure_ascii=False, indent=2, allow_nan=False)+"\n").encode(),
        "endpoint-catalogue.json": (json.dumps(dataset["stars"], ensure_ascii=False, indent=2, allow_nan=False)+"\n").encode(),
        "README.txt": ("Mazzaroth constellation data sources\n\n"
            "This archive supplies the preferred, editable JSON form of all displayed line datasets, "
            "their complete endpoint coordinates, original upstream skyculture files, custom research "
            "compilations, source notices, and licenses. No illustrations are included.\n\n"
            "Each tradition retains its own license; this is a collection of independent data sets. "
            "In particular, the Navajo data is under GNU GPL version 2, with the complete license in "
            "research/skycultures/navajo/COPYING. Modified data is also supplied here as editable JSON: "
            "the only changes to official source line sequences are mechanical schema and identifier conversion. "
            "Custom Hebrew/Iranian comparisons are separately credited and preserve their research limitations.\n\n"
            "The combined constellations.json and endpoint-catalogue.json can be edited or consumed directly. "
            "The included project builder documents the conversion and validation, and expects the "
            "Mazzaroth project's base catalogue files when run inside the full source checkout. "
            "The full project catalogue is not needed to read, edit, or use these complete normalized data files.\n").encode(),
    }
    paths = [ROOT / "LICENSE", ROOT / "NOTICE", ROOT / "THIRD_PARTY_NOTICES.md", ROOT / "scripts" / "resource_io.py", SOURCE / "manifest.json", ROOT / "research" / "constellations.md",
             ROOT / "scripts" / "build_constellations.py", ROOT / "scripts" / "validate_constellations.py"]
    paths += [SOURCE / relative for relative in json.loads((SOURCE / "manifest.json").read_text())["files"]]
    paths += [SOURCE / config["sourceId"] / "LICENSE.txt" for config in CONFIG]
    paths += [ROOT / path for path in CUSTOM_FILES]
    for name in ("hebrew-constellations.md", "iranian-constellations.md"):
        if (ROOT / "research" / name).exists():
            paths.append(ROOT / "research" / name)
    for path in paths:
        files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data, compresslevel=9)
    return stream.getvalue()


if __name__ == "__main__":
    main()
