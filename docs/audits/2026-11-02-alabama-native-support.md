# Alabama discovery and native-document support

Reviewed November 2, 2026 against retained original publications. The maintained
collector registers an opt-in Alabama county family; host activation is separate.
The existing `al-sos-2026` manual snapshot and its 300 records remain unchanged.

## Discovery

`state-ballot-alabama-discovery.ts` follows the official election-information
index's offered annual pages, the explicit regular November general election,
and its offered sample-ballot table. It retains capture times and hashes for
robots, annual and county-index publications. Changed policy links, robots,
certification controls, dates, county labels or source identities require review.
It neither downloads ballots nor infers qualification or individual eligibility.

The retained 2026 publications reproduce 67 county references and nine
certification controls exactly. Synthetic offered 2028, 2030 and 2032 publications
use the same parser without election-specific filename changes.

## Original-file analysis

`verifyAlabamaOriginal` requires original PDF bytes, their SHA-256, the offered
county/election identity, an explicit maintained qpdf executable and an absolute
private scratch directory. Native analysis runs in a separate compiled worker.
Public record readers do not invoke it.

Limits are 12 MiB original PDFs, 16 MiB object output, 64 KiB diagnostics,
12 seconds for inspection and 15 seconds for analysis. Worker heap limits are
128 MiB old generation, 16 MiB young generation and a 4 MiB stack. Warning exits,
diagnostics, unsupported appearance behavior and incomplete office fields fail
closed; temporary inspection files are removed on success and failure.

Admission checks the page tree, original content order, attachments, encryption,
actions, annotations, empty forms and metadata-only marked properties. The
reader accounts for clipping, overpaint, background contrast, text rendering,
font programs, border geometry and all painting within each candidate field.
The checked-in font catalog contains reviewed hashes, not embedded font bytes.
Clipped write-in markers may establish a closed geometric boundary without
becoming candidate facts.

| Retained county sample | Diagnostic claims | Original-file outcome |
| --- | ---: | --- |
| Macon | 45 | Native proof passes; substantive import approval remains separate |
| Montgomery | 56 | Held: original qpdf warning exit 3 |
| Jefferson | 81 | Held: one office overlaps unproved non-data CFF title geometry |

All diagnostic claim identities, names, parties, offices and scope fields match
the retained prototype exactly. Education-board districts remain distinct from
statewide and county-wide offices. Every output retains false import,
publication, recurring-collection and individual-applicability approvals.

## Collection, persistence and scope

The existing `al-sos-2026` identity also anchors the county-discovery family.
Explicit county source selection or `STATE_BALLOT_ENABLED_FAMILIES=al-sos-2026`
enables the corresponding native sources after catalog discovery. Enabling
Alabama alone preserves the existing statewide source and does not authorize
county downloads. Future source IDs use the offered county and election date.

Collection serializes publisher requests at a minimum twenty-second interval.
Each accepted PDF is bound to its offered election and county, its original
hash and a native review hash. The annual certification-control page is checked
again after analysis. Changed controls, missing accepted candidates, unsupported
appearance and source-identity drift retain the prior snapshot for review.
County-native failures remain separate from successful county imports.

Each synchronization processes at most 25 selected county sources. An external
atomic cursor rotates the next batch across restarts; deferred source IDs remain
explicit in its result. Public readers load persisted facts without publisher
requests or native analysis. Original PDFs and private scratch remain outside
the runtime and Git.

Canonical records retain printed name, party, office and jurisdiction with
`listed` status, without inferred nomination, incumbency or individual
applicability. The additive `state-board-of-education` scope and directory filter
keep those districts distinct from statewide, legislative and local offices.
County composites remain excluded from personalized ballot previews.

## Verification

Thirty-nine maintained tests cover discovery, future dates, provenance, policy
changes, native object admission, lexical bounds, visibility, glyph mappings,
closed office boundaries, unsupported painting and original-inspector cleanup.
Retained-data verification also exercises the compiled worker on all three
original PDFs and reconciles all 300 existing Alabama record IDs through six
local API pages without provider requests. Additional collection tests verify
explicit selection, canonical conversion, persistent import, offline restart,
repeat behavior, outage recovery, per-county holds and batch rotation.

Macon's 45 records also pass a retained-original collection/import replay into an
isolated external data directory. This is not fresh publisher acquisition or a
production import. Montgomery and Jefferson retain the original-file holds
listed above. Substantive approval, host configuration, publication, recurring
collection and protected activation remain independent acceptance decisions.
