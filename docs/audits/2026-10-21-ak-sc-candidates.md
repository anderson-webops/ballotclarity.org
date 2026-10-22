# Alaska and South Carolina candidate records

## Scope and delivery

This local continuation starts from `94d4adc` and preserves all forty prior
changed files, every other worktree and the physical checkout's three unrelated
modifications. No commit, push, tag, release, production administration, credential,
permission or saved-configuration change is authorized or claimed.

The canonical transfer is `docs/data/2026-11-03-ak-sc-candidates.jsonl`, with one
manifest and **1,598 candidacy records**. Alaska contributes 155 certified
candidate/retention records as a dated snapshot. South Carolina contributes
1,443 public general-election filing records and has a supported automatic
anonymous search adapter. Configured coverage is **27 states plus DC**: sixteen
automatic sources and twelve dated snapshots. Twenty-three states and broader
profile/news, measure and local ballot-mapping work remain unfinished.

| State | Source records | Preview-eligible records | Statewide | Congressional | State Senate | State House | Regional/local, export only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Alaska | 155 | 155 | 18 | Included at large in statewide | 24 | 93 | 20 |
| South Carolina | 1,443 | 1,175 | 53, including inactive | 48 | 0 | 312 | 1,030 |

These counts describe source claims, not unique people or complete personal
ballots. ZIP/state-only previews show eighteen Alaska entries and twenty-three
active South Carolina entries. Verified address-district matches may add the
applicable legislative/congressional records. Regional and local records are
not assigned from filing location, a county label or a ZIP centroid.

## Alaska: dated certified general-election list

