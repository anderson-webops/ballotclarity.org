# Oregon state and Multnomah County ballot records

## Scope and delivery

Local continuation from `94d4adc`, preserving all 55 prior owned changes, the
physical checkout's three unrelated modifications and every other worktree.
No commit, push, tag, release, deployment, production administration, credential,
permission or saved application configuration change is authorized or claimed.

The canonical candidate transfer contains **279 records**, reconciled from
**338 source claims** across three independently published official documents.
The separate source-claim transfer retains every original claim and its canonical
record ID, original document index, one-based page and printed office/area labels.

| Source | Original pages | Candidate pages | Candidate claims | Newly included records |
| --- | ---: | ---: | ---: | ---: |
| Secretary of State Directive 2026-09 and official statement, September 3 | 18 | 13 | 183 | 183 |
| Multnomah County general ballot-content report, September 22 | 15 | 9 | 109 | 50 |
| Multnomah County RCV ballot-content report, September 22 | 2 | 2 | 46 | 46 |
| Total | 35 | 24 | 338 | 279 |

The full state statement contains 93 contests. The county reports contain 60
printed contest occurrences, 29 of which repeat state contests. All 59 repeated
candidate claims agree on names, party order and incumbent designations. There
are **124 distinct contests** across the accepted records, not 153 distinct
contests or 338 unique candidates.

| Scope | Records | Treatment |
| --- | ---: | --- |
| Statewide | 7 | Four US Senate and three governor records |
| Congressional | 14 | All six congressional districts |
| State Senate | 32 | Fifteen printed general-election contests |
| State House | 114 | All sixty House districts |
| Regional/local | 112 | Courts, district attorneys, county/city offices and utility/conservation districts; export only |

The Senate districts present are 3, 4, 6, 7, 8, 10, 11, 13, 15, 16, 17, 19, 20,
24 and 26. Other Senate districts are not filled with primary candidates or
officeholders. County-filed contests outside Multnomah County, later amendments
and complete write-in coverage are not established by these dated documents.

Configured coverage is now **29 states plus DC**, with sixteen automatic sources
and fourteen dated snapshots. Twenty-one states and broader profile/news,
measure and local eligibility work remain incomplete.

## Independent public publication

