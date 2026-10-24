# Architecture and model notes

Svelte 5 + TypeScript port of the Mazzaroth research atlas. Requires Node.js
22.12 or newer. Source provenance is documented in [provenance.md](provenance.md).

```sh
npm install
npm run dev
```

## Pages and shared state

The application has three page-level components:

- **Atlas** (`#/atlas`): combined calendar wheel and catalogue sky, with independent
  layer switches. These replace the prototype's three wheel/sky tabs.
- **Ground sky** (`#/ground-sky`): perspective viewer, constellation traditions,
  figure finder, and camera controls.
- **Register** (`#/register`): filtered entry table and CSV export.

Hash URLs support direct links, reload, and browser history on static hosting
and in the offline HTML file without server rewrite rules.

`src/lib/state.svelte.ts` owns the shared, typed Svelte state. Search, month,
path, brightness, selected entry/star, pole and observer settings persist across
page navigation. Entry filters apply to the Atlas and Register; brightness
applies to measured stars in the Atlas and Ground sky. Ground sky retains the
full celestial sphere independently of historical-entry filters. Brightness
continues to use mixed Gaia G / Johnson V measurements, as in the prototype.

Rotation pole & epoch and brightness sit inside Observer, epoch & reading time.
Entry search/month/path filters remain separate. The Register page shows only
these entry filters; observer, epoch and brightness settings are hidden there
and retain their state for the sky pages.
Year and BCE/CE controls sit inline after the pole choices. The Celestial pole
preset uses 1200 BCE; pole-star presets fill their fitted epochs. Custom unlocks
manual year/era entry and uses the celestial pole of that epoch. The last custom
date survives preset changes and page navigation, and remains active when the
observer readout is disabled.
Labels and chart display controls sit together below the chart; label state is shared
between Atlas and Ground sky.

The lower chart panel groups Layers, Sky details, and Orientation & overlay.
Its sliders align horizontally on desktop and stack on narrow screens. Reset
and close-up actions sit in the panel footer. Controls for a disabled layer
are dimmed and disabled until that layer is enabled again.

`src/lib/components/` contains the reusable filter/selector components, observer
controls, evidence panel, sources dialog and common page content. `App.svelte`
composes the shell and handles navigation. Page render surfaces stay mounted
while hidden so camera/zoom state and listeners survive navigation; the hidden
ground renderer is paused.

Atlas zoom scales the complete wheel, including its rim, coordinate labels,
calendar slots and measured sky. The circular sky clip moves with the wheel;
gesture hit testing follows its current zoom and pan. Reset sky orientation
restores the full wheel.

The seasonal display convention is to hold the equinox of the selected epoch
fixed and show the stars changing position relative to it. The engine's
equator/equinox-of-date transformation already accounts for precession;
an additional precession rotation must not be applied to the calendar wheel.
Manual wheel and sky angles remain display offsets. Pole-star modes retain
their separately documented assumed-axis interpretation.

A mint marker labels the spring equinox at RA 0h, declination 0°. It is projected
directly from the date frame, without catalogue propagation. Changing the epoch
moves the stars relative to this reference; manual sky rotation and zoom move
the reference with the chart. In an assumed stellar-axis view it is labelled
Ephemeris equinox to distinguish it from that model's seasonal origin.

## Rendering and numerical core

The first port preserves the original D3/Canvas renderer and astronomical
algorithms. `src/lib/legacy/renderer.js` adapts the original controller to shared
Svelte state and three-page navigation. Its public boundary is typed in
`renderer.d.ts`; its internals remain JavaScript with type checking deferred.
Observer, pole, epoch, chart projection and ground-camera behavior are retained.

`public/runtime/` contains the observer wrapper, the original ground-sky module,
the generated numeric calendar module, and pinned D3/Astronomy Engine libraries,
including their licenses. `runtime.ts`
loads them in dependency order. UI components still expose stable DOM mount
points for this controller. Converting those internals into typed modules and
moving the remaining imperative control handlers into Svelte can happen in
subsequent steps without redesigning the UI or rewriting the numerical model.

