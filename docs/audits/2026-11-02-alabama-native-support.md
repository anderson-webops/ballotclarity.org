# Alabama discovery and native-document support

Reviewed November 2, 2026 against retained original publications. These modules
provide collection foundations, not an activated Alabama county collector.
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

## Verification and remaining integration

Thirty-one maintained tests cover discovery, future dates, provenance, policy
changes, native object admission, lexical bounds, visibility, glyph mappings,
closed office boundaries, unsupported painting and original-inspector cleanup.
Retained-data verification also exercises the compiled worker on all three
original PDFs and reconciles all 300 existing Alabama record IDs through six
local API pages without provider requests.

Collector registration, per-county exceptions, certification-currentness
reconciliation, canonical scope conversion, persistent snapshots and
import/repeat/restart/recovery acceptance remain separate integration work.
The native outputs are review evidence, not public candidate imports.
