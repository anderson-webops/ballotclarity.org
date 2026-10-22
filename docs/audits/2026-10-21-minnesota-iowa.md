# Minnesota and Iowa official-source imports

## Scope

Local source/data preparation only. No publication, hosted transfer, deployment,
service configuration, permission change or access-control workaround is authorized
or performed. Existing source changes and previous external datasets are preserved.

Four City of Independence, Minnesota sample ballots contribute 78 unique records
from 261 printed claims across eight pages. Story County, Iowa's certified list
contributes 102 records across ten pages. Both visibly identify November 3, 2026.
These are partial county/city publications, not statewide district completeness.

| State | Statewide | Congress | State Senate | State House | Local/regional | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Minnesota | 23 | 2 | 2 | 2 | 49 | 78 |
| Iowa | 18 | 2 | 2 | 8 | 72 | 102 |

## Originals and access

Minnesota's [official index](https://www.ci.independence.mn.us/government/elections)
independently publishes Delano ISD 879, Westonka ISD 277, Orono ISD 278 and
Rockford ISD 883 samples. Each has two pages. Public requests used normal TLS and
an identified review user agent, spaced more than ten seconds apart on this host.
Robots and linked privacy/terms were reviewed without finding an applicable
extraction/republication prohibition. No challenge or access control was bypassed.

| Minnesota sample | Original-byte SHA-256 | Original capture, UTC | First-contributed records |
| --- | --- | --- | ---: |
| Delano | `889aa83e521a4eba410315243aceee1e50b0d1d4cb1606789606718503920dfa` | 2026-10-21 17:25:35.543 | 70 |
| Westonka | `7bee80bb13b3199098c3977d140a4136b8d18e202111eabb42b7f9d8ffb4c9ee` | 2026-10-21 17:25:46.358 | 0 |
| Orono | `74de21cf4f5303bdcae0a9ee8dfb43716d54cc8925acf765c737d08f58763da8` | 2026-10-21 17:25:57.230 | 4 |
| Rockford | `541dc7efdc9f0106393c5fd6106412a86c4fa295d33758db19cda7700bd91f19` | 2026-10-21 17:26:08.078 | 4 |

Westonka contains the same 61 common named rows and no school candidate block.
Its zero unique contribution is not a missing document. The snapshot validator
now accepts a nonnegative integer contribution while retaining the exact ordered
document set, source-set digest, capture-time, positive total, summed contribution,
field-whitelist and unique-identity checks. Negative, fractional and mismatched
counts remain invalid. No provenance is dropped to hide the duplicate style.

