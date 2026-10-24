#!/usr/bin/env python3
"""Validate scientific endpoints, source fidelity, attribution and reproducibility."""
import json
import math
import pathlib
import zipfile

import build_constellations as builder

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED = {
    "modern": (88, 219, 695, 710),
    "babylonian": (58, 165, 499, 491),
    "chinese": (312, 423, 1153, 1406),
    "babylonian_seleucid": (60, 185, 595, 583),
    "greek_almagest": (49, 253, 883, 855),
    "egyptian_dendera": (34, 132, 424, 427),
    "norse_edda": (19, 133, 140, 135),
    "navajo": (8, 40, 131, 126),
    "hebrew_biblical": (2, 16, 0, 16),
    "hebrew_zodiac": (12, 47, 143, 143),
    "zoroastrian_avestan": (3, 17, 0, 17),
    "zoroastrian_bundahishn": (12, 47, 143, 143),
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def main():
    dataset = json.loads((ROOT / ".data" / "constellations.json").read_text())
    require(dataset["schemaVersion"] == 1, "Unsupported schema")
    require([t["id"] for t in dataset["traditions"]] == list(EXPECTED), "Traditions/order changed")
    stars = dataset["stars"]
    endpoint_keys = set()
    modern = {f["id"]: f for f in dataset["traditions"][0]["constellations"]}
    custom = {t["id"]: t for path in builder.CUSTOM_FILES
              for t in json.loads((ROOT / path).read_text())["traditions"]}
    for tradition in dataset["traditions"]:
        source = tradition["source"]
        actual = tradition["constellations"]
        require(len({c["id"] for c in actual}) == len(actual), "Duplicate figure ID")
        if tradition["id"] in custom:
            original_tradition = custom[tradition["id"]]
            require(len(actual) == len(original_tradition["constellations"]), "Custom figure omitted")
            for key, value in original_tradition.items():
                if key not in {"source", "constellations"}:
                    require(tradition[key] == value, f"Custom tradition evidence changed: {key}")
            for key, value in original_tradition["source"].items():
                require(source[key] == value, f"Custom provenance changed: {key}")
            for figure, original in zip(actual, original_tradition["constellations"]):
                for key, value in original.items():
                    require(figure[key] == value, f"Custom figure evidence changed: {figure['id']}/{key}")
                if reference := original.get("referenceModernId"):
                    require(figure["lines"] == modern[reference]["lines"], "Modern comparison geometry changed")
                    require(figure["geometrySource"]["license"] == "CC BY-SA 4.0", "Modern geometry credit absent")
                else:
                    require(all(len(line) == 1 for line in figure["lines"]), "Invented historical outline")
            for unlocated in tradition.get("unlocated", []):
                require(not any(k in unlocated for k in ("lines", "raDeg", "decDeg", "referenceModernId")),
                        "Unlocated tradition entry given invented geometry")
            require(source["dataSourceSha256"] == builder.digest(ROOT / source["dataSourcePath"]), "Custom source hash mismatch")
        else:
            raw = json.loads((builder.SOURCE / source["id"] / "index.json").read_text())
            require(len(actual) == len(raw["constellations"]), "Source figure omitted")
            for figure, original in zip(actual, raw["constellations"]):
                require(figure["id"] == original["id"], "Figure ID/order changed")
                require(figure["name"] == original["common_name"]["english"], "English name changed")
                require(figure["nativeName"] == original["common_name"].get("native", ""), "Native name changed")
                require(figure["sourceCommonName"] == original["common_name"], "Name metadata changed")
                expected = [[builder.endpoint_key(value) for value in line] for line in original["lines"]]
                require(figure["lines"] == expected, "Source connectivity/order changed")
                if "hull_extension" in original:
                    require(figure["sourceHullExtension"] == original["hull_extension"], "Hull extension metadata omitted")
            require(source["revision"] == builder.REVISION, "Unpinned source")
        for figure in actual:
            require(figure["lines"] and all(figure["lines"]), "Empty line figure")
            for line in figure["lines"]:
                for key in line:
                    require(key in stars, f"Unresolved endpoint: {key}")
                    endpoint_keys.add(key)
        lines = [line for figure in actual for line in figure["lines"]]
        counts = (len(actual), len(lines), sum(len(line)-1 for line in lines), len({x for line in lines for x in line}))
        require(counts == EXPECTED[tradition["id"]], f"Unexpected source counts: {counts}")
        for field in ("url", "descriptionUrl", "revision", "authors", "authorsText", "license", "licenseUrl", "licenseText", "changes"):
            require(bool(source.get(field)), f"Attribution field absent: {field}")
    require(endpoint_keys == set(stars), "Unused or missing endpoint records")
    require(len(stars) == 1912, "Unexpected endpoint count")
    require(sum(s["objectType"] == "cluster" for s in stars.values()) == 4, "Cluster centers mislabeled")
    require(sum(s["objectType"] == "reference-point" for s in stars.values()) == 18, "Nonstellar outline points mislabeled")
    for key, star in stars.items():
        require(star["id"] == key == star["key"], f"Registry ID mismatch: {key}")
        require(finite(star["raDeg"]) and 0 <= star["raDeg"] < 360, f"Bad RA: {key}")
        require(finite(star["decDeg"]) and -90 <= star["decDeg"] <= 90, f"Bad declination: {key}")
        require(finite(star["nativeEpoch"]) and finite(star["coordinateEpoch"]), f"Missing epoch: {key}")
        require(star.get("mag") is None or finite(star["mag"]), f"Bad magnitude: {key}")
        require(star.get("coordinateSource") and star.get("magBand"), f"Missing coordinate/photometry attribution: {key}")
        for field in ("pmRaMasYr", "pmDecMasYr"):
            require(star.get(field) is None or finite(star[field]), f"Invalid proper motion: {key}")
        if key.startswith("HIP "):
            require(star["hip"] == int(key[4:]), f"HIP identity mismatch: {key}")
        if star["objectType"] == "reference-point":
            ra_hours, dec_degrees = star["sourceCoordinates"]
            require(star["raDeg"] == ra_hours*15 % 360 and star["decDeg"] == dec_degrees,
                    "Nonstellar source coordinates converted with wrong units")
            require(star["mag"] is None and star["pmRaMasYr"] is None and star["pmDecMasYr"] is None,
                    "A nonstellar outline point became a measured star")
        a, d, moved = builder.propagate(star["nativeRaDeg"], star["nativeDecDeg"],
                                        star.get("pmRaMasYr"), star.get("pmDecMasYr"), star["nativeEpoch"])
        require(abs((a-star["raDeg"]+180)%360-180) < 1e-7 and abs(d-star["decDeg"]) < 1e-7,
                f"Coordinate/epoch convention mismatch: {key}")
        require(star["coordinateEpoch"] == (2000 if moved else star["nativeEpoch"]), f"Position epoch mismatch: {key}")
    for hip in builder.HIP_FALLBACK_IDS:
        star = stars[f"HIP {hip}"]
        require(star["nativeEpoch"] == 1991.25 and star["pmRaMasYr"] is None and star["pmDecMasYr"] is None,
                "Unmeasured motion inferred for catalogue locator")
        require(star.get("coordinateRole") == "published H3/H4 sexagesimal catalogue locator", "Catalogue fallback not disclosed")
    require(dataset == builder.build(), "Offline reproduction differs")
    navajo = next(t for t in dataset["traditions"] if t["id"] == "navajo")
    require("Version 2, June 1991" in navajo["source"]["fullLicenseText"], "Full GNU GPLv2 text absent")
    with zipfile.ZipFile(ROOT / ".data" / "constellation-sources.zip") as archive:
        require(json.loads(archive.read("constellations.json")) == dataset, "Source archive dataset mismatch")
        require(json.loads(archive.read("endpoint-catalogue.json")) == stars, "Source archive endpoints mismatch")
        require(archive.read("research/skycultures/navajo/index.json") == (builder.SOURCE / "navajo" / "index.json").read_bytes(), "Preferred Navajo source missing")
        require(archive.read("research/skycultures/navajo/COPYING").decode() == navajo["source"]["fullLicenseText"], "GPL license missing from source download")
    require((ROOT / ".data" / "constellation-sources.zip").read_bytes() == builder.source_archive_bytes(dataset), "Source archive not reproducible")
    print("PASS: 12 traditions; 657 figures; 4,806 adjacent source pairs; 1,912 resolved endpoints; exact official names/connectivity; custom evidence preserved; epochs/motions; attribution; reproducible data and source archive.")


if __name__ == "__main__":
    main()
