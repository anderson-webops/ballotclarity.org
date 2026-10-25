# Virginia election-table preparation

`back-end/src/prepare-virginia-elections.ts` and the compiled
`back-end/dist/prepare-virginia-elections.js` accept one explicit JSON plan.
They prepare review records from retained official HTML, without fetching,
importing, reconciling candidate identities or approving personal ballots.

## Plan

The plan contains exactly `schemaVersion: 1`,
`type: "virginia-election-review-preparation"`, `electionDate`, `documents`,
`outputDirectory` and `outputName`.

`documents` contains one `candidates` capture and one `referendums` capture. Each
has exactly these fields:

| Field | Meaning |
| --- | --- |
| `kind` | `candidates` or `referendums` |
| `path` | Absolute retained HTML path, not a symlink |
| `url` | Exact official election/date/scope URL |
| `sha256` | Digest of the original retained bytes |
| `capturedAt` | Original capture time, never replaced by preparation time |
| `expectedRows` | Explicit reviewed publication-row count, from 1 to 5,000 |
| `expectedTrailingZipOmissions` | Reviewed count of candidate rows missing only the final postal-code cell; zero for referendums |

The date determines the expected all-offices day/month/year URL and heading,
and the referendum month/year URL and heading. Different scopes, wrong years,
duplicate capture kinds, changed hashes and future capture times fail closed.
Future elections require a new dated plan and reviewed counts, not a filename
rename or a refreshed timestamp on old evidence.

`outputDirectory` must be new, absolute and outside the application checkout or
release, including its resolved parent. `outputName` is a bounded lowercase
alphanumeric/hyphen prefix. Preparation never overwrites an existing directory.

## Source and output boundaries

The parser requires one main region, one exact heading, one static table and the
reviewed header order. It retains all publication rows, including repeated
appearances of a federal candidate in different localities. It does not report
these appearances as distinct people or merge same-named local candidates.

Candidate review fields preserve locality, office, published district, number of
seats, term, unexpired-term end date, party, incumbent label, ballot-order fields
and the website string as published. Campaign email, telephone, street address,
city/state address and postal-code values are excluded from generated outputs.
Website strings are not validated or rendered as outgoing links by preparation.

The reviewed October 23 all-offices capture has 13 rows without their final
postal-code cell. These rows are accepted only with that explicit omission count
and retain an omission flag. Earlier/truncated cells or a different omission
count remain errors. No postal code is inferred or needed for the retained
candidate fields.

Referendum records preserve `Active`, ballot order, `Referendum Area`, locality,
title and full official question text. `Active: Yes` is a publication status,
not a Yes vote or a yes/no choice pair. Inactive rows remain identifiable; a
district question is not promoted to an entire locality or the state.

All records retain `personalBallotAssignment: false` and
`identityReconciliationApproved: false`. The existing federal candidate adapter
is unchanged; the larger table is review evidence, not a replacement live feed.
County, independent city, town and district labels require their own reviewed
eligibility mapping before public candidate or ballot assignment.

Six files are produced: candidate JSONL/CSV, referendum JSONL/CSV, a provenance
manifest and checksums. JSONL begins with source metadata; CSV has one
publication occurrence per row. CSV formula prefixes are escaped without
rewriting JSON evidence. Each output is bounded to 12 MiB. HTML remains bounded
to 2 MiB, 80,000 nodes and depth 64; growth beyond those limits is a review hold,
not an automatic limit increase. Publication dates stay unknown if absent.

## Guarded collection

`va-candidates-documents-2026` and `va-referendums-documents-2026` separately bind
the official index, exact HTML path and election heading. Both pin reviewed
robots, homepage policy links, privacy, policy-index and email-disclaimer regions.
HTML link/footer fingerprints, existing transport/crawl limits and import/public
approval gates remain in force.

Virginia's robots file contains the non-path patterns `*.json`, `*.csv`, `*.xls`
and `*.xlsx`. The optional `relativeRobotsDisallows` configuration explicitly
reviews those exact restrictive extension patterns. They are conservatively
applied as path-rooted disallows at every nesting level. This is not a permit to
download those formats. Unknown patterns and relative Allow rules still fail;
sources without this configuration retain their prior fail-closed behavior.

Collection stores source evidence outside the application and Git. It does not
create native summaries or approve import/publication. Native state and county
measure drafts use the separate state-measure preparation contract and preserve
the same evidence and publication boundaries.
