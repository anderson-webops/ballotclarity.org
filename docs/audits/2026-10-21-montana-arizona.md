# Montana collection and Arizona source review

## Delivery boundary

Local-only continuation of national coverage work. No commit, push, tag, release,
host transfer, deployment, service/credential/permission or saved-configuration
change is authorized. All earlier uncommitted work and 51 external data files are
protected by a fresh hash-bound workspace baseline.

## Montana public general export

The [selected official public service](https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx?e=450002987)
is separately linked from Missoula County's public current-election page. The
county link initially selects the June primary, ID 450002928. The independently
published general selection is ID 450002987, **FEDERAL GENERAL 2026 (11/03/2026)
(General)**, jurisdiction STATE/99. No primary winner inference is used.

Normal robots, privacy/security and public-page review found no applicable export
restriction. The unrelated county SharePoint host says `Disallow: /`; no SharePoint
file, folder, API or alternate viewer is requested. The earlier generic SOS website
HTTP 403 remains respected. The current service is an anonymous public read/export
flow, not a private voter lookup or administrative application.

The full CSV capture at 2026-10-21T19:11:11.243Z is 62,991 bytes, SHA-256
`d491215c215b9fe74a9fcc2eedf8b9cc507b495bbaada079446d80a9c7b8cc8d`.
A normal supported two-request downloader check at 19:34:07.419Z produced the exact
same CSV and all 272 public records. The combined captured page/export digest is
`210e3f9d8d7e24cfe1357f733f7fe41ce5a1a927e1511222cf99d2ca06349086`.
Changing form-state wrapper bytes are not treated as changing candidate facts.

| Scope | Records |
| --- | ---: |
| Statewide | 7 |
| Congress | 7 |
| State Senate | 50 |
| State House | 191 |
| Regional judicial/commission | 17 |
| Total | 272 |

There are 143 distinct offices, 269 FILED records and three explicit WITHDRAWN
records. Both congressional districts, 25 Senate districts and all 100 House
districts are present. Withdrawing candidates stay in source evidence but never
active previews. FILED is not relabeled qualified, elected or unopposed. Party
preference labels are translated without inventing party membership. Mailing
addresses, email/web mixtures and phones are excluded; no campaign link is guessed
from the ambiguous combined contact column.

The visible `* = Incumbent` legend supports ninety incumbent markers. The marker is
removed from person names and retained as a designation without changing stable
identity. The source's one UNEXPIRED judicial row lists nominal term length six.
It is displayed as `Unexpired; listed term length: 6 years`, not an inferred
six-year remaining term. Distinct judicial departments remain distinct offices.
Two Supreme Court candidacies are ordinary filings, not inferred retention
questions. Regional courts/commission districts are not assigned through ZIPs or
generic matching district numbers.

The maintained automatic adapter requires the exact source election/date, selected
STATE jurisdiction, public form/action/export control and incumbent legend. It
checks all thirteen CSV columns, exact displayed/export count, allowed status,
office/district/party/term vocabulary and unique candidate identities. A changed
primary, restricted selection, incomplete export or unreviewed schema fails closed.
Validated public facts persist outside Git through the existing TTL repository.
The supported bootstrap is `refresh MT`, not reviewed-file import of an automatic
snapshot. Future elections require a reviewed selection and semantics update.

The final compiled `refresh MT` independently succeeds at 19:51:38.868Z, digest
`c0f0c5367a482d7f4bb929e181c17a8d94790ea6098dbd53577b881ec180a138`.
All public fields remain exact. Separate-process export, cached API restart and
controlled invalid-update refusal preserve the prior good disk cache. Automatic
reviewed-file import is still refused, and restart makes no publisher request.

## Arizona source review and factual transfer

All eleven Pima County official general candidate pages and its separate one-page
official write-in list were visually reviewed. Their originals and policy/capture
hashes remain preserved; no Arizona payload is integrated at this checkpoint.
The candidate list is visibly dated November 3, 2026 and updated September 9.
It contains 126 named rows; its seven unnamed count rows refer to nine write-ins,
not nine additional names. The separate write-in original lists fourteen people.

Consequential source issues are being reconciled rather than guessed: the flattened
governor/LG table does not explicitly identify each ticket; parties differ within
some apparent pairs. The final city page has a clipped voting-limit instruction.
One legislative candidate continues across a page boundary. The courts must be
checked as retention questions against authoritative judicial material, and schools,
fire districts, precincts, distinct terms and declared write-ins must remain local.

