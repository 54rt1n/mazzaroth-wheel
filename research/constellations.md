# Ground sky constellation datasets

Eight selectable traditions reproduce Stellarium's existing line figures. Four separately labelled Hebrew and Iranian modes are sourced research comparisons, not recovered ancient line charts. These figures are a comparative overlay; they do not change the wheel's Astrolabe B entries or establish historical identifications. Connecting lines are drawing conventions, not modern IAU boundaries or measurements recovered from ancient diagrams.

## Source snapshot and credit

All eight source skycultures use official [Stellarium](https://github.com/Stellarium/stellarium) commit `0d956aacee305c29a92498860bc394ed21e0e731`. The complete upstream `index.json` and `description.md` are retained under `research/skycultures/`, together with the exact License section extracted as `LICENSE.txt`. SHA-256 hashes and original URLs are in `research/skycultures/manifest.json`.

| Selection | Upstream directory | Figures | Source segments | Unique objects | Credit | Data license |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Western (modern) | `modern` | 88 | 695 | 710 | Stellarium's team | CC BY-SA 4.0 |
| Babylonian (MUL.APIN) | `babylonian_mulapin` | 58 | 499 | 491 | Susanne M. Hoffmann | CC BY-ND 4.0 |
| Chinese (traditional) | `chinese` | 312 | 1,153 | 1,406 | Karrie Berglund; Sun Shuwei | CC BY-SA 4.0 |
| Babylonian (Seleucid) | `babylonian_seleucid` | 60 | 595 | 583 | Susanne M. Hoffmann | CC BY-ND 4.0 |
| Greek (Almagest) | `greek_almagest` | 49 | 883 | 855 | Alina Schmidt; Lea Jabschinski; Marie von Seggern; Susanne M. Hoffmann | CC BY-ND 4.0 |
| Egyptian (Dendera) | `egyptian_dendera` | 34 | 424 | 427 | Susanne M. Hoffmann | CC BY-ND 4.0 |
| Norse (Edda reconstruction) | `norse_edda` | 19 | 140 | 135 | Jakob Eyermann; Susanne M. Hoffmann; Sophie Marshall | CC BY 4.0 |
| Navajo (Diné) | `navajo` | 8 | 131 | 126 | Karrie Berglund; primarily Don Childrey's *Star Trails—Navajo* | GNU GPL v2.0 |

The data is distributed under those respective upstream licenses. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/) links, original author statements, license statements and pinned source URLs are embedded in the dataset for the online and offline credits.

The conversion preserves every constellation's original identifier, English name, native name, pronunciation where supplied, common-name metadata, line order and endpoint sequence. Numeric HIP references become explicit `HIP n` keys; the one Gaia identifier gains a `Gaia DR3` prefix. No source line connections have been added, omitted, simplified, or reconstructed. Source `hull_extension` metadata is preserved separately as `sourceHullExtension` and is not drawn as extra connections. The upstream source's separate `asterisms`, illustration assets and boundary arrays are outside this layer. No artwork is included.

The Babylonian set is Hoffmann's published Stellarium reconstruction of MUL.APIN, a separate source from the wheel's Astrolabe B list. The Chinese set is Stellarium's composite traditional chart described in its source documentation, not a claim to represent all Chinese periods with one ancient chart.

## Coordinates and exceptional objects

There are 1,912 unique endpoint records across the twelve modes: 1,889 HIP stars, one Gaia star, four cluster centers, and eighteen source-defined nonstellar outline points. Existing displayed HIP catalogue records are reused where available, so their coordinates and magnitudes match the wheel. Ninety-two HIP records supplement the displayed star catalogue from the full local ESA Hipparcos main table. Proper motions use the same tangent-vector convention as `catalogue/fetch_catalogues.py`: `pmRaMasYr` means mu-alpha times cos(delta); no precession is applied in the build. The observer renderer propagates native epoch positions and applies its date-dependent rotation once.

Four HIP records (55203, 59273, 78727, 115125) have blank numeric astrometric-solution coordinates in Hipparcos. The original main table still supplies their own H3/H4 sexagesimal positions in ICRS at epoch 1991.25. These published catalogue locators are preserved at their available precision, with measured V magnitudes and null proper motions. Each record explicitly labels this coordinate role and limitation. No binary component or nearby star was substituted. The complete queried rows are preserved in `hipparcos_missing_main.tsv`.

Chinese Sea and Mountain includes Eta Carinae as `Gaia DR3 5350358584482202880`. The exact source row is fetched from ESA's Gaia DR3 archive and retained in `gaia_dr3_supplement.csv`. It has G magnitude 4.034632 and native epoch 2016.0; proper-motion values are unavailable in that row and remain null, rather than being invented or inferred from another release.

