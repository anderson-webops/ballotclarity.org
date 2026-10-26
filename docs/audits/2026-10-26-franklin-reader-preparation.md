# Franklin County candidate-reader preparation

This records the preparatory source checkpoint `0e68908`. The
[completed automation review](2026-10-26-franklin-automation.md) supersedes its
pending-integration status and preliminary notice-completeness assessment.

## Scope

The bounded PDF reader in `back-end/src/state-ballot-franklin.ts` reproduces all
78 accepted Ohio candidate records and identifiers, including eleven write-ins,
six governor/lieutenant-governor tickets and 26 campaign links. This is preparation
for an automated source, not an enabled collector or importer. The registry,
existing external snapshot, source clocks and publication gates are unchanged.

## Current official evidence

The [county election index](https://www.vote.franklincountyohio.gov/election-info/2026)
still offers the general candidate list and the updated 46-day FWAB notice
separately from primary reports. Normal pinned HTTPS requests on October 26,
2026 returned the same original bytes previously reviewed:

| Publication | Capture UTC | Pages | SHA-256 |
| --- | --- | ---: | --- |
| [General candidates](https://www.vote.franklincountyohio.gov/getmedia/e0a4ca45-6893-45c1-8190-87696f8804b4/2026-General-Candidate-List-5) | 10:39:15.384 | 2 | `9e5bf3d402e67499caa918f900e35e3950beb6bd169ebb6cf1e7fb1ae7c4b62d` |
| [Updated FWAB notice](https://www.vote.franklincountyohio.gov/getmedia/352b644d-b348-447e-b60d-aa9b9193a297/2026-General-Form-No-120-FWAB-Notice-46-Day) | 10:39:26.617 | 13 | `dc69b2b2243507bc84e4dda490d77b8a1f2f96f61b7a90aeaa8f5a8c869bce29` |

The Board's robots path returns 404, not a successful policy document. Its root
redirect explicitly identifies `/home`; that canonical HTTPS page and the election
index return 200 with no identified privacy, terms, disclaimer or copyright link.
This inventory is not a blanket reuse license. The existing raw-document
collector's stricter policy-response hold remains in place. New scheduled
collection still requires a reviewed policy contract and explicit offered-election
discovery, not an assumed date or yearly filename.

## Reader boundaries

The reader validates bounded word geometry, page headings, revision dates,
candidate columns, continuation pages, known offices, term dates, affiliations,
write-in evidence and safe published websites. The rotated candidate PDF exposes
792-by-1224 metadata with words in 1224-by-792 display coordinates; only these
observed candidate dimensions and portrait notice dimensions are supported.
Email, telephone and other contact columns are not normalized.

The main list remains authoritative for printed names and ordinary party labels.
FWAB evidence supports its clipped Other-party label and a blank write-in cell;
`N/A` alone is never a write-in declaration. A notice spelling differing from the
main list requires an explicit reviewed mapping bound to that election and office.
The current review identifies `Eboney C. Eldridge` in the main list and
`Ebony C. Eldridge` in the FWAB notice. The main spelling and original ID survive;
no new alias or person is inferred. That reviewed mapping is supplied by the
local reconciliation, not embedded as a timeless candidate rule.

The preliminary matching did not establish notice completeness. Independent
enumeration now accounts for 79 named claims: all 78 main-list records plus one
explicitly withdrawn candidate. Missing matches were not evidence of omitted
candidates; two reviewed name variants resolve the substantive spelling differences.
The successor review verifies complete reconciliation, policy-bound discovery,
durable migration/recovery and connected-page acceptance together. Unknown layouts
or unresolved evidence require review instead of publishing guessed facts.

## Checks

Synthetic tests cover tickets, continuation rows, a differently dated election,
explicit spelling-review boundaries, source disagreement, question separation,
privacy, unsafe geometry and normalization failures. Synthetic future dates are
compatibility cases, not evidence that future candidates have been published.
The separate local reconciliation compares every current record field and ID
against the accepted external Ohio snapshot. No canonical data file is changed.

## Other source research

Woodward County's three currently offered PDFs were normally downloaded on
October 26 after unchanged policy/link review. All match the retained original
hashes and have no machine-readable text layer. Their existing reviewed records,
raw-document configuration, city-only question and SQ845 discrepancy hold remain
unchanged; OCR is not promoted into unattended candidate publication.

Indiana's linked use terms still have an unresolved personal-use/retrieval-system
restriction. Its existing reviewed snapshot is preserved; this work neither
downloads its workbook nor enables a collector. Independent publisher restrictions
and the statewide Ohio source hold remain effective.
