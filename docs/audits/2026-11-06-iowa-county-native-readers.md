# Iowa county sample readers

## Source evidence

The independently published Monona and Woodbury County general-election pages
offer fourteen and seventy-three distinct sample PDF documents respectively.
All 87 documents were acquired on November 6, 2026 using normal TLS and serial
requests paced at least twenty seconds apart for each publisher. Original
documents, acquisition receipts and native extraction evidence remain outside
Git.

- [Monona County election publication](https://mononacountyiowa.gov/elections/2026_general_election_2026_11_03/)
- [Woodbury County election publication](https://elections.woodburycountyiowa.gov/elections/info/2026_general_election_2026_11_03/)

The 174 pages contain 3,895 named person or ticket-member occurrences. Two native
PDF extraction paths reconcile their names and positions, with original-source
hashes and visible-text/font checks. These counts describe the offered samples,
rather than distinct people or personalized ballots.

## Reader contract

`state-ballot-iowa-county-native.ts` reads the reviewed two-page, three-column
sample layouts. It binds both native and layout text to an explicitly supplied
county and general-election date. Media geometry, reviewed crop-coordinate windows, structural bounds, named
offices, printed party associations, complete joint tickets, vote instructions,
and separate judicial retention questions are validated before returning data.

The county-level reconciliation retains:

| County | Samples | Distinct candidate/ticket entries | Retention questions | Total entries |
| --- | ---: | ---: | ---: | ---: |
| Monona | 14 | 44 | 9 | 53 |
| Woodbury | 73 | 77 | 9 | 86 |

Monona has 25 local candidate entries and Woodbury has 51. Township names are
preserved as printed, with each source style's membership and name evidence
retained separately. Matching names alone do not establish a voter's eligibility.

The reader keeps unknown party labels distinct from offices explicitly grouped
as nonpartisan. Blank write-in spaces and offices without named choices do not
become candidate records. Vote limits, vacancies, joint ticket members, empty
printed contests and measure-column text remain separate facts. Measure text
does not automatically become an approved application measure.

Multi-style reconciliation rejects conflicting facts for a shared choice rather
than assigning a second identity. Each document retains its URL, PDF hash,
original acquisition clock, printed style label and count of newly contributed
entries. The collection timestamp is the earliest contributing acquisition;
reading or preparing the data does not advance it.

## Scope and remaining integration

The reader supports explicitly supplied, date-bound future general-election
fixtures, including presidential tickets. Changed layouts, judicial districts,
office vocabulary and incomplete columns require review. A supplied future date
is a parsing input, not evidence that a publisher has released that election.

The Monona county filing announcement and its older statewide/federal report
remain independent sources. Sample-ballot status does not upgrade filing
records, establish winners, or link people to current officeholder profiles.

The county source families connect the reader to offered-election discovery,
explicit collection, external durable snapshots and public record routes.
Existing Story, Johnson and Polk configurations and the state-publisher access
hold remain intact. Full render/visibility acceptance and protected import,
publication and recurring-schedule approval remain separate requirements.

## Source families and storage

`ia-monona-samples-2026` and `ia-woodbury-samples-2026` read only the independently
published county samples. A future family member requires an actual offered,
date-bound general-election page. Discovery follows the publisher's own
upcoming/history navigation, preserves all PDF style aliases and distinguishes
an announced election from a published sample set. A removed unexpired sample
or alias holds the accepted catalog for review.

Collection checks the reviewed robots response, legal footer/link inventory and
linked notice before election requests. It uses ordinary HTTPS, explicit hosts,
strict redirect rejection, serial twenty-second request spacing and bounded
native converters. Access failures, policy changes, unsupported content and
disappearing choices retain accepted data for review. Pending publication does
not require a configured converter.

Native collection runs only in explicit workers. Public record requests read
persisted snapshots, including archived sources and offline restarts, without
starting publisher requests or native processes. Snapshot storage preserves
the original PDF hashes, capture clocks, complete style-alias inventory and its
index fingerprint. Persistence failures retain the prior accepted snapshot.

The county union is not used as a personalized ballot. Lower default priority
preserves existing Iowa directory precedence. Public provenance offers the
official county sample index rather than dozens of PDF links; judicial
retention is identified in the office label. No person-to-ballot-style or
current-officeholder relationship is inferred.

## Original-page and second-path validation

`state-ballot-iowa-county-proof.ts` reads the bounded original qpdf page graph
and compares a second Poppler text extraction against the maintained reader.
Both original pages must have distinct object references, reviewed 612-by-1008
media boxes, zero rotation and unit scale. Monona's original crop box is
18.573, 66.596, 593.28, 974.929 points; Woodbury uses the full media box.
Missing objects, inheritance cycles, altered boxes and unsupported page
inventories fail closed.

The second extraction independently reconstructs the columns, then reconciles
every candidate, party, joint ticket, retention question, office, vote limit,
vacancy designation and the complete measure-column text. Every named person's
page, column and vertical position must agree. Fonts, original-page geometry,
input bytes, nesting, text inventories and parsing work remain bounded. The two
reviewed decorative watermark forms are handled separately from ordinary black
text.

The explicit `iowa-county` XML worker profile requests point-scale output
and permits two pages. Its qpdf geometry profile requests original page-object
metadata without decoded image streams, retaining the four-MiB output bound.
For example, the first Monona PDF's image-inclusive qpdf output exceeds 22 MiB;
page geometry does not require those image bytes. Existing extraction profiles
retain their own arguments and limits. These profiles do not register a
publisher or run on a public request.

All 87 retained samples pass this validation, preserving all 3,895 person or
ticket-member claims and the 139 source-context entries. Synthetic regressions
cover altered identities, parties, offices, tickets, vote limits, questions,
crop/scale/rotation, font changes, duplicate pages, cyclic inheritance and bounded
worker behavior. Synthetic future-date cases establish parser compatibility,
rather than an actually offered future publication.

These checks establish agreement between two native extraction paths and the
reviewed original-page geometry. They do not independently establish rendered
paint order, opacity, clipping or occlusion. Full rendering acceptance and the
protected host enrollment, import, publication, and scheduling continue as
separate requirements. The source collector/storage integration described above
passes local original-response replay and all-record API reconciliation.

## Rendered appearance component

`state-ballot-iowa-county-visual.ts` adds a separately tested, fail-closed
appearance checker. It reconciles native words with approved Cairo glyph-path
hashes in original crop coordinates, then verifies opacity, clipping, paint order
and conservative text contrast. It bounds page structure, references, paths,
images and expanded paint work. Raw PDFs, font outlines, SVGs and review images
remain outside Git; source contains the 614 reviewed character-shape hashes.

All 174 retained pages have been rendered and their 77,499 ordinary-text words
reconcile with those shapes, including the larger election heading. Monona's
bounded red watermark and separate header-image mask are accounted for as
distinct paint effects. Woodbury's grey watermark participates in the actual
paint order instead of being discarded before contrast checks.

The complete appearance component currently passes Monona's 28 pages and holds
Woodbury's 146 pages for geometric review. Thin grid lines touch instruction
descenders, and an instruction arrow's conservative paint bounds intersect nearby
text. These are unresolved proof intersections, not findings that the printed
names are wrong. No text-specific bypass or blanket artwork exemption is used.
Precise artwork intersection handling remains necessary before both counties can
use this component as a mandatory automatic-collection gate.

Maintained regressions reject unchanged glyph placements hidden by parent
opacity, later opaque paint or empty clipping. They also cover altered/unknown
characters, duplicate glyphs, compound cancelling clips, contrast, watermark
layering, images, malformed references and resource bounds. The component remains
independent of the existing collector until the remaining real-page acceptance
and capture-proof integration are complete. Existing reader, snapshot and public
route behavior is unchanged; automatic host enrollment remains held.
