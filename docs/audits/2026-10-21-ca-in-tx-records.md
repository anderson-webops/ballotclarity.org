# California, Indiana and Texas candidate records

## Scope and delivery

Local continuation based on `94d4adc`, preserving the previous five-jurisdiction
snapshot batch and all unrelated physical-checkout work. This batch adds three
dated datasets, not three automatic refresh adapters. No commit, push, tag,
release, production change, new credential or permission change is authorized.

The new canonical transfer is
`docs/data/2026-11-03-ca-in-tx-candidates.jsonl`: one manifest and **11,620 records**.
Together with the existing configuration, coverage is **23 states plus DC**,
comprising fifteen automatic feeds and nine dated snapshots. Twenty-seven states,
local ballot mapping, measures and broader candidate profiles remain unfinished.

| State | Records | Statewide | Congressional | State Senate | State House | Local, export only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| California | 388 | 18 | 104 | 40 | 156 | 70 |
| Indiana | 7,392 | 10 | 26 | 50 | 185 | 7,121 |
| Texas | 3,840 | 57 | 86 | 31 | 289 | 3,377 |

These are candidacy records, not a count of unique people or complete personal
ballots. Local rows are preserved but never assigned from a ZIP, county centroid,
or an unrelated legislative district. Existing lookup, guide-publication and
provider safety boundaries remain unchanged.

## California

