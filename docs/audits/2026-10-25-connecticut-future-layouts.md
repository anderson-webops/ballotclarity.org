# Connecticut historical layout compatibility

## Evidence

The official catalog offers separate [2024](https://portal.ct.gov/sots/election-services/town-ballots/2024-general-election-sample-ballots)
and [2025](https://portal.ct.gov/sots/election-services/town-ballots/2025-general-election-sample-ballots)
publications. Four linked PDFs were collected on October 25, 2026 after the
existing policy checks, with normal validating HTTPS and paced requests.
The regression fixtures retain the actual source URLs, original PDF hashes
and capture clocks. Historical records are test evidence, not current nominees.

| Election | Town | Pages | Candidate/context records | Printed candidate claims |
| --- | --- | ---: | ---: | ---: |
| November 4, 2025 | Andover | 1 | 25 | 26 |
| November 4, 2025 | Hartford | 1 | 4 | 4 |
| November 5, 2024 | Andover | 2 | 17 | 21 |
| November 5, 2024 | Hartford | 11 | 26 | 201 |

The extracted facts cover all fifteen pages. Repeated lines, cross-endorsements
and ballot styles are not additional people. Andover retains sixteen question
cells, twelve on a continuation page; Hartford retains ten repeated statewide
question panels. These are extraction evidence, not approved public measures.

## Supported differences

- Printed presidential elector tickets remain literal, including abbreviated
  surnames. No full names, winners or future nominees are inferred.
- Published municipal offices include town clerk, finance, education, planning
  and zoning, appeals and fire commission. Physical columns remain grouped
  under their printed multi-seat office heading. Vote limits and vacancy terms
  use the existing `ballotDesignation` field. Different printed designations
  distinguish repeated office headings; ambiguous repeats require review.
- An explicit small-grid option accepts Hartford's eighteen-cell municipal
  ballot. Ordinary readers retain their previous thirty-cell minimum.
- Historical header bands, bilingual district labels and oversized font boxes
  retain the printed district identity and physical marker centers. Marker
  height remains bounded by its cell, and markers outside their cell fail.
- Numbered question continuations require bounded question boxes, yes/no
  choices and complete text accounting. Only the observed exact completion
  footer is excluded from question facts.
- The final instruction back is recognized by the SHA-256 of its complete
  extracted text. It produces no candidates or questions. Changed content,
  a misplaced page or added cells requires review; no general instruction-page
  skipping rule is used.
- The observed H2 publication caption and H3 election date are supported beside
  the current H1 template. Date, official host, offered link and policy checks
  remain mandatory. The active catalog still excludes pre-2026 elections.

## Boundaries and regression checks

Unknown office or party labels, conflicting nominees, incomplete legislative
districts, ambiguous positions and unfamiliar auxiliary pages retain accepted
data for review. This is support for the observed layouts, not a promise that
every future municipal office or ballot design needs no preparation.

The original 134-document reviewed fallback remains unchanged. The complete
current 169-document, 609-page replay is checked separately against its original
hashes and retained geometry, preserving all existing candidate IDs and fields.
Any added printed designation enriches those facts rather than replacing them.
Historical fixtures and synthetic future index dates never enter canonical
current-election data. Collection permissions, measure review, receiving-host
capabilities and unattended import acceptance remain separate gates.
