// Presentation copy for the Svelte app. Original research snapshots stay intact.
// Applied during resources:sync so refreshing data preserves these edits.
export function editResourceCopy(data, constellations) {
  const entryNotes = {
    'enlil-01': "The conventional later identification conflicts with Astrolabe B's description of the Plough as present all year. Its Bronze Age outline is uncertain.",
    'ea-02': 'Astrolabe B assigns the Pleiades to Ea; MUL.APIN gives a different path assignment.',
    'ea-03': 'Related lists associate the figure with Ninshubur/Papsukkal. Akkadian spellings vary.',
    'enlil-03': 'Hydra is the conventional Mesopotamian identification. Astrolabe B assigns it to Enlil.',
    'anu-04': 'The monthly text distinguishes the Twins from the Great Twins in month V. Reiner–Pingree tentatively identify this entry with Gamma and Xi Geminorum.',
    'ea-05': 'The conventional identification includes stars near Delta and Epsilon Canis Majoris. Its exact ancient outline is unknown.',
    'anu-07': 'Conventionally identified with the Scales.',
    'enlil-07': 'Astrolabe B assigns this southern constellation to Enlil, so the calendar paths do not correspond to declination bands. Its name differs from the Greek centaur tradition.',
    'ea-09': 'Ea/month IX is secure as the textual slot; its original astronomical referent is disputed. Reiner–Pingree propose an older fixed-star meaning but give no candidate star. The later Mars association does not establish its original referent.',
    'enlil-09': 'Vega marks the approximate location of the figure, conventionally identified with Lyra.',
    'anu-11': "The Swallow's reconstruction and historical transformations are debated. The month-star list does not specify its outline or identify it with the two modern Pisces fish.",
  }
  for (const entry of data.entries) {
    if (entryNotes[entry.id]) entry.notes = entryNotes[entry.id]
    if (typeof entry.notes === 'string') {
      entry.notes = entry.notes
        .replace(' No replacement star is asserted.', '')
        .replace('No exact stellar outline is claimed.', 'Its exact ancient outline is unknown.')
        .replace('No exact outline is fixed here.', 'Its exact outline is unknown.')
    }
    const anchors = entry.anchorStars ?? []
    entry.coordinateNote = !anchors.length ? 'No catalogue position is assigned.'
      : anchors.length === 1 ? `Reference star: ${anchors[0].locatorName}.`
      : `Unweighted spherical centre of ${anchors.map((star) => star.locatorName).join(', ')}.`
  }
  data.meta.methodology = 'The calendar follows the names and path assignments in Astrolabe B. Modern positions come from catalogue reference stars or the spherical centres of selected star groups. Eleven entries have no assigned catalogue position. Dilbat, Šulpae, Salbatanu and Marduk have later planetary associations; their referents in this list are disputed.'
  data.meta.notes = 'Cifola and Hughey (2023) interpret the monthly triads as seasonal reminders within a religious narrative. A connection with the Median Magi is unconfirmed. Month numbers indicate calendar assignments. Ring order follows preserved circular astrolabes: Enlil inside, Anu middle, Ea outside (Monroe 2022); the diagram uses equal sectors and schematic ring spacing.'
  const notices = {
    norse_edda: 'A modern reconstruction of Eddic myths, with several speculative celestial identifications. Some outlines use nonstellar reference points in J2000 coordinates.',
    hebrew_biblical: 'Rings mark modern catalogue stars associated with the traditional identifications. The biblical passages do not specify member stars or connecting lines.',
    hebrew_zodiac: 'Names follow the medieval Hebrew sources. Connecting lines use modern Stellarium figures; medieval zodiac calculations use twelve equal 30° divisions.',
    zoroastrian_avestan: 'Rings mark modern reference stars. The cited Avestan texts give names and descriptions, without connecting lines.',
    zoroastrian_bundahishn: 'Names follow Bundahishn 2.2 in West’s transliteration. Connecting lines use modern Stellarium figures; the text does not specify member stars or outlines.',
  }
  for (const tradition of constellations.traditions) {
    if (notices[tradition.id]) tradition.geometryNotice = notices[tradition.id]
    for (const figure of [...tradition.constellations, ...(tradition.unlocated ?? [])]) {
      if (typeof figure.notes !== 'string') continue
      figure.notes = figure.notes
        .replace(' The stars are shown separately, with no invented connecting outline.', '')
        .replace('No catalogue point or southern constellation is imposed.', 'Its identification is unknown.')
        .replace(' The connecting lines are the modern Stellarium figure; this mapping does not claim a preserved Hebrew star-membership list, artwork, or sign boundary.', '')
        .replace('West’s transliteration is retained. The displayed modern line figure is a comparison locator, not geometry transmitted by the Bundahishn.', '')
        .replace(' They are deliberately not joined into an asserted Avestan drawing.', '')
        .trim()
      if (figure.id === 'IRN AV Vanant') figure.notes = 'Several historical identifications have been proposed for Vanant. Its relationship to the later Bundahishn stellar chiefs is uncertain.'
      if (figure.id === 'IRN AV Satavaēsa') figure.notes = 'Its identification is uncertain. Later stellar-chief lists and translations give differing interpretations.'
    }
  }
  return { data, constellations }
}
