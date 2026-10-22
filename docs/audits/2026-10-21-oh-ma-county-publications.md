# Ohio and Massachusetts county/city candidate publications

## Scope and delivery

Local continuation from `94d4adc`, preserving all 66 prior owned changed files,
the physical checkout's three unrelated modifications and every other worktree.
No commit, push, tag, release, deployment, production administration, credential,
permission or saved configuration change is authorized or claimed.

Three independently published local election documents add **110 candidate
records**, not two complete statewide ballot datasets. Configured source coverage
is now **31 states plus DC**, with sixteen automatic sources and sixteen dated
snapshots. Nineteen states, broader local eligibility, measures, profiles/news and
election-effective geographic verification remain unfinished.

| Publication | Pages | Records | Statewide | Congressional | Senate | House | Local |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Franklin County, Ohio | 2 + 13 | 78 | 26 | 7 | 7 | 25 | 13 |
| Cambridge, Massachusetts | 3 | 32 | 15 | 2 | 4 | 6 | 5 |

## Official publications and access

The [Franklin County Board of Elections 2026 page](https://www.vote.franklincountyohio.gov/election-info/2026)
links its [general candidate PDF](https://www.vote.franklincountyohio.gov/getmedia/e0a4ca45-6893-45c1-8190-87696f8804b4/2026-General-Candidate-List-5)
under **General Election / Candidates and Issues**, separately from primary
candidates, finance filings and private voter services. Both PDF pages state
**2026 General Election Candidates, Revised October 16, 2026**. The source is
countywide coverage, not every Ohio congressional/legislative district.

The same county index separately links its [updated FWAB election notice](https://www.vote.franklincountyohio.gov/getmedia/352b644d-b348-447e-b60d-aa9b9193a297/2026-General-Form-No-120-FWAB-Notice-46-Day).
Its thirteen pages explicitly identify the November 3, 2026 general election and
candidate-to-precinct applicability. Two visually checked notice claims resolve
the candidate list's blank write-in cell and clipped party field. The notice's
PDF metadata records creation/modification on October 19, but that is not relabeled
as a formal publication date. Broader precinct mapping remains unimplemented.

The [Cambridge Election Commission's current election article](https://www.cambridgema.gov/departments/electioncommission/news/2026/10/november32026stateelectionvotingoptions)
links its [Candidates in Cambridge Districts PDF](https://www.cambridgema.gov/-/media/Files/electioncommission/2026stateelection/candidatesincambridgedistricts.pdf).
All three pages explicitly identify **November 3, 2026 State Election**. The article
was posted October 8 and modified October 14; those are article dates, not an
invented publication date for the PDF. Its first two pages contain candidates;
the third contains question references and a district-specific nonbinding question.

Normal public retrieval of both linking pages and all three PDFs returns HTTP 200 with
successful ordinary TLS verification. Cambridge's robots policy only disallows
its property database. Franklin County's robots URL returns a normal 404 page,
not a challenge or an AI-use restriction. No cookies, account, private voter
lookup, identity override, TLS exception or source-policy bypass is used.

| Original PDF | Bytes | Retrieved UTC | SHA-256 |
| --- | ---: | --- | --- |
| Franklin County | 49,033 | 2026-10-21 11:49:36.945 | `9e5bf3d402e67499caa918f900e35e3950beb6bd169ebb6cf1e7fb1ae7c4b62d` |
| Franklin County FWAB notice | 234,231 | 2026-10-21 12:02:28.707 | `dc69b2b2243507bc84e4dda490d77b8a1f2f96f61b7a90aeaa8f5a8c869bce29` |
| Cambridge | 73,899 | 2026-10-21 11:49:39.783 | `f295146bd0d96e738343a7c83ad4a3ee76dbdd74baf0de11d4e613a15611509b` |

The blocked state candidate sources remain blocked. These are separate local
agencies' own publications, not host aliases for those state portals.

### Wisconsin sources not imported

Sauk County's candidate page is discovered through primary-source search, but
its complete robots policy includes explicit `ai-input=no`, `ai=n` and OpenAI
crawler restrictions below its general rules. The guarded local retrieval aborts
before fetching the index or PDF. No candidate fact from that publication enters
the maintained fixtures, snapshots or transfer. Do not retry that publisher with
another agent, identity, host, path or trust setting to force access.

Green Lake County is a separate official publisher. Its normal robots request
returns HTTP 403, so no candidate page or document is requested. These restrictions
do not prevent using the permitted Ohio and Massachusetts publications.

## Reconciliation

Ohio's coordinate/table extraction reconciles **48 first-page and 30 second-page
rows**. Both candidate-list pages, both Cambridge candidate pages and the two
supplemental FWAB evidence pages are visually reviewed.

- Six governor/lieutenant-governor tickets remain six paired records, including
  three explicitly marked write-in tickets. Wrapped name lines join only to the
  corresponding row; running mates are not detached into additional candidacies.
- All ten explicit **Yes** values in the Write-In column become registered
  write-ins. `N/A` alone never implies write-in status. Gary Josephson's blank
  list cell is preserved as raw evidence, while the separate county FWAB notice
  explicitly marks him a write-in for congressional district 15. This yields
  **eleven** registered write-ins, without treating the blank as affirmative or
  silently publishing him as an ordinary printed-ballot nominee.
- The two Supreme Court term-start dates remain separate contests, as do the
  appellate and common-pleas judicial terms. The US Senate's unexpired term
  ending January 3, 2029 stays in its office identity. A court's district 10
  never becomes congressional or legislative district 10.
- Blank common-pleas cells, `N/A` and `"nonparty"` remain exact. Greg Levy's
  visibly clipped `Other-party c` list cell is preserved in raw evidence; the
  separate notice supplies the explicit **Other-party** label used canonically.
  No independent, nonpartisan or expanded affiliation is guessed. The list's
  `Eboney C. Eldridge` spelling remains unchanged despite the notice's `Ebony`
  variant; no alias, extra candidate or spelling correction is manufactured.
- All 26 published campaign URLs are preserved as safe HTTPS links. They are
  source-published links, not independently verified live campaign websites.
  Email addresses, phone numbers and duplicated/misaligned contact cells are
  excluded from maintained factual data.

Massachusetts reconciles **19 first-page and 13 second-page candidate rows**.

- The printed joint-ticket names remain `HEALEY AND DRISCOLL`,
  `MINOGUE AND OLIVER` and `JAMES AND KITTREDGE`, without invented expanded names,
  inferred withdrawal decisions or separately manufactured running mates.
- Congressional districts 5 and 7 are explicit. Legislative districts retain
  their full names, including both **Middlesex & Suffolk** and **Suffolk &
  Middlesex**, which must not be merged. Numbered Senate/House matches do not
  stand in for these named districts. An exact named match is exercised only
  with controlled geography, not claimed as a live boundary crosswalk.
- Governor's Council, district-attorney and probate records remain local with
  their printed jurisdictions, not generic legislative districts or ZIP-based
  voter membership. Blank write-in slots and complete statewide write-ins are
  not inferred from this local publication.
- Street addresses and residence towns are excluded, not mistaken for the
  candidate's electoral jurisdiction. The question-only third page is not
  parsed into candidates or claimed as complete measure coverage.

## Runtime and transfer

The existing strict reviewed-PDF snapshot loader is used without a new live
scraper, runtime PDF dependency or source-access workaround. The two assets are
`back-end/src/data/state-ballots/ohio-2026.json` and
`back-end/src/data/state-ballots/massachusetts-2026.json`.

Each snapshot retains the exact source index, original PDF URL/hash/capture time
and included count. Its source-set hash follows the existing ordered
`{url, sha256}` contract. Reloads never relabel the historical capture time.
Ohio attributes 76 records to the candidate list and two to the explicit FWAB
claims, retaining all 78 original list rows and both supplemental claims in the
factual fixture. The snapshot timestamp remains the older list retrieval, not
the later notice capture or preparation/export time. The notice capture timestamp
comes from completion of the exact original successful download, retained in the
local capture evidence.
Both assets are independently required by the runtime copier, verifier and
machine-readable artifact contract. Refreshes require reviewed data and original
provenance together; automatic requests remain refused.

The contact-free factual fixture is
`back-end/test/fixtures/state-ballots-county-publications.json`. The canonical
server-transfer file is `docs/data/2026-11-03-oh-ma-candidates.jsonl`: one manifest
and 110 candidates, retaining term identities, source notices and original
document evidence.

## Copy and verification

No new tagline, introduction, onboarding, reassurance or implementation commentary
is added to the interface. Existing limited-coverage feedback already applies.
Only the source date and consequential Franklin/Cambridge coverage limits are
added to the existing dated-source disclosure. Candidate names, party labels,
court terms and source links are substantive visitor content.

- Nine focused tests pass for offline loading, exact source/fixture identities,
  tickets/write-ins/party uncertainty, judicial terms, safe district matching,
  named Massachusetts districts, explicit secondary evidence, preserved original
  cells, strict provenance and exact transfer parity.
- Node 24.18.1/npm 12.0.2 repository lint, typecheck and build pass. Runtime
  verification accepts all 76 compiled back-end modules and required assets.
- Final unit checks report **561 passes**, zero failures and two existing optional
  PostgreSQL skips. All **21 end-to-end tests** and **48 general route/theme
  accessibility checks** pass after the supplemental notice is reconciled.
- All **24 actual-source API/browser cases** pass at widths 320, 390 and 1280,
  preserving every candidate name/party, dated-source scope and saved lookup
  cookie. No overflow, browser error or accessibility violation is reported.
  Every attached supplemental official remains state-qualified.
- The new ZIP cases show Ohio **26 candidates / eight contests** and Massachusetts
  **fifteen / six**. Controlled address cases show Ohio **35 / eleven** and
  Massachusetts **nineteen / nine**. Gary Josephson's explicit Write-in label is
  asserted in the rendered Ohio congressional-district-15 case.
- Four additional focused rendering cases pass at all three widths. Seven final
  desktop/mobile screenshots are visually reviewed, including the two distinct
  Supreme Court terms, write-in label, named Massachusetts districts and source
  limits. Explicit instant scrolling makes these target captures deterministic;
  the superseded smooth-scroll screenshots are removed rather than treated as
  proof of a target that was outside the viewport.
- Compiled offline diagnostics/export pass with exact canonical transfer parity.
  Both new assets independently fail the runtime contract when absent and are
  restored byte-exactly. All fifteen native-binding entries pass. The 51-row
  state inventory matches the thirty-two-source registry, and all sixteen
  reviewed transfer datasets reconcile to **17,091 records**.
- All three original PDF fingerprints, eighteen pages and **357,163 bytes** are
  verified before retention cleanup. Final local Gitleaks covers all **72 retained
  changed files** with zero findings and no upload. All 66 prior changed paths,
  unrelated physical changes, worktree HEADs, staging, dependency manifests,
  lockfiles and the shared transport remain preserved.

Both new address checks use controlled geography, not live Census responses or
verified election-effective district boundaries. This does not establish actual
personal ballot eligibility. No hosted CI, production activation, statewide
district completeness or national completion is claimed.

## Next sources and retention

The independently published Monroe County, New York certification is retrieved
normally through its public index: ten scanned pages, **231,798 original bytes**,
SHA-256 `d96a6ff9124ea7c7fe28d6406f118171e432e465bb81143b37c5fbe124fc774b`.
The first page visibly certifies the November 3 general election, amended October
6 at 9:22 AM. Local OCR and word coordinates are prepared for all ten pages:
2,423 words, 108 below 80 confidence. Candidate names, fusion endorsements,
separate governor/lieutenant-governor sections, district applicability and every
low-confidence factual field still need original-pixel review before import.
This is pending source material, not New York coverage or a candidate dataset.

Dane County, Wisconsin independently permits public paths in its robots policy,
but the normal ballot-index request returns HTTP 403. The local helper requests
no PDF after that refusal. Web-only document text also has conflicting November
dates and a candidate-name concern; none is imported or used to override another
publisher's restriction. Seek another permitted official publication rather than
forcing access to Sauk, Green Lake, Dane or the state portal.

After acceptance, **forty exact owned disposable files totaling 4,012,812 bytes**
are removed: the Ohio contact-bearing candidate PDF/derivatives, redundant source
captures, the ordinary 404/refusal HTML, superseded preliminary check logs and
duplicate non-deterministic screenshots. Compact source fingerprints, policy
receipts, final checks, seven visual-review receipts and twenty focused rendering
screenshots remain. The original Cambridge PDF/layout is retained for unfinished
questions; the Ohio FWAB original/layout for precinct evidence; and the Monroe
original/index plus all ten OCR page images/coordinates for candidate review.
No dependency, cache, other run, canonical source or unrelated worktree is removed.

Original-input preparation/source-acceptance helpers now require a fresh permitted
copy of the exact removed Ohio candidate capture before reuse. Canonical tests,
compiled diagnostics/export and final-state checks remain usable offline. Do not
rerun blocked-source helpers or refetch the retained Monroe corpus just to restate
progress. The national goal remains active for nineteen states and broader local,
measure, profile/news and geographic work.

## Relevant files

- `back-end/src/state-ballot-sources.ts`
- `back-end/src/state-ballot-snapshot.ts`
- `back-end/src/data/state-ballots/ohio-2026.json`
- `back-end/src/data/state-ballots/massachusetts-2026.json`
- `back-end/scripts/copy-runtime-assets.mjs`
- `back-end/scripts/verify-runtime-build.mjs`
- `back-end/test/fixtures/state-ballots-county-publications.json`
- `back-end/test/state-ballot-county-publications.test.ts`
- `deploy/runtime-artifact-contract.json`
- `docs/data/2026-11-03-oh-ma-candidates.jsonl`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `README.md`
- This audit.

All earlier owned changes remain intact. Dependency manifests, lockfiles, shared
transport, staged state, worktree HEADs and unrelated physical work are preserved.
