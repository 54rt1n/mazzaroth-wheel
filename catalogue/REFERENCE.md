# Catalogue subset for the Mazzaroth research wheel

This folder contains measured modern star positions and identifiers. Historical constellation identifications and their illustrative anchors are a separate research layer. A modern representative star does not establish an ancient identification.

## Reproduce

Python 3 and SciPy are required. From the project directory:

```bash
python catalogue/fetch_catalogues.py
python catalogue/enrich_names.py
```

Downloads are cached by filename. To retrieve a fresh snapshot, remove the relevant raw cached file first. Exact retrieval URLs and Gaia ADQL are in `provenance.json` and `fetch_catalogues.py`. Gaia source IDs are strings to avoid JavaScript integer precision loss.

## Sources and output

- Gaia DR2: ESA TAP, magnitude selection `phot_g_mean_mag <= 6.5`; official `gaiadr2.hipparcos2_best_neighbour` supplies HIP identifiers where present. Raw: `gaia_dr2_bright.csv`.
- Hipparcos: ESA 1997, CDS/VizieR I/239/hip_main. Complete available positional rows are retained in the resolver; Johnson V ≤ 6.5 rows without an official match in the selected Gaia subset supplement the display. Raw: `hipparcos_main.tsv`.
- Bright Star Catalogue, fifth revised edition: Hoffleit and Warren, CDS V/50. HR, HD, Bayer/Flamsteed identifiers enrich the resolver. HD links the BSC and Hipparcos records. Raw: `bsc5_catalog.gz`; fixed-width specification: `bsc_ReadMe`.
- IAU Working Group on Star Names: https://exopla.net/star-names/modern-iau-star-names/ . Only scientific labels and identifiers are reused. Names require a matching HIP and a page position within one arcminute, or matching independent HIP and HR identifiers. Some page positions do not agree with those identifiers; exceptions and rejections are explicit in `iau_name_crosswalk.json`. Chart positions always come from the astronomical catalogues.

`stars.json` has `{meta, stars}` and full source fields; `background.json` is its compact browser version. `resolver.json` and `resolver.named.json` contain lookup maps. `name_resolver.json` contains the `byName` map alone. `anchor_resolver.json` resolves all 70 names currently referenced by the separate 36-entry historical dataset.

## Counts and display coalescence

The Gaia query returned 12,200 unique source IDs. A further 3,010 bright Hipparcos rows lack an official HIP match in that Gaia subset. Many still have nearby Gaia points. To avoid drawing overlapping markers, the display retains each fallback HIP marker and suppresses Gaia points within 3 arcseconds. This suppresses 2,715 Gaia display rows, yielding 9,485 Gaia plus 3,010 Hipparcos markers: 12,495 total.

This operation is **display-only positional coalescence**, not a new physical crossmatch. It does not assign Gaia IDs to unmatched HIP sources. Close components can be merged at this display scale. Raw Gaia rows remain intact, and `display_deduplication.json` records every suppression pair, original identifiers, angular separation and the two native magnitudes. The raw source IDs, displayed source IDs, and displayed HIP identifiers were checked for uniqueness.

## Coordinates and photometry

Gaia native positions use ICRS at reference epoch J2015.5. Hipparcos native positions use ICRS at epoch J1991.25. Both are propagated to epoch J2000 with linear tangent-vector proper motion using μᵅ cos δ and μδ. Original positions, reference epoch and motion remain in the full records. This preserves the ICRS axes; it is not an equinox conversion or reconstruction of an ancient sky. Annual parallax, radial-velocity perspective effects and precession to an ancient epoch are not modeled. BSC-only resolver entries remain explicitly labeled FK5/J2000.

155 of the raw Gaia rows have no proper motion; 114 remain in the displayed subset. Their positions retain epoch J2015.5, explicitly recorded per row. Other displayed entries have been propagated to J2000.

The Gaia selection applies no astrometric or photometric quality filter. Gaia DR2 is incomplete for the brightest stars, and individual bright-source solutions or magnitudes may be problematic. Gaia G and Johnson V are different passbands. The combined selection is not a uniform visual-magnitude catalogue, and marker sizes are illustrative.

## Requested credit

This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

- Gaia Collaboration et al. (2016), description of the Gaia mission: https://doi.org/10.1051/0004-6361/201629272
- Gaia Collaboration et al. (2018), Gaia DR2 summary of contents and survey properties: https://doi.org/10.1051/0004-6361/201833051
- ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200, CDS I/239: https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239
- Hoffleit and Warren, *Bright Star Catalogue, 5th Revised Ed.*, CDS V/50: https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50
- Gaia DR2 source-table documentation: https://gea.esac.esa.int/archive/documentation/GDR2/Gaia_archive/chap_datamodel/sec_dm_main_tables/ssec_dm_gaia_source.html
- Gaia DR2 official HIP crossmatch documentation: https://gea.esac.esa.int/archive/documentation/GDR2/Gaia_archive/chap_datamodel/sec_dm_crossmatches/ssec_dm_hipparcos2_best_neighbour.html
