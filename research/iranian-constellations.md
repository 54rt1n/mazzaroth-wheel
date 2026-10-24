# Iranian / Zoroastrian comparison layers

Reviewed 2026-10-24. Machine-readable input: `research/iranian/custom.json`.

Two textual traditions are kept separate. Neither layer claims to reproduce a recovered star map of the Magi. The name “Magi” is not used as the title of an invented constellation system. The material selected here comes from Avestan and Middle Persian sources, with modern scholarship used for astronomical identification.

## Avestan stellar names

| Name | Display | Evidence and limits |
|---|---|---|
| Tištrya | Sirius, HIP 32349 | Yašt 8; identification discussed by Panaino, *Tištrya*. One actual star marker. |
| Haptōiringa | Seven Big Dipper stars | Yašt 8.12; identification discussed by Panaino, *Haftōrang*. Unconnected modern member markers, not an asserted Avestan outline. |
| Paoiryaēinyas | Pleiades cluster reference members | Yašt 8.12; identification discussed by MacKenzie, *Constellations*. The atlas’s nine reference members locate the cluster; their number is a display choice. |
| Vanant | Unplotted; candidate Vega retained in evidence | Yašt 8.12 and the scholarly identification cited in Schmidt, *Mithra i*. An unresolved record avoids silently equating textual periods. |
| Satavaēsa | Unplotted; candidate Fomalhaut retained in evidence | Yašt 8.0 and 8.9; Panaino describes Fomalhaut as a probable identification. |

The three plotted figures comprise 17 unique catalogue endpoints. All endpoints are already present in the base atlas catalogue. Every line is a singleton: the renderer shows rings without invented connecting strokes. The two unplotted records have no coordinate or geometry fields. These are a curated subset of attested names, not a claim to exhaust the Avestan sky.

Primary text: [Yašt 8, Avestan, after Geldner](https://www.avesta.org/ka/yt8.htm), especially 8.0, 8.9, 8.12. The English [Darmesteter translation](https://www.avesta.org/ka/yt8sbe.htm) is useful for comparison; native-name identification is checked against the Avestan text and scholarly discussion.

## Bundahishn zodiac

The twelve names and correspondences follow **Bundahishn 2.2 in E. W. West’s translation**, whose transliteration is retained. The source is a Middle Persian tradition preserved through medieval recensions. The display does not assign it an Achaemenid date.

| West’s name | Modern comparison figure |
|---|---|
| Varak | Aries |
| Tora | Taurus |
| Do-patkar | Gemini |
| Kalachang | Cancer |
| Sher | Leo |
| Khushak | Virgo |
| Tarazhuk | Libra |
| Gazdum | Scorpius |
| Nimasp | Sagittarius |
| Vahik | Capricornus |
| Dul | Aquarius |
| Mahik | Pisces |

The text supplies names, not the modern star-to-star geometry used for visual comparison. These figures are not equal 30° sign sectors. The Virgo record also preserves the scholarly note concerning hōšag and Spica; Nimasp refers here to Sagittarius, not the separate modern constellation Centaurus.

Primary source: [Bundahishn, chapter 2](https://www.avesta.org/mp/bundahis.html). The catalogue retains the base document URL because fragment conventions may change. Modern reference lines are copied from the existing pinned Stellarium `modern` set, revision `0d956aacee305c29a92498860bc394ed21e0e731`, with per-figure geometry attribution supplied by the builder.

## Sources and reuse

- D. N. MacKenzie, [“Constellations”](https://www.iranicaonline.org/articles/constellations/), *Encyclopaedia Iranica*, 1992, VI/2, pp. 147–150.
- Antonio Panaino, [“Tištrya”](https://www.iranicaonline.org/articles/tistrya-2/), *Encyclopaedia Iranica*, 2005.
- Antonio Panaino, [“Haftōrang”](https://www.iranicaonline.org/articles/haftorang/), *Encyclopaedia Iranica*, 2002, XI/5, pp. 533–534.
- Hanns-Peter Schmidt, [“Mithra i”](https://www.iranicaonline.org/articles/mithra-i/), *Encyclopaedia Iranica*, 2006; reference to Vanant at Yašt 21.1.
- Antonio Panaino, [“Zodiac”](https://www.iranicaonline.org/articles/zodiac/), *Encyclopaedia Iranica*, 2009.
- M. A. Dandamayev, [“Magi”](https://www.iranicaonline.org/articles/magi/), *Encyclopaedia Iranica*; contextual reference, not a source of constellation outlines.
- [Stellarium modern skyculture](https://github.com/Stellarium/stellarium/tree/0d956aacee305c29a92498860bc394ed21e0e731/skycultures/modern), Stellarium’s team, CC BY-SA 4.0.

Original selection, notes and arrangement in these comparison layers are available under CC BY-SA 4.0. Ancient names and factual identifications are not claimed as proprietary. Modern reference geometry retains Stellarium’s attribution and license. The linked scholarship and electronic editions retain their own copyrights; their full text is not redistributed here.

## Integration checks

The builder should preserve `kind`, `period`, `geometryNotice`, `status`, `evidence`, `notes`, `sources`, and `unlocated`. It resolves each `referenceModernId` to the exact modern polyline arrays and records their separate geometry source. The UI must show the geometry notice and make the evidence for each figure available. Unlocated names must remain visible in evidence lists without receiving invented positions.