Iowa's [official election index](https://storycountyiowa.gov/1754/General-Election-11032026)
links its [certified candidate list](https://storycountyiowa.gov/DocumentCenter/View/18219/Candidate-List---General-2026-PDF?bidId=).
The short DocumentCenter link normally redirects to that same-host named PDF.
It was captured at 2026-10-21 17:28:33.297 UTC, 174,884 bytes, SHA-256
`3509c4b82c4a024e26ed9fcc12877f595cdfcf6efa216fa93751c0cd49d746fd`.
All ten visible pages show the current 2026 list; the PDF metadata title remains
stale 2022 and is not election evidence. The county's robots, copyright and full
disclaimer were reviewed. A license statement scoped to its disclaimer is not
treated as a blanket license for every county file. Only attributable candidate
and question facts are transferred, not the raw document or contact details.

## Reconciliation and eligibility

- Minnesota retains three governor/LG teams as three candidates, literal party
  labels, and 17 school candidates with their printed districts and vote limits.
  Common local records are labeled Independence P-01, not falsely attributed to
  the first school area. Council and school jurisdiction names are distinct fields.
- Minnesota's seven Supreme Court/Court of Appeals rows are ordinary judicial
  elections, not retention questions, winners or inferred unopposed outcomes.
  The [Supreme Court](https://www.mncourts.gov/SupremeCourt.aspx) describes statewide
  judicial elections; [Minnesota Statutes 480A.02](https://www.revisor.mn.gov/statutes/cite/480A.02)
  expressly makes all appellate judges' elections statewide despite seat residency.
  The 21 fourth-district trial judges remain local and unmatched to a voter.
- Exact typed matches may add CD 3, Senate 37 and House 37A. Bare House 37,
  park district 1, school 879 and court district 4 never imply eligibility.
- Iowa's two governor/LG tickets stay paired. Certified names remain qualified,
  not automatically nominees, unopposed candidates or winners. Printed `*` and
  `**` markers become incumbent/appointed designations, not part of the name.
  Starred supervisors retain the explicit currently elected-at-large limitation.
- Iowa's three appellate judges are separate statewide retention questions.
  Seven District 2B trial/associate judges remain local. The [Iowa judiciary's
  2026 retention notice](https://www.iowacourts.gov/newsroom/news-releases/information-about-iowas-2026-judicial-retention-elections)
  distinguishes statewide appellate ballots from trial-district eligibility.
  No ten-judge competitive election is fabricated.
- Four empty Iowa township office blocks are retained as empty source evidence,
  not invented candidates: Indian Creek trustee/clerk, New Albany clerk and
  Palestine trustee to fill a vacancy. Local county/township IDs are not
  interchangeable with legislative districts or wards.
- Iowa's residential addresses, mailing addresses, phone numbers and emails are
  excluded from snapshots, API/export records and transfer archives. No campaign
  website is inferred from an email address.

Each state's one statewide constitutional question is preserved in a separate
factual companion, not yet application measures. Minnesota retains its printed
Yes/No options and the printed effect of abstaining. Iowa retains the question,
summary and full text but does not invent response labels absent from the list.

## Storage and interface

`mn-independence-2026` and `ia-story-2026` are external-only reviewed sources.
Their canonical snapshots, candidate/printed-line/question JSONL, manifests,
five-file archives and checksum lists reside in ignored `back-end/data/state-ballots/`.
Original PDFs stay in local evidence, never Git/code-release payloads. All original
hashes and capture times survive validated import, storage, restart and export.
Missing imports fail closed; automatic refresh refuses these reviewed sources.

The existing candidate directory displays these records, printed statuses,
jurisdiction labels and source limitations. Minnesota exposes four labeled
original-document links. No decorative instructions, onboarding, reassurance or
implementation copy was added. The existing partial-coverage notice remains local
to lookup results. No further copy change is warranted for this data boundary.

## Verification

- All eighteen original pages were visually reviewed. Independent text/OCR
  reconciliation exactly matches 220 Minnesota and all 102 Iowa printed name
  claims after whitespace/punctuation normalization. The remaining 41 Minnesota
  OCR differences were checked against original pixels, including Nick Arnfelt,
  Dominick D. Mathews, Kristen Marttila and Jeannice M. Reding. OCR is not the
  import authority. Every canonical record retains at least one original claim.
- Eleven new synthetic regressions pass. Full root lint/typecheck, both builds
  and 626 unit checks pass, with two pre-existing optional PostgreSQL skips.
  The first sandbox-only unit launch could not open its loopback listener;
  the complete command-scoped local retry passes without changing saved settings.
- All 21 integrated browser tests pass. The build verifier checks 79 compiled
  backend modules/runtime assets; all fifteen native-binding entries pass.
- Actual retained data loads through an isolated built API and application:
  23 snapshots, 18,049 exact records and 192 bounded record pages. No publisher
  request occurs. Original capture times and whitelisted public fields match.
- All 62 rendering/accessibility cases pass with no WCAG A/AA violations,
  horizontal overflow or uncaught page errors. These cover both new states,
  missing imports, pagination, judicial retention, names, lettered House districts,
  local records and lookup results across three palettes, two modes and widths
  1280, 390 and 320 where applicable. Seven representative images were also
  visually inspected. Existing NH, VT and NY directory behavior remains intact.
- Controlled state-only ZIP lookups show Minnesota's 23 statewide records in
  twelve offices and Iowa's eighteen in ten offices. Exact federal/legislative
  matches add only their correct districts; Minnesota's combined match gives
  29 records/fifteen offices and Iowa's CD 4/Senate 25/House 50 gives 23/thirteen.
  No local, school, park or trial-court record is assigned through generic district
  numbers. Browsing another state's records does not mutate the saved lookup.
- Both exact five-file archives unpack byte-for-byte, import through compiled
  management commands and export exact candidate JSONL in separate processes.
  Missing imports fail closed and manual refresh refuses both sources. Temporary
  services, browser contexts, isolated stores and unpack directories close/remove.
- Local Gitleaks scans all 128 changed source paths and 34 external non-archive
  data/checksum files, 162 inputs, with zero findings and no external upload.
  Previously unavailable GitGuardian upload is not represented as a passed scan.
- Preservation verifies 124 unrelated dirty paths byte-for-byte, all 26 previous
  external data files, five original intended-path recovery copies, unchanged
  heads/staging/four worktrees and five unchanged package/lockfiles. Forty external
  files now include the two new seven-file datasets, all ignored and outside code
  artifacts. No dependency, original, unrelated work or useful cache was removed.

## Changed files

- `back-end/src/state-ballot-sources.ts`: two reviewed external source definitions.
- `back-end/src/state-ballot-snapshot.ts`: allow zero unique document contributions
  while retaining positive-total and exact-provenance validation.
- `back-end/test/state-ballot-minnesota-iowa.test.ts`: synthetic import, privacy,
  retention, district and zero-contribution regressions.
- `README.md`, `docs/state-ballot-sources.md`, `docs/state-coverage-2026.csv` and
  this audit: source/storage instructions, coverage and actual verification.

No frontend layout, styles or instructional copy change is needed for this batch.
The new official-source labels and scope limitations are substantive operational
information. Two question companions are collected but not displayed as app measures.

## Remaining work and delivery

Configured sources now span 37 states plus DC: sixteen automatic sources and
twenty-two dated sources, including six external-only imports. Thirteen states
still lack an integrated candidate dataset. Maine remains municipal-only; local
eligibility, measures, substantive profiles and later amendments remain incomplete.
Existing bundled bulk datasets still require a separately verified external-storage
migration before they can be removed from code releases.

The local review retains independently published Nevada/Kansas source leads for
the next collection boundary; they are not counted as integrated here. Arizona
Maricopa and Wisconsin Milwaukee robots requests returned 403 and were not bypassed.

This is accepted local source/data preparation, not source publication or hosted
activation. No commit, push, tag, release, deployment, production service,
credential, permission or saved application configuration changed. The final
server-AI runbook remains queued until the remaining collection/setup is verified.