Independent Coconino and official SOS-document policy endpoints returned HTTP 403;
no document fetch, alternate identity or cached-search import bypass follows those
responses. The separate judicial-review host permits its public routes. Its full
linked privacy notice and current review index were read. A normal 200 retrieval
of its official 2026 retention roster produced 88,841 bytes at 19:47:40.275Z,
SHA-256 `066d4a90c0fe25f90e080ec7a1c5098717fc6f39824f5b708fd1afa04ba2f650`.
Its one original page was visually reviewed: one Supreme Court, eight Appeals I,
six Appeals II, two Coconino, 49 Maricopa, ten Pima and six Pinal retention claims.
The source prints 2026, not a specific election date; no unprinted date is assigned.
Search results remain leads, not substitutes for source review or permissions.

The canonical local review transfer contains named-claim CSV, full claim JSONL and
a manifest, plus an exact three-file archive/checksums. It preserves **222 named
source claims**, not 222 deduplicated people: 140 Pima claims plus 82 judicial
roster claims, with overlaps retained for provenance. JSONL separately retains the
seven unnamed count rows. All thirteen original pages, source timestamps, literal
names, party codes, terms, court divisions and clipped-instruction flags remain
traceable. For example, the source literally spells `GONZALEZ, GERTRITRUDE`; no
unverified spelling correction or governor-ticket pairing is applied.

The review CSV round-trips all 222 rows and fields, including four quoted names.
The first draft used JSON-style quote escaping; its exact five owned package files
and two receipts were preserved before correcting the CSV writer. The regenerated
standard CSV, JSONL and archive pass exact field/member/hash checks. No earlier
external file or application code changed for this diagnostic. This is still
review-only material, not a supported application snapshot or a hosted transfer.

## Verification

- Seven focused synthetic checks, normal live download, final compiled refresh,
  exact public API fields, 269-active/three-withdrawn filtering, persistent restart,
  export and invalid-update protection pass.
- Final lint/typecheck, 643 unit passes with two existing optional PostgreSQL skips,
  both builds, 79 compiled back-end modules/runtime assets, all 21 integrated browser
  checks and fifteen native-binding entries pass. The initial targeted linter invocation
  ignored out-of-base paths and is not accepted. Scoped workspace formatting and
  the normal full lint pass replace that diagnostic; unused regex grouping was
  corrected without disabling either lint rule.
- All 26 retained snapshots reconcile exactly through the local built API and
  bounded projection: 18,673 records across 199 pages, with unchanged capture times
  and zero publisher requests. Montana's 28 responsive rendering/WCAG A/AA cases
  cover local records, pagination, source/status filters, unexpired terms, withdrawals,
  typed geography, missing storage, source links, lookup and prior Kansas/Nevada data.
  State-only ZIP results contain seven candidates in two offices, not the seventeen
  regional records or a verified personal guide. Directory browsing does not mutate
  saved lookup state.
- Seven representative final images are visually reviewed without horizontal
  overflow, incorrect local assignment or uncaught page errors. Existing red election
  dates and the concise limited-information warning remain readable in both modes.
- Exact Montana and Arizona-review three-file archives, CSV field round-trip,
  source fingerprints and baseline preservation pass: 126 unrelated paths, seven
  original backups, all 51 prior external files, all five unchanged manifests/lockfiles,
  unchanged heads/empty staging and four worktrees. Ten new ignored data/package
  files bring the external directory to 61 files. The managed dirty-file count is
  132, mostly earlier protected work, not 132 newly edited files.

- Independent local Gitleaks 8.30.1 scans 183 source/data inputs with zero findings
  and no external upload. GitGuardian remains previously unavailable, not a passed
  scan. Final preservation and scan receipts bind the finished documentation and
  package bytes. Temporary isolated stores and test services close normally.

## Changed scope and remaining work

Canonical changed files:

- `back-end/src/state-ballot-sources.ts`: dated public Montana definition.
- `back-end/src/state-ballot-fetch.ts`: bounded, selected anonymous general export.
- `back-end/src/state-ballot-additional-records.ts`: validated public facts/status/term parser.
- `back-end/src/state-ballot-records.ts`: explicit Montana dispatch.
- `back-end/test/state-ballot-montana-arizona.test.ts`: seven synthetic Montana regressions.
- `README.md`: current counts and persistent source flow.
- `docs/state-ballot-sources.md`: collection/setup and review-transfer boundary.
- `docs/state-coverage-2026.csv`: Montana integration and Arizona review readiness.
- `docs/audits/2026-10-21-montana-arizona.md`: current source/verification evidence.

No-change findings: the existing record directory, status filter, source links,
consequential-date styling and limited-information notice already support Montana.
No front-end layout, shared styles, dependency or lockfile changes are needed. No
decorative explanation, onboarding, reassurance or progress commentary is added.

Forty states plus DC now have configured sources, eighteen automatic and 23 dated,
including seven external-only reviewed sources. Ten states lack candidate datasets;
Maine remains municipal-only. Arizona review, local eligibility, measures, profiles,
later amendments and legacy bulk-data migration remain incomplete. Final server-AI
instructions remain queued until the collection/setup work has a verified disposition.