Three Chinese figures use cluster centers NGC 2632, NGC 6231, and NGC 6475; the Greek Almagest figure of the Centaur also uses the globular cluster NGC 5139 (Omega Centauri). Their J2000 positions and integrated V magnitudes are copied from the same pinned Stellarium DSO catalogue 3.23, which credits NGC/IC data to SIMBAD. Exact rows and the source header are in `dso_catalog_subset.tsv`; its manifest records both the full upstream file hash and the subset hash. They have `objectType: "cluster"`, are not individual stars, and have no fabricated proper motion. The catalogue compilation's [original credits](https://github.com/Stellarium/stellarium/blob/0d956aacee305c29a92498860bc394ed21e0e731/CREDITS.md) and [loader's J2000 convention](https://github.com/Stellarium/stellarium/blob/0d956aacee305c29a92498860bc394ed21e0e731/src/core/modules/NebulaMgr.cpp) document those inputs.

There are two Babylonian and 57 Chinese figures with only one distinct endpoint. Upstream typically encodes them as a repeated pair `[id, id]`. Those pairs are retained exactly and should be shown as an object marker/label rather than an invented line. One Chinese multi-object figure also contains a repeated endpoint line, so count degenerate polylines separately from single-object figures when validating a renderer.

## Build and validate

```bash
python scripts/build_constellations.py
python scripts/validate_constellations.py
python scripts/build_constellations.py --check
```

The default build is deterministic and requires no network. `--fetch` re-downloads the pinned source files, the Gaia record and the exact DSO subset; it verifies their saved hashes during the build. It also checks the published Hipparcos fallback data rows against the saved snapshot while retaining the original timestamped VizieR response. Changes to source content require an explicit reviewed manifest update. Unresolved endpoint IDs, missing coordinates and checksum mismatches fail the build.

`dist/constellations.json` has `schemaVersion: 1`, a `stars` endpoint registry keyed by stable catalogue identifiers, and a `traditions` array. Each tradition has source attribution, statistics and constellations with English `name`, `nativeName` and `lines`. Registry keys are not limited to HIP: Gaia and DSO references remain explicit. Despite the historical `stars` registry name, cluster records must be respected as clusters by consumers.

## Added source traditions and limits

The Seleucid set is a reconstruction of later Babylonian arrangements. Its author explains that later zodiac changes are documented but much of the rest of the sky is retained from MUL.APIN where evidence is incomplete. The Almagest set displays 49 figures because it adds The Lock to the 48 classical constellations described in Ptolemy's catalogue; do not call it Ptolemy's “49 constellations.” The Dendera set is specifically a late Greco-Egyptian composite, not a Bronze Age Egyptian chart.

The Norse Edda set is a modern scholarly reconstruction by Jakob Eyermann consulting Susanne M. Hoffmann, with mentorship from Sophie Marshall and Hoffmann. Its source explicitly describes some celestial identifications as speculative. Eighteen free-coordinate vertices encode nonstellar shapes. Their [RA hours, declination degrees] are in equinox J2000, according to Stellarium's pinned `guide/ch_skycultures.tex`. They are retained as `objectType: "reference-point"`, have null magnitudes and motions, and must never be rendered as individual stars. This is distinct from the older six-figure Norse contributor collection, which is not selected here.

The Navajo set is the eight-figure contributor collection by Karrie Berglund, primarily based on Don Childrey's *Star Trails—Navajo*. It is not described as a complete chart or as a Navajo Nation-authored dataset. Upstream does not supply Diné-language names for these figures; none have been invented. Its GNU GPL version 2 declaration and full license are preserved, with the preferred editable data source included in `dist/constellation-sources.zip`.

## Hebrew and Iranian research comparisons

The custom source files are `research/hebrew/custom.json` and `research/iranian/custom.json`. Their revisions, bibliographic links, per-figure evidence, identification status, geometry notices, and unlocated entries survive unchanged in the combined dataset. See `research/hebrew-constellations.md` and `research/iranian-constellations.md` for detailed sourcing.

| Mode | Located figures | Geometry |
| --- | ---: | --- |
| Hebrew biblical names | 2 | Disconnected catalogue member markers for the conventional Pleiades and Orion identifications |
| Hebrew medieval zodiac | 12 | Explicitly borrowed modern reference figures with the sourced Hebrew zodiac names |
| Zoroastrian / Avestan stellar names | 3 | Disconnected member markers for sourced identifications; disputed names remain unlocated |
| Zoroastrian / Bundahishn zodiac | 12 | Explicitly borrowed modern reference figures with sourced Middle Persian names |

The modern reference line sequences in the two zodiac comparisons remain under Stellarium's CC BY-SA 4.0 data license, with per-figure geometry attribution. This does not claim Hebrew or Iranian sources preserved those stick figures. The builder resolves `referenceModernId` into the exact referenced Western line sequences without inventing separate ancient geometry. Biblical and Avestan member markers are disconnected singleton lines, and unresolved entries never acquire arbitrary coordinates.

## Editable source download

The online and offline atlas can download the complete editable dataset JSON. `dist/constellation-sources.zip` additionally contains the raw upstream line JSON and descriptions, all source notices, the full Navajo GNU GPLv2 license, custom compilations, complete normalized endpoint coordinates, and the conversion/validation scripts. It is a source-data collection; each tradition retains its own license. The full project builder expects the project's base catalogue inputs, while the normalized JSON in the archive is complete and directly usable without the full catalogue.

The builder writes the JSON and source ZIP deterministically, with fixed ZIP timestamps. `--check` verifies both outputs. Validation treats official source geometry and custom research mappings separately: exact source names/connectivity for official sets, complete evidence preservation and exact modern geometry references for custom modes.