- [Official general-election page](https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026)
  publishes the [August 27 certification](https://elections.cdn.sos.ca.gov/statewide-elections/2026-general/cert-list-candidates.pdf).
- The original contains a certification cover plus 41 numbered candidate pages.
  The first 32 numbered pages contain 324 named candidates across 164 offices:
  eight statewide offices, four equalization districts, 52 congressional
  districts, twenty **even-numbered** Senate districts and eighty Assembly
  districts. Assembly districts 4, 8, 22 and 32 each list one candidate.
- The remaining pages contain 64 separate judicial-retention questions. Only
  Kelli M. Evans and Joshua Groban, explicitly listed for all 58 counties, are
  statewide. The other 62 appellate questions remain regional/local. Each
  person's question is a separate contest rather than an ordinary competitive
  race containing all retention judges.
- All 324 ordinary candidates retain their certified `ballotDesignation`.
  Incumbent asterisks are not part of the candidate's name. These short factual
  ballot descriptions are labeled as designations, not independent biographies.
- The September 23 contact list was inspected separately, but no addresses,
  phone numbers, emails or campaign URLs from it are included in this batch.
  Its hash is not incorrectly substituted for the certification's provenance.
  All 324 ordinary candidate names and parties match that independently published
  contact list; the certification remains the canonical roster.
- The main site's robots response was empty HTTP 200. The CDN's robots endpoint
  returned S3 AccessDenied, while the explicitly published PDF objects returned
  HTTP 200 normally. Policy availability is recorded as unavailable, not falsely
  described as permission. No alternate identity, challenge or access bypass
  was used. The 14.8 MB original was bounded to 20 MiB for this local review;
  the runtime's 12 MiB automatic transport limit was not changed.

## Indiana

- The [Election Division homepage](https://www.in.gov/sos/elections/) publishes the
  [September 22 abbreviated general-election workbook](https://www.in.gov/sos/elections/files/Candidate_List_Abbreviated_20260922_011251PM.xlsx).
  The workbook identifies `ALL COUNTIES` and `2026 GENERAL ELECTION - 11/3/2026`.
- Read-only extraction checks the sheet name, repeated ballot-name/party/office/
  filed-date headers, all 32 office categories, the election marker and every
  populated row. No formulas or external workbook links are executed.
- There are 7,394 candidate rows. Two exact duplicate pairs, including identical
  filing dates, reduce this to 7,392 records: Gegory (Max) Whaley's Dillsboro
  District 1 entry and Andrea S. Brown's Southwest Dubois District 3 entry.
  Source spellings are preserved rather than silently corrected.
- One additional apparent identity, Jenilee Haynes Peterson's Michigan City
  school-board filing, has two source rows with different affiliation values:
  blank and `Non Partisan`. Both source claims remain rather than inventing a
  resolution. They are local and never duplicated in a voter-facing preview.
- Nineteen rows have no filing date and remain included. Nineteen explicit
  write-ins retain write-in status. Their `Write-In (...)` source notation is
  preserved in `sourceStatus`, while the explicit enclosed affiliation is the
  party field, avoiding a repeated write-in label. The 497 ordinary and four
  write-in blank-parenthesis affiliations are left unset, not relabeled
  independent or nonpartisan.
- Congressional ordinal labels map to all nine districts. The 25 Senate and 100
  House district identifiers are normalized numerically. Statewide secretary,
  comptroller and treasurer filings are distinct from county offices.
- The other 7,121 rows retain their full township, county, municipal, school,
  judicial or special-district office labels and remain local. The two sewer
  district entries are not dropped as unrecognized metadata.
- The source is a dated candidate-filing export. It does not independently
  prove final printed-ballot qualification. The existing filing limitation is
  retained. Public robots rules do not exclude the observed source path.
- No spreadsheet or ZIP dependency is added to the production service. A future
  automatic adapter still needs bounded binary/XML parsing and election/schema
  verification; this snapshot does not pretend to perform that refresh.

## Texas

- The [official general-election page](https://www.sos.state.tx.us/elections/laws/2026-november-general-election.shtml)
  publishes the [August 28 final ballot certification](https://www.sos.state.tx.us/elections/forms/2026-ballot-cert.pdf)
  and [declared write-in certification](https://www.sos.state.tx.us/elections/forms/2026-write-In-ballot-cert.pdf).
- All 1,395 numbered report pages following the certification cover are checked
  in sequence. Their 17,918 county-level candidate occurrences cover all 254
  counties. Deduplication retains 3,823 distinct certification records, followed
  by seventeen separately certified declared write-ins, totaling 3,840.
- The deduplication key preserves office/place/term, district, candidate, party
  and local jurisdiction. Repeated state/district entries do not multiply by
  county. Generic county offices do not collapse across counties.
- County judge appears in all counties but remains local. Frequency of a generic
  office label is not statewide eligibility. Only an explicit statewide office
  allowlist is used, with each statewide candidate checked against all counties.
- The [Fifteenth Court of Appeals](https://www.txcourts.gov/15thcoa/) is statewide.
  Its three places are distinct; the other appellate districts remain regional.
  Judicial districts, education districts and county precinct numbers are never
  treated as legislative district matches.
- The write-in PDF was visually reviewed, including the superscript **31st**
  Judicial District for Leslie Timmons and **276th** for Michael P. Kopech.
  The text layer's corrupted `3fS1` is not imported as a district identifier.
  Write-ins have no inferred party affiliation or printed-ballot claim.
- Senate District 22 and House District 93 special elections are published
  separately for the same date. Those special candidacies are not present in
  this regular-general certification; the interface and transfer preserve that
  consequential limitation without merging full and unexpired terms.
- Public robots returned empty HTTP 200. No voter portal, personal-information
  form, CAPTCHA, authentication or alternate user-agent bypass was used.

## Provenance, privacy and presentation

Each snapshot retains the original source URL, original-byte SHA-256, capture
timestamp and included-record count for each of its four source documents. The
composite hash covers their ordered URL/hash descriptors. California's capture
timestamp is the original downloaded file's write-completion time, not a new
review time. Other captures use the saved successful retrieval metadata.

The strict loader validates reviewed XLSX and PDF provenance alike. Automatic
transport refuses all three manual sources, including after cache expiry. The
transfer exactly reproduces the validated datasets and their document evidence.
There is no residential/contact data, copied candidate essay, donor information,
invented campaign URL, inferred endorsement or reconstructed primary winner.

The only new explanatory label in the interface is **Ballot designation**, which
identifies substantive certified candidate data. Existing source dates, election
dates, official links, limited-coverage feedback and consequential limitations
remain necessary. No onboarding, reassurance, implementation/progress commentary
or decorative introduction is added. Indiana's redundant write-in prefix is
removed from its affiliation field without dropping the source notation or
explicit affiliation. The existing results copy otherwise needs
no change for this batch.

The Census current-vintage response was checked at the public Texas Capitol
coordinates. It returned `120th Congressional Districts` and `2026 State
Legislative Districts` upper/lower layers. The existing parser already recognizes
dynamic layer names. No speculative geocoder change or claim of an old-district
bug is warranted by that observed response.

## Local verification

- Lint and front-end/back-end typechecks pass on Node 24.18.1/npm 12.0.2.
- Full unit checks: **507 passed**, zero failures, two optional PostgreSQL skips.
  The six new source tests and seven previous reviewed-PDF regressions pass.
- Both production bundles build; **72 compiled backend modules** and every
  independently required runtime asset are accepted. **21 end-to-end tests** pass.
- Accessibility: **48 general route/theme checks plus eight actual-source
  pages**, with zero reported violations. All eight dated datasets were checked
  through the built API and front end at 320, 390 and 1280 pixels. Every eligible
  candidate and California designation renders; source/election dates, limitations
  and official links remain visible. Signed lookup-cookie restoration returns
  the same source records. No browser errors or horizontal overflow were found.
- The new three states' desktop/mobile screenshots and representative original
  PDF pages were visually reviewed. Indiana's redundant write-in prefix was
  corrected and the final data, unit, build, browser and accessibility checks
  rerun rather than accepting the earlier screenshot as final evidence.
- Each new compiled snapshot was separately removed for a negative verifier
  check, rejected, restored byte-for-byte, and reaccepted by the full verifier.
  Compiled source diagnostics and exact JSONL transfer parity pass offline.
- The configuration and coverage CSV agree on 24 distinct jurisdictions:
  fifteen automatic sources and nine manual snapshots. Fifteen native-binding
  checks pass. Dependency manifests and lockfiles remain unchanged.
- An offline Gitleaks scan of all 28 retained changed source/data/document files,
  about 9 MB, found no secrets. No hosted source-code scan was substituted.
- All temporary review servers, browser instances and test commands finished.
  Raw downloaded source/contact files and duplicate scratch exports were removed
  after acceptance; factual curation, fingerprints, candidate-only previews and
  verification evidence remain in the indexed local run.

No CI, publication or production activation is claimed. The earlier local-only
delivery restriction remains in force. New York's normal certification download
still returned HTTP 403, and Oregon still lacks a validated general-election
certification adapter; these do not justify bypassing publisher or TLS controls.

## Changed files

- `back-end/src/data/state-ballots/california-2026.json`
- `back-end/src/data/state-ballots/indiana-2026.json`
- `back-end/src/data/state-ballots/texas-2026.json`
- `back-end/src/state-ballot-sources.ts`
- `back-end/src/state-ballot-snapshot.ts`
- `back-end/src/state-ballot-records.ts`
- `back-end/src/state-ballot-repository.ts`
- `back-end/src/state-ballot-export.ts`
- `back-end/src/types/civic.ts`
- `front-end/src/types/civic.ts`
- `front-end/src/components/BallotContentPreviews.vue`
- `back-end/scripts/copy-runtime-assets.mjs`
- `back-end/scripts/verify-runtime-build.mjs`
- `deploy/runtime-artifact-contract.json`
- `back-end/test/state-ballot-ca-in-tx.test.ts`
- `docs/data/2026-11-03-ca-in-tx-candidates.jsonl`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `README.md`
- This audit report.

The previous batch's five snapshots, test, audit and transfer are preserved. No
dependency manifest/lockfile, geocoder, permission, saved application setting or
production configuration changes. The physical checkout's existing `.gitignore`,
`AGENTS.md` and `GEMINI.md` modifications and all other worktrees are untouched.
