# Source provenance

This repository starts from the Mazzaroth prototype export dated 2026-10-24,
source commit `094f2cd58162a9f71eca816d62ebabdf9383ba78`, and its subsequent
Svelte/TypeScript port. The original export remains outside this repository
and is not a build dependency.

The initial catalogue snapshot content is preserved losslessly in gzip files.
`catalogue/snapshots.json` records checksums of both the compressed files and
the original bytes. Source records retain their original provenance.

The original historical dataset and skyculture inputs are in `research/`.
Stellarium sources remain pinned to their recorded upstream commit, with
authors and individual licenses retained. The data builders and validators
were brought into `scripts/` and adapted to local inputs and `.data/` output.

Presentation edits live in `scripts/resource-copy.mjs`; original research
notes and source metadata remain available in the source inputs. The generated
source archive includes the builder, validation helpers and license notices.

Runtime D3 and Astronomy Engine versions remain pinned. The ground-sky renderer
is inherited from the prototype. The observer wrapper now uses the project's
TypeScript numeric calendar adapter.
