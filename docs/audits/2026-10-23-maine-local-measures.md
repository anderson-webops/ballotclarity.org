# Maine local-question preparation

## Reviewed records

Two retained official sample ballots support narrowly scoped factual summaries
for November 3, 2026:

| Area | Question | Official document | Page |
| --- | --- | --- | --- |
| Winthrop | Charter revision recommended by the Charter Commission | [Town municipal sample ballot](https://www.winthropmaine.gov/DocumentCenter/View/6168/Winthrop-Maine-Municipal-Sample-Ballot-Nov-3-2026#page=2) | 2 |
| Penobscot County | Authorization to relocate the correctional facility and related buildings outside the county seat | [Sample ballot published by Orono](https://www.orono.org/DocumentCenter/View/14072/State-of-Maine---Nov-3-Sample-Ballot#page=1) | 1 |

The original captures are dated October 21, 2026 at 23:18:25.721Z and
23:18:26.082Z respectively. Their SHA-256 digests remain
`579a735590c12f5180d5deb864e41d191e27ebc83d4f66827ee1ca14f1244607`
and `396e03c4311469449fbb36bf8118d66daac746978915aac756747f8357457f0d`.
This review checks those retained bytes, not a new download or a claim that the
publisher's current version is unchanged. Publication dates remain unknown.

## Content boundaries

Each native draft contains a brief neutral summary, YES/NO meanings, a page-linked
source and a local source limitation. The Winthrop ballot does not describe the
specific charter revisions. Neither question provides project costs or an
implementation timetable. Those fields stay empty rather than implying no cost
or inventing a date. The Penobscot record does not identify a replacement site.

The packet contains factual summaries, not ballot images, full question text,
third-party arguments or candidate statements. Existing municipal copyright
notices are not treated as permission to reproduce their sites wholesale.

These are selected local questions, not a statewide measure list, complete local
ballot or determination that either question appears on a particular person's
ballot. The county question is not limited to the municipality that published
the retained sample. Town and county scope remain separate in the data.

## Preparation contract

The existing offline assembler now accepts a matching local `jurisdiction` in
each native draft and preparation-plan input. It preserves exact area/state,
rejects scope changes and duplicate replacement, checks PDF page references from
their captured bytes and starts each added guide in draft. Existing primary and
statewide records are preserved when a pinned review base is supplied.

Lookup uses conservative type-aware exact geography, without substring matches
or treating a single local guide as statewide coverage. Existing capitalized
jurisdiction types still work. Partial local coverage remains visible in lookup,
election overview, ballot and printed saved plans. This adds no content dropdown.

Ten ignored data files contain two native drafts, six flat prepared review files
and an eight-member compressed packet with its checksum. The CSV has one row per
measure/source pair: two rows. Raw PDFs are not bundled and data is excluded from
Git and application releases. Source and compiled preparation must reproduce the
same six standalone outputs before acceptance.

Publication, automatic import and primary replacement remain unapproved. The
packet is review material, not an active coverage snapshot. Current publisher
policy, complete measure texts and any further fiscal or timing material still
require their normal review; no data or production gate is relaxed.
