# Public state exports and snapshot review

## Coverage added

| State | Included records | Retrieval | Statewide entries in a ZIP-only lookup |
| --- | ---: | --- | ---: |
| Utah | 255 | Public HTML roster | 7 |
| Mississippi | 190 | Public CSV form | 3 |
| South Dakota | 745 | Complete public CSV export | 18 |
| Hawaii | 140 | Explicit general-election rows from complete CSV | 4 |
| Illinois | 523 | Bundled dated snapshot, no automatic crawling | 14 |

Sixteen states now have candidate datasets: fifteen automatic sources and one
dated snapshot. This is not nationwide, local-ballot, or candidate-profile
completion. The updated 51-jurisdiction CSV records an initial official-source
review everywhere, including unresolved PDF extraction, access, election-stage,
district and enrichment work. Initial research is not an exhaustive search.

## Authority and interpretation

- Utah requires all five roster tables and explicit general/write-in status.
  Primary/convention losers and inactive history are not assigned to November 3.
  Judicial retention questions remain separate questions, not a competitive race
  combining every appellate judge. School/local judicial district numbers are not
  congressional or legislative eligibility. Relevant official references include
  the [candidate roster](https://vote.utah.gov/2026-candidate-filings/),
  [retention information](https://vote.utah.gov/learn-about-judicial-retention-elections/),
  and [Utah Constitution Article VIII, Section 9](https://le.utah.gov/xcode/Articleviii/UC_AVIII_S9_1800010118000101.pdf).
- Mississippi rows require an explicit November 3 date. Six Senate District 34
  candidates have no election date in either their page section or CSV. They remain
  withheld rather than inheriting a neighboring section's date. Judicial places
  are distinct contests and are not mapped to Census legislative districts.
- Hawaii's exported count must match the selected report's 415 records. Only 140
  `In General` entries are included; issued, primary, withdrawn, void, already
  elected and merely filed records are not promoted into general candidacies.
- South Dakota's export must match all 745 counted records, not the first 50.
  Five withdrawal annotations retain their dates. Missing local ballot order is
  recorded without inferring an unopposed outcome or personalized eligibility.
- Illinois requires the exact general-election date/type. Explicit candidate and
  bracket IDs combine joint tickets; neither party alone nor inconsistent
  head-of-slate flags invent a pairing. The 528 individual source rows become 523
  records after five explicit ticket pairs are combined. Removed/withdrawn records
  do not become active candidates. Regional judicial records remain local.

## Publisher rules and data handling

Illinois's [robots policy](https://www.elections.il.gov/robots.txt) disallows
crawling. Automatic retrieval is therefore blocked in the source transport, and
the repository loads only the captured 523-record snapshot. Its original
`2026-10-21T04:59:46.328Z` retrieval time and source hash remain unchanged through
caching, checking and re-exporting. A visible dated-snapshot limitation accompanies
the data. Updates require reviewed, publisher-permitted material.

The snapshot is independently required by the runtime contract, explicitly copied
into the compiled back-end and validated on loading. It rejects incorrect source
identity, count, statuses, duplicate IDs, unsafe links and unexpected contact fields.
No failed snapshot load falls back to crawling.

Utah permits retrieval with a ten-second crawl delay; the server's shared
four-hour source cache remains. Mississippi's listed exclusions do not cover its
candidate report. Hawaii and South Dakota returned 404 for robots documents.
No CAPTCHA, TLS, account, bot challenge or access permission was bypassed.

The new JSONL transfer file contains 1,853 records and 177 safe source-published
campaign links. Its manifest distinguishes automatic retrieval from the dated
Illinois snapshot. Residential addresses, phones and email fields are excluded.
Existing minimal interface copy is preserved; the only additional disclosure is
the consequential snapshot freshness limitation.

## Verification

- Clean root and standalone back-end locked installations passed without
  dependency/lockfile changes; full and production audits found zero vulnerabilities.
- Formatting, lint, type checking, both builds and 494 unit tests passed; two
  optional PostgreSQL tests were skipped.
- All 21 integrated browser tests and 48 general route/theme accessibility checks
  passed, plus five actual-source accessibility checks and 15 native binding checks.
- The compiled back-end, copied snapshot asset and built front-end passed five
  actual-source API/restore/render reviews at 320, 390 and 1280 pixels. Every
  eligible statewide entry rendered, campaign-link counts matched output, and no
  browser errors, horizontal overflow or accessibility violations occurred.
- All configured automatic sources returned data during checks; Wyoming first had
  a transport failure, then succeeded on one secure retry. Illinois's compiled
  diagnostic succeeded without any network request and retained its capture time.
- Gitleaks found no outgoing secrets. A fresh external GitGuardian source upload
  remained unauthorized and was not attempted.

Local acceptance and source publication do not by themselves establish production
activation. Remaining states, local mappings, measures and substantive candidate
profile/news research remain part of the active goal.
