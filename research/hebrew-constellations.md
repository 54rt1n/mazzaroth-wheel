# Hebrew comparison layers

Compiled 2026-10-24. Machine-readable source: `research/hebrew/custom.json`; bibliographic record: `research/hebrew/sources.json`.

This is a new textual comparison compilation. It is not a recovered biblical sky atlas, and it does not present later Hebrew zodiac nomenclature as evidence for a complete biblical constellation system. The two selectable layers keep those sources separate.

## Hebrew (biblical names)

The plotted figures are two traditional identifications found in JPS 1917 translations of Job 9:9, Job 38:31, and Amos 5:8. Their Hebrew names are attested directly in those passages. The catalogued stars are chosen modern locators for the interpreted groups; the texts do not transmit the selected memberships or line figures.

| Record | Treatment | Evidence |
| --- | --- | --- |
| Kīmāh, כימה | Nine unconnected Pleiades-member locator rings | Job 9:9; Job 38:31; Amos 5:8. JPS 1917 renders the name as Pleiades. |
| Kəsīl, כסיל | Seven unconnected Orion-member locator rings | The same passages; JPS 1917 renders the name as Orion. |
| ʿAsh / ʿAyish, עש / עיש | Unlocated; disputed | Job 9:9 and 38:32. JPS 1917 uses Bear; Berakhot 58b:15 preserves different identifications in Aries or Taurus. |
| Mazzaroth, מזרות | Unlocated; referent unresolved in this compilation | Job 38:32 does not supply a membership list or geometry. No equation with the atlas's thirty-six calendar entries or its medieval zodiac layer is made. |
| Chambers of the south, חדרי תמן | Unlocated region | Job 9:9 does not identify a bounded star figure. |

The Pleiades points are the same nine measured members used by the atlas's existing Pleiades locator: HIP 17702, 17847, 17499, 17573, 17608, 17531, 17851, 17489, and 17579. The Orion points are HIP 27989, 25336, 26727, 26311, 25930, 24436, and 27366. The new layer adds no synthetic star. It intentionally connects none of these points with lines.

Berakhot 58b:12–16 was checked through the Sefaria text API, in addition to the linked public page. The record's English annotations are our paraphrases; the copyrighted modern translation is not reproduced. That later discussion is evidence of interpretive variation, not a reason to relocate the biblical figures with unwarranted precision.

Primary sources:

- [Job 9:9, Hebrew and JPS 1917](https://mechon-mamre.org/p/pt/pt2709.htm)
- [Job 38:31–32, Hebrew and JPS 1917](https://www.mechon-mamre.org/p/pt/pt2738.htm)
- [Amos 5:8, Hebrew and JPS 1917](https://www.mechon-mamre.org/p/pt/pt1505.htm)
- [Babylonian Talmud, Berakhot 58b:12–16](https://www.sefaria.org/Berakhot.58b.12-16)

## Hebrew (medieval zodiac)

Maimonides supplies a complete Hebrew list in *Foundations of the Torah* 3:6–7. The Mechon Mamre page gives the name list in its displayed paragraph 7, with conventional numbering [6], and the distinction between zodiac divisions and moving stellar figures in displayed paragraphs 8–9, conventional numbering [7]. These numbering differences are recorded in the source label. The text of *Sanctification of the New Month* chapter 11, paragraphs 7–9 on Chabad, gives the thirty-degree divisions and list. The Gra recension of *Sefer Yetzirah* 5:4 corroborates the Hebrew list; no early date is assigned to that recension here.

| Hebrew name | Transliteration | Literal gloss | Modern reference figure |
| --- | --- | --- | --- |
| טלה | Ṭāleh | Lamb / ram | Aries |
| שור | Shor | Ox / bull | Taurus |
| תאומים | Teʾomim | Twins | Gemini |
| סרטן | Sarṭan | Crab | Cancer |
| אריה | Aryeh | Lion | Leo |
| בתולה | Betulah | Maiden | Virgo |
| מאזניים | Moznayim | Scales | Libra |
| עקרב | ʿAqrav | Scorpion | Scorpius |
| קשת | Qeshet | Bow | Sagittarius |
| גדי | Gedi | Kid / young goat | Capricornus |
| דלי | Deli | Bucket | Aquarius |
| דגים | Dagim | Fishes | Pisces |

The figure geometry is the corresponding modern Western Stellarium polyline, under CC BY-SA 4.0, at revision `0d956aacee305c29a92498860bc394ed21e0e731`. A figure's `referenceModernId` makes this borrowing explicit and reproducible. Polylines are unchanged; labels and annotations are added. This is comparison geometry, not a claim that Maimonides supplies those memberships or outlines. In particular, the drawings are not the equal thirty-degree sign divisions used for zodiacal calculations. No lunar calculation, tribal attribution, birth-sign astrology, or ancient Hebrew artwork is added.

Primary sources and geometry:

- [Maimonides, Foundations of the Torah, chapter 3](https://www.mechon-mamre.org/i/1103.htm)
- [Maimonides, Sanctification of the New Month, chapter 11](https://www.chabad.org/library/article_cdo/aid/947929/jewish/Chapter-Eleven.htm)
- [Sefer Yetzirah, Gra recension 5:4](https://www.sefaria.org/Sefer_Yetzirah_Gra_Version.5.4)
- [Stellarium modern source at pinned revision](https://github.com/Stellarium/stellarium/tree/0d956aacee305c29a92498860bc394ed21e0e731/skycultures/modern)

## Reuse and validation

The new selection and annotation is distributed under CC BY-SA 4.0, matching the reused modern geometry's license; source rights in ancient names and cited modern editions are not claimed. The dataset contains names and new paraphrases, not lengthy extracts from modern translations.

All fourteen figure IDs are unique, every literal HIP ID is a measured catalogue/anchor record already available to this project, and all twelve `referenceModernId` values resolve to the existing modern set. HIP 17851 and 17489 are present in the base catalogue/anchors even though they were not needed by the initial three-tradition endpoint registry; the shared builder must include them when resolving all custom endpoints. `unlocated` records deliberately have no `lines` or coordinates.
