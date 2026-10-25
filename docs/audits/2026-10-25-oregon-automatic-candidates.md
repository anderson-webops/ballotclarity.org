# Oregon candidate collection and reusable elections

## Official publications

[Multnomah County's current/upcoming election catalog](https://multco.us/info/current-and-upcoming-elections-multnomah-county-elections)
explicitly offers its [November 3, 2026 general-election page](https://multco.us/info/november-3-2026-general-election).
That page independently publishes the state certification and two county reports:

| Document | SHA-256 | Named claims | Unique records first attributed here |
| --- | --- | ---: | ---: |
| [State directive and ballot statement](https://multco.us/file/ballot_directive_-_november_3%2C_2026_general/download) | `5014ace823a84d3aba60bbb60642dda04373f6cdf48af1bce34508b5f9656048` | 183 | 183 |
| [County general ballot content](https://multco.us/file/ballot_content_-_nov._2026/download) | `eec5842cadb8e28513f9fcdc616bbda4d00b80d5e7a456c9c09c3a24d9dd25c8` | 109 | 50 |
| [County RCV ballot content](https://multco.us/file/ballot_content_rcv_-_nov._2026/download) | `c1be7b04d586051f2600be7b8ee8c17ee93d4d6a491ecc8f416c36e613af19f0` | 46 | 46 |

Ordinary public-only, certificate-verified acquisition on October 25 returned
the same three original hashes as the retained review. Normalization preserves
all 279 accepted records and IDs, including compound party labels and judicial
designations. Fifty-nine repeated claims agree rather than being counted twice.
The state statement covers all six congressional districts, fifteen Senate
contests and all sixty House districts. County-filed coverage outside Multnomah
County and individual voter eligibility are not established.

## Access and reuse boundaries

The worker checks the county's [robots policy](https://multco.us/robots.txt),
homepage policy links, [terms](https://multco.us/info/multnomah-county-website-terms),
[privacy policy](https://multco.us/info/privacy-policy),
[accessibility policy](https://multco.us/info/web-accessibility) and
[ADA notice](https://multco.us/info/ada-policy-notice-and-disability-complaint-process).
Reviewed fingerprints bind the relevant policy text and footer links. Only the
footer's copyright year is normalized; changed policy content or targets require
review. Public information/file paths are permitted by the observed robots rules.
Requests are serial with at least eleven seconds between them.

This is factual candidate-name, office, party and jurisdiction extraction, not
a general republication license for third-party material, candidate statements,
images or the PDFs themselves. Original documents and intermediate text remain
outside Git and release assets. The separate state search portal's access and
CSRF holds remain effective; no identity, certificate or insecure-transport
workaround is part of this source.

## Validation and report semantics

The collector validates complete page sequences, election headers, publication
dates, every individual candidate count, recognized office/group structure and
cross-document candidate/party agreement. Candidate extraction stops at the
explicit measure boundary and rejects later candidate controls rather than
silently discarding them. A measure section may have a later print time on the
same publication day; candidate-section timestamps must remain consistent.

The county general report's closing page says 63 contests and 116 filed
candidates. Its named candidate sections contain 53 printed contest occurrences
and 109 claims; the RCV report separately contains seven occurrences and 46
claims. The relationship between the closing aggregates and these sections has
not been established. Those fields are retained as bounded source metadata, not
invented into extra candidates, a coverage denominator or an equation involving
measure occurrences. Actual per-contest counts and named claims govern parsing.

The offered zero-vote reports were examined as a possible independent check.
Most pages yield no ordinary extracted text, and the visible report is
dated September 14, before the September 22 county ballot-content report. They
are not silently promoted into a newer certification or an automated OCR feed.

## Reuse and persistence

The `or-sos-multnomah-2026` family discovers actually offered even-year November
general-election dates and their complete three-document sets. Future URLs or
candidate names are never generated from an assumed election calendar. An
unpublished report set is not candidate data; a partial or changed active set
requires review. Synthetic 2028 cases test date rollover and persistence without
asserting that a future publication exists. Unknown office, party or ticket
layouts still require source review.

Acquisition uses the existing bounded Poppler worker contract:
`STATE_BALLOT_PDFTOTEXT` identifies an absolute maintained executable; each input
is limited to 12 MiB, extracted text to 4 MiB, processing to twelve seconds and
documents to fifty pages. Public APIs can read persisted facts without this tool.

Accepted snapshots and discovery catalogs live in external storage, with original
document hashes and first-attribution counts. Routine imports feed the existing
automation receipt and Operations view. Cached reads do not advance successful
collection/import clocks. Failed refreshes retain durable accepted data. Exact
legacy reviewed configuration remains recognized, so existing data does not need
a manual replacement merely because the source acquisition becomes automatic.

Native regressions cover policy drift, off-host links, malformed dates, partial
documents, missing pages, count mismatches, conflicting claims, future capture
times, persistence, cache reuse, legacy reads and disappearing active elections.
Local replay also compares every current candidate field/ID and all three PDF
hashes with the retained reviewed transfer.
