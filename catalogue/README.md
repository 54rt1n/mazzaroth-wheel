# Catalogue snapshots

The committed gzip snapshots supply all catalogue inputs for offline data
rebuilding. `snapshots.json` records compressed and original-content SHA-256
hashes and identifies the original source export.

- `stars.json.gz`: measured star records and catalogue provenance.
- `resolver.json.gz`: complete identifier/name resolver.
- `name_resolver.json.gz`: named-star records used by pole calibration.
- `hipparcos_main.tsv.gz`: original positional rows needed for constellation endpoints.
- `pole_calibration.json`: catalogue positions for the three pole presets.
- Other JSON files: source provenance, naming crosswalk and display-coalescence audit.

Run `npm run resources:build` from the repository root to rebuild the application
data with Python's standard library. No catalogue downloads or SciPy installation
are needed for that operation. Loose snapshots produced by an explicit catalogue
refresh take precedence over the committed gzip inputs and are ignored by Git.

`fetch_catalogues.py` and `enrich_names.py` are optional upstream-refresh tools.
Full catalogue retrieval requires network access and SciPy. Replacing a pinned
snapshot is a reviewed data update: regenerate its checksum manifest and audit
the resulting resource differences. `calibrate_north_pole.py` can use either
loose or compressed snapshots.

[REFERENCE.md](REFERENCE.md) preserves the original catalogue methodology,
source URLs, selection rules, quality limitations and required Gaia credit.