The port retains selection, evidence, source credits, tradition switching,
figure finding, magnitude filtering, pole calibration, observer controls,
CSV/SVG/PNG exports, and the original visual styling. No historical
identifications or scientific assumptions were changed.

The main title uses self-hosted Nordwand Mono Regular, release 1.3.4 from
https://github.com/tywr/Nordwand-Mono/releases/tag/1.3.4. The WOFF2 asset is in
`src/lib/assets/fonts/`; its SIL Open Font License is shipped in
`public/fonts/nordwand-mono/LICENSE-FONT.txt`. The offline build embeds both
the font and its license.

## Numeric time and calendar boundary

`src/lib/astronomy/calendar.ts` converts proleptic Gregorian civil dates to and
from numeric UT days using astronomical year numbering (year 0 is 1 BCE).
The observer uses numeric days for seasonal searches, local mean midnight and
formatted labels. It no longer constructs JavaScript Dates or reads the
engine's `.date` property. Astronomy Engine continues to own UT/TT conversion,
solar positions, seasonal searches and coordinate rotations; the vendored
library still constructs Dates internally.

`npm run time:build` compiles the calendar to `public/runtime/calendar.js` for
the browser, offline bundle and CommonJS geometry checks. Development and
production builds run this step automatically. `npm run test:time` checks
calendar conversion, era boundaries, leap dates, local mean midnight and dates
at ±500000 years. Those are representation tests; the observer's existing
3000 BCE–3000 CE range and astronomical models have not been extended.

## Packaged resources

`public/resources/` contains `data.json`, `constellations.json`, the constellation
source archive and reference-coordinate CSV. Vite copies these unchanged into
`dist/resources/`; the application requires no API, database, or external
catalogue request at runtime. Provenance and license fields remain intact.

Edit the original research inputs and run the original builders to revise the
data. Then run `npm run resources:sync` to refresh these packaged snapshots from the local `.data/` directory after running the Python builders. Normal builds use the included copies and do not need the prototype.

`scripts/resource-copy.mjs` applies the application's editorial changes during
sync: factual entry descriptions replace authoring instructions, coordinate
notes list reference stars, and tradition-wide geometry explanations replace
repeated per-figure boilerplate. These edits affect prose only. Identifications,
coordinates, source references, licenses and scientific parameters remain
unchanged; the original research export is preserved.

## Build and checks

```sh
npm run check
npm run build
npm run test:time
npm run test:geometry
npm run test:browser
npm run preview
```

`build` checks Svelte/TypeScript, builds the static application into `dist/`,
and creates `dist/mazzaroth-wheel.html`, a self-contained offline edition.
That file embeds the runtime, data, styles, source archive and coordinate CSV.
Open it directly from disk or use the footer download in the hosted app.

`test:geometry` runs the seven original numerical validators against this app's
actual copied runtime, packaged dataset and adapted renderer. Temporary files
provide the original CommonJS loading environment; the parent export is not
needed. The validators still extract internal functions from source, following
the prototype's approach; migrate them to module imports as the core is typed.

`test:browser` builds the app and runs ten Chromium checks against production
output: shared filters/selection and history, independent atlas layers/reset,
whole-wheel zoom with outer-rim gestures and navigation/reset persistence,
fixed equinox reference with epoch-dependent stellar motion,
shared Labels controls and observer pole-selector placement,
ground camera/tradition/brightness state, unavailable observer readings,
fitted pole epochs, deep links, source dialog/exports, standalone offline use,
and narrow-screen layout. Install Chromium with `npx playwright install chromium`
if it is not already available.

## License

Original Mazzaroth application code is licensed under the
[PolyForm Noncommercial License 1.0.0](../LICENSE). The license text is the
unmodified official release.

Bundled libraries, fonts, astronomical catalogue data and constellation sources
retain their existing licenses and acknowledgements. See
[Third-party notices](../THIRD_PARTY_NOTICES.md) for scope and attribution.
Production and offline builds include the license and complete bundled
runtime/font license notices, accessible from Sources & method.