The [official election information page](https://www.elections.alaska.gov/election-information/)
publishes a [general-election candidate link](https://www.elections.alaska.gov/candidates/?election=26genr).
This is important because the newer `/election-candidates/` entry renders a
primary-election table by default even though its surrounding navigation names
the upcoming general election. That default table is not nomination evidence.
No public search form was submitted or primary advancement inferred for Alaska.

The explicit `26genr` list identifies **2026 General Election**, November 3, 2026,
and links three numbered pages using `frm-page-407`. All three were captured with
ordinary HTTPS validation. Each page's active number and full published pager
are verified, as are its election heading/date, race labels, complete candidate
table columns and explicit `Certified`/`Certified Write-In` markers.

- The three pages contain 197 source claims: 76, 64 and 57. Twenty-one judicial
  claims repeat on each page. Only the 42 identical repeats are removed, leaving
  **155 distinct records**. Inconsistent repeated claims fail closed. Per-document
  newly included counts are 76, 43 and 36.
- There are 149 ordinary certified records and six certified write-ins. Names,
  declared party registration and governor/lieutenant-governor tickets are kept
  as published, including mixed-registration tickets. Registration is not
  relabeled as a party nomination in Alaska's top-four system.
- All forty House districts and ten alphabetic Senate districts are present.
  Numeric House and alphabetic Senate labels are checked separately, with no
  invented conversion between the source's letters and district numbers.
- The at-large U.S. House applies statewide. The one state Supreme Court
  retention question is statewide. Twenty superior/district-court questions
  remain regional and cannot match unrelated legislative district numbers.
- Eighty-seven safe source-published campaign website links are retained. Mailing
  addresses, phones and email fields are excluded, and no website is inferred
  from an email address or a pamphlet submission.

The supported Node runtime still reports `unable to verify the first certificate`
for this publisher. The separate curl captures report successful TLS verification.
No trust store, certificate policy, identity or TLS check was changed to force
automatic retrieval. Alaska is therefore a bundled, dated snapshot, not an
automatic feed. Its original capture dates and ordered original-body hashes stay
fixed across cache reloads. Later source changes require a reviewed refresh.

## South Carolina: anonymous current search

The [Election Commission candidate page](https://scvotes.gov/candidates/) links a
public candidate tracking system. Its explicit
[November general-election search](https://vrems.scvotes.sc.gov/Candidate/CandidateSearch?electionId=22596)
is separate from the voter lookup that requires personal information/reCAPTCHA.
No voter record, voter login, CAPTCHA or private endpoint was queried.

The published search client sends the public form to
`/Candidate/CandidateSearch/`. The adapter uses that same anonymous operation:

- Verify election ID `22596` and **11/3/2026 Statewide General Election**.
- Select the published `All` values, leave candidate names empty, and omit county
  selections. No source filter is silently retained.
- Submit only observed public form fields using the existing guarded HTTPS
  transport. No authentication, cookie credential or custom transport identity
  is added. The normal Node request succeeds without a TLS override.
- Parse the full client-side result table, not a visible DataTables page.
  All 1,443 sequential row indexes and public candidate IDs are unique. Election
  identity, complete table termination, column layout, row order, known statuses
  and per-row official detail links are validated. Changed or incomplete layouts
  stay unavailable rather than becoming a partial ballot preview.

The general-election search also carries inactive primary/convention filings.
Its source statuses map as follows:

| Status class | Records | Treatment |
| --- | ---: | --- |
| Active | 1,175 | Listed source claims; not promoted into a verified personal ballot |
| Defeated in primary/convention | 216 | Retain as evidence; withhold from previews |
| Withdrawn | 37 | Retain as evidence; withhold from previews |
| Disqualified, uncertified, failed petition | 13 | Retain as evidence; withhold from previews |
| Deceased | 2 | Retain exact source status; withhold from previews |

Four active governor candidates have explicitly active named running mates; each
is retained as one ticket. Inactive placeholders such as `Not Designated` do not
become candidates. State Superintendent of Education is correctly statewide;
solicitor circuits, boards, county offices and special districts remain local.
Race counties come from **Associated Counties**, not **Location of Filing**.

Every record retains its published government candidate-detail link and public
candidate ID. These are **official detail links**, not 1,443 campaign websites or
newly researched biographies. The application can refresh this source; the
transfer still records the actual reviewed capture. A fresh automatic export may
have a different retrieval time and full-page fingerprint even if candidate
fields are unchanged.

## Connecticut and Oregon follow-up evidence

The [Connecticut November sample-ballot index](https://portal.ct.gov/sots/election-services/town-ballots/2026-november-town-election-ballots)
has 134 distinct linked town PDFs and explicitly says publication is rolling.
The previous count of 135 PDF links included one unrelated Sitecore accessibility
navigation document; filtering the published ballot paths corrects that count.
Unlinked town names are not treated as available ballots. Three normal downloads
were validated: one-page Andover, 24-page Bridgeport and 24-page Hartford.
The Andover ballot was also rendered and visually reviewed.

All **134 published town ballot PDFs** were subsequently captured sequentially,
reusing the three samples and making no more than one request per second. Each
returned HTTP 200 with normal TLS validation. Their **509 pages** all carry the
current November election date. Original-body hashes, retrieval times, page counts
and layout text are retained in the indexed local run. This completes acquisition
of the published set, not candidate extraction, statewide completeness or site
integration.

These samples establish the need to preserve governor tickets and multiple
fusion-party lines without duplicating a person as separate candidates. Bilingual
multi-precinct pages carry different district combinations. Naive raw text
extraction joins some names, while coordinate/layout extraction preserves their
spacing. The samples and exact download fingerprints remain in the indexed local
run for complete-page extraction and reconciliation next. No three-town sample
is mislabeled as complete Connecticut coverage.

Oregon's current official candidate-filings page and November voter-pamphlet
index were rechecked. The former supplies open offices, not a certified candidate
roster. Optional pamphlet participation and campaign-finance registration are not
substituted for ballot qualification. The previously refused HTTP downgrade on
the search host is not retried or bypassed.

## Privacy and copy

The two new fixtures minimize complete observed candidate row sets. Alaska keeps
identity/certification markup and safe website links but removes address/contact
cells. South Carolina keeps the seven public factual columns and official detail
links, without following its more contact-heavy export. Original-source hashes
are verified separately; minimized fixture bytes are not represented as those
original bytes. Both fixtures reproduce every canonical transfer candidate field.

No onboarding, reassurance, implementation commentary or decorative heading is
added to the interface. Existing coverage limits, election/retrieval dates and
official-source links remain necessary. Alaska's notice retains the dated-snapshot
limitation without the unnecessary generic filing-qualification sentence, because
this source explicitly certifies its included records. South Carolina retains
the listing/qualification distinction. Technical source-access diagnostics stay
in this operator report rather than in voter-facing copy.

## Local verification

All checks run locally with Node 24.18.1 and npm 12.0.2:

- Lint, typechecks, both builds and 530 unit tests pass. Two optional PostgreSQL
  integration tests are skipped; no database acceptance is claimed.
- All ten new state regressions and eleven preceding portal regressions pass.
- All 21 end-to-end tests and 48 general route/theme accessibility checks pass.
- Sixteen additional actual-source cases cover twelve state/DC ZIP results and
  four controlled address-district results at widths 320, 390 and 1280. Every
  applicable candidate, detail/campaign link and ballot designation matches the
  API and restored cookie result. No browser errors or horizontal overflow occur.
  Each case passes WCAG A/AA scanning, totaling **64 accessibility checks**.
- All eight new desktop/mobile screenshots were visually reviewed. Alaska ZIP
  and controlled-address cases show 18/21 candidates across 4/6 contests; South
  Carolina shows 23/28 across 8/10. These addresses and district matches are test
  fixtures, not externally geocoded real addresses or verified boundary claims.
- Compiled live source diagnostics load Alaska's 155 dated records and retrieve
  all 1,443 South Carolina records through the supported automatic adapter.
  A new compiled `AK SC` export has exactly the same 1,598 candidate lines as the
  reviewed transfer. Alaska's capture metadata is unchanged; South Carolina's
  new timestamp/fingerprint is preserved rather than relabeled as the old capture.
- Original fingerprints for all five AK/SC source bodies are checked separately
  from minimized fixture parity. The canonical transfer contains 1,599 lines.
- The independent runtime verifier accepts 73 compiled modules and required
  assets. Deliberately removing the Alaska asset causes rejection, its exact-byte
  restoration is verified, and the final verifier passes. Fifteen native-binding
  checks pass.
- The 51-row inventory and registry agree on 28 jurisdictions, sixteen automatic
  sources and twelve snapshots. Local Gitleaks scanning of all forty-seven
  retained changed files finds no secrets and uses no external source upload.
- Dependencies, lockfiles and the shared HTTP transport remain unchanged. No
  files are staged. Both checkouts retain their original HEAD, and all three
  unrelated physical changes retain their protected hashes.

Disposable AK/SC contact-bearing source captures, raw public scripts and duplicate
exports are removed after acceptance. Factual fixtures, original fingerprints,
the canonical transfer, logs, reports and screenshots remain. Connecticut's
explicitly indexed public ballot corpus is retained for its pending extraction,
not deleted as completed scratch. No hosted CI, deploy-ready release acceptance,
production activation or publication is implied.

## Changed files

- `back-end/src/state-ballot-sources.ts`
- `back-end/src/state-ballot-records.ts`
- `back-end/src/state-ballot-portal-records.ts`
- `back-end/src/state-ballot-fetch.ts`
- `back-end/src/state-ballot-snapshot.ts`
- `back-end/src/state-ballot-repository.ts`
- `back-end/src/data/state-ballots/alaska-2026.json`
- `back-end/test/state-ballot-ak-sc.test.ts`
- `back-end/test/fixtures/state-portals-alaska.json`
- `back-end/test/fixtures/state-portals-south-carolina.json`
- `back-end/scripts/copy-runtime-assets.mjs`
- `back-end/scripts/verify-runtime-build.mjs`
- `deploy/runtime-artifact-contract.json`
- `docs/data/2026-11-03-ak-sc-candidates.jsonl`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `docs/audits/2026-10-21-public-state-portals.md`
- `README.md`
- This report.

The shared HTTP transport, TLS/public-IP/redirect requirements, dependency
manifests/lockfiles, geocoder, front-end code and saved application configuration
remain unchanged by this batch.