[Multnomah County's current general-election page](https://multco.us/info/november-3-2026-general-election)
directly links the following documents as ballot information, separately from
optional candidate statements and voters' pamphlets:

- [Secretary of State's ballot directive and statement](https://multco.us/file/ballot_directive_-_november_3%2C_2026_general/download).
- [General ballot-content report](https://multco.us/file/ballot_content_-_nov._2026/download).
- [RCV ballot-content report](https://multco.us/file/ballot_content_rcv_-_nov._2026/download).

These are an independent county agency's public publications, not an alternate
hostname or identity workaround for a blocked state portal. The county's normal
robots policy permits the relevant public information/file paths. Each original
download returned HTTP 200 with ordinary HTTPS and successful certificate
verification. The three PDFs total **1,371,243 original bytes**.

| Original document | SHA-256 |
| --- | --- |
| State directive | `5014ace823a84d3aba60bbb60642dda04373f6cdf48af1bce34508b5f9656048` |
| County general ballot content | `eec5842cadb8e28513f9fcdc616bbda4d00b80d5e7a456c9c09c3a24d9dd25c8` |
| County RCV ballot content | `c1be7b04d586051f2600be7b8ee8c17ee93d4d6a491ecc8f416c36e613af19f0` |

The state statement is dated September 3, 2026. The county reports are dated
September 22, 2026 at 12:56:05 PM and 12:58:43 PM. The interface preserves both
source dates in its consequential scope disclosure, separately from retrieval
time. No profile, finance registration or primary result is promoted into ballot
qualification.

## State-portal access boundary

The [public Candidate Filing Search](https://secure.sos.state.or.us/orestar/CFSearchPage.do)
offers a normal general-election search action. An ordinary anonymous form read
succeeds, but the attempted public result retrieval does not yield candidates:

- The initial published-action POST returns the application's generic error.
- A fresh normal anonymous-cookie flow returns `csrfInvalid=true`. That
  protection is not disabled or worked around; the temporary cookie is removed.
- An unmodified fresh browser receives the publisher's explicit cybersecurity
  block page, headed **Please Contact Us**, before the candidate form is usable.
  No browser identity, automation fingerprint, TLS, host or access-policy change
  is attempted to force access. The temporary browser profile is removed.
- The portal's robots endpoint attempted an HTTP downgrade. HTTPS-only
  transport refuses it. There is no fallback to insecure HTTP.

The application does not use that portal for this snapshot and makes no public
portal request during loading, caching, checking or export. No authenticated
account, private voter lookup, voter record, CAPTCHA, external support message or
production administration is involved.

## Extraction and reconciliation

The maintained extractor accepts an exact ordered document/page envelope. It
checks the November election, statement/report dates, original page numbers,
closed party vocabulary and original document identities before reading names.
The five directive narrative pages, six measure-only pages and measure text on
county page nine are excluded from the candidate fixture. The original PDFs
remain available locally for unfinished measure review.

- Every state candidate page 6 through 18 is included, including the final
  district-attorney page. All 93 state contest headings are distinct.
- All printed candidate counts and county group contest totals reconcile.
  Missing candidates, count changes, unknown rows or incomplete pages fail
  closed rather than producing a partial list.
- Wrapped county party labels are joined to the correct candidate. All **63
  fusion records** remain one candidacy each with the printed party order.
  Single-candidate general contests remain present, including cross-party
  nominations, rather than being mislabeled as cancelled/unopposed elections.
- County office labels can wrap position numbers onto another line. Fairview
  and Gresham positions stay separate. Lake Oswego's six council candidates and
  the 21/12 Portland council district 3/4 entries are preserved.
- Four judicial **Incumbent** designations remain ballot designations, not
  part of a name or a party. The repeated Sonia A Montalbano claim coalesces
  correctly despite the county's inline hyphenated incumbent suffix.
- Circuit-court district/position, county district-attorney, city and utility/
  conservation jurisdictions remain local. Full jurisdiction names come from
  printed office labels where a report's area heading wraps/truncates them.
  `At- Large` office wrapping is normalized to `At-Large`; raw printed labels
  remain in source-claim evidence. No legal boundary or voter membership is
  inferred from these source strings.
- Repeated state/county claims must agree. Conflicting nominees for the same
  single-choice office/district/party, inconsistent party lists and changed
  incumbent claims are rejected instead of silently overwriting higher-authority
  evidence or adding a second apparent nominee.

No residential addresses, phone/email fields, campaign contact people, guessed
websites, candidate biographies, optional pamphlet essays or raw voter records
are imported. Local measures in the county PDF are not yet an accepted measure
dataset and are not assigned to voters.

## Runtime and transfer contract

The dated runtime snapshot is
`back-end/src/data/state-ballots/oregon-2026.json`.
It retains all three original URLs, byte hashes, capture times and first-included
counts **183 / 50 / 46**. The aggregate timestamp is the oldest capture,
**2026-10-21T10:46:52.076Z**, not a fixture/build/export timestamp.

The source-set hash is
`6cede035a37be83f6387c288000bf1b2adab56d817e40e21e99d1aa3a7dd914f`,
computed from the ordered JSON array of original `{url, sha256}` entries.
Snapshot loading validates that configured document set, counts, hashes,
timestamps, safe public fields and unique record identities.

- `docs/data/2026-11-03-oregon-candidates.jsonl`: one manifest plus 279 canonical
  candidate records, including consequential scope and provenance.
- `docs/data/2026-11-03-oregon-ballot-claims.jsonl`: one manifest plus 338 original
  candidate claims, linked to their canonical records and source contexts.

Runtime needs no PDF software, publisher session, credentials or live provider
request. Automatic retrieval is refused for this reviewed source. A refresh must
review changed source pages, update the fixture/expected source version and
replace records plus original-document provenance together.

ZIP-only lookup receives seven statewide candidates across two offices. Only
explicit address-matched congressional/legislative types can add district
candidates. Regional court numbers and local council/utility positions never
match similarly numbered legislative districts. The result remains limited
official-source content, not a verified personal ballot guide.

## Cross-state officeholder correction

The rendered Oregon address check exposed an additional connected-data defect:
its Senate district 24 was attaching a cached Utah officeholder profile. The
supplemental officeholder matcher compared generic district slugs without
checking the state, even though the caller already had the resolved state code.

The lookup now requires both state and district identity before adding a
supplemental profile. Missing or unrecognized state context attaches no
supplemental profile. Existing provider matches are preserved, and legitimate
Utah matches continue working, whether context uses `UT` or the full state name.
The existing Provo browser fixture now supplies its actual state to the helper;
its original seven officials and expected counts are preserved. No public profile
is deleted or made private.

Four regression tests reproduce the pre-fix failures and pass after the fix.
They cover cross-state collisions, absent state context, provider-match
preservation, lowercase state codes, saved Oregon lookup cookies and linked
district/representative directories. Oregon's active Senate-24 district and
officials directory now remain empty when no Oregon officeholder source is
attached, instead of inheriting Utah's profile. Its twelve applicable candidate
records remain unchanged. Final rendering also checks the state of every
attached supplemental profile across all twenty source-backed lookup cases.

## Copy and verification

The existing candidate section already meets the minimal-copy guidance. No new
introduction, reassurance, onboarding or implementation commentary is added.
Only source publication dates and the genuinely consequential county coverage
limit are added to the dated-source disclosure.

- Thirteen focused tests cover the nine extraction/reconciliation/transfer cases
  and four state-scoped officeholder regressions. All pass.
- Repository lint, typecheck and production build pass. The runtime verifier
  accepts 76 compiled back-end modules and required assets.
- Final unit checks pass: **552 passes**, zero failures and two existing optional
  PostgreSQL skips. All **21 end-to-end tests** and **48 general route/theme
  accessibility checks** pass after the state-scoped officeholder correction.
- All **20 actual-source API/browser cases** pass at widths 320, 390 and 1280.
  Every candidate name and party renders, saved lookup cookies restore correctly,
  and no overflow, browser errors or accessibility violations are reported.
  Supplemental profiles are state-qualified in every case. Oregon ZIP lookup
  shows seven candidates in two contests; the controlled address shows twelve
  in five. Desktop and mobile screenshots are visually reviewed after the fix.
- Address checks use controlled geographic responses. They do not verify live
  Census boundaries, election-effective district vintages or complete personal
  ballot eligibility. Those remain unfinished national verification work.
- Compiled offline Oregon diagnostics and export pass with exact canonical
  transfer parity. Removing only the compiled Oregon asset independently fails
  the runtime contract; restoring it preserves its exact original hash and
  passes the 76-module verifier. All fifteen native-binding checks pass.
- All three original PDF fingerprints and page totals, the candidate fixture,
  snapshot, source-claim/candidate transfers, thirty-source registry and 51-row
  state inventory reconcile. The fourteen reviewed transfers contain 16,981
  canonical records in total; this is not a count of complete personal ballots.
- Final local Gitleaks covers all **66 retained changed files** with zero
  findings and no external upload. No dependency manifest, lockfile, shared
  transport, staged state, worktree HEAD or unrelated physical change is altered.

The run retains the three original public PDFs, their layout text and source
review screenshots for unfinished measure extraction. Twelve owned disposable
portal/error/session targets totaling 136,095 bytes are removed. Compact access
and cleanup evidence remains; the temporary anonymous cookie and browser profile
are gone. No blocked-portal helper is retried. The indexed local working area is
345 MB, including useful prior evidence and pending Connecticut measure inputs;
the Oregon run is 3.7 MB. No dependency cache or unrelated worktree is removed.

## Relevant files

- `back-end/src/state-ballot-oregon.ts`
- `back-end/src/state-ballot-sources.ts`
- `back-end/src/state-ballot-records.ts`
- `back-end/src/state-ballot-snapshot.ts`
- `back-end/src/state-ballot-repository.ts`
- `back-end/src/data/state-ballots/oregon-2026.json`
- `back-end/scripts/copy-runtime-assets.mjs`
- `back-end/scripts/verify-runtime-build.mjs`
- `back-end/test/fixtures/state-ballots-oregon.json`
- `back-end/test/state-ballot-oregon.test.ts`
- `back-end/src/server.ts`
- `back-end/src/supplemental-officeholders.ts`
- `back-end/test/supplemental-officeholders.test.ts`
- `test/e2e-smoke.test.ts`
- `deploy/runtime-artifact-contract.json`
- `docs/data/2026-11-03-oregon-candidates.jsonl`
- `docs/data/2026-11-03-oregon-ballot-claims.jsonl`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `README.md`
- This audit.

Earlier changes remain intact. Dependency manifests, lockfiles, shared remote
transport, staged state and worktree HEADs remain unchanged.
