# Pennsylvania and West Virginia public candidate records

## Scope and delivery

Local continuation based on `94d4adc`, preserving the previous 28 changed files
and the physical checkout's three unrelated modifications. These two additions
are **dated snapshots**, not automatic feeds. No commit, push, tag, release,
production administration, credential, permission or saved-configuration change
is authorized or claimed.

The canonical transfer is `docs/data/2026-11-03-pa-wv-candidates.jsonl`: one
manifest and **1,006 candidacy records**. Configured coverage is now **25 states
plus DC**, with fifteen automatic sources and eleven dated snapshots. Twenty-five
states, broader profiles/news, measures and local ballot mapping remain unfinished.

| State | Records | Active records | Statewide records | Congressional | State Senate | State House | Local, export only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pennsylvania | 442 | 436 | 8, including two withdrawals | 35 | 49 | 350 | 0 |
| West Virginia | 564 | 564 | 4 | 5 | 41 | 203 | 311 |

These are candidacies/source claims, not unique people or complete personal
ballots. State-only/ZIP lookups show six active Pennsylvania entries and four
West Virginia entries. Supported address-district matches may add the applicable
congressional and legislative records; local records remain unassigned.

## Pennsylvania

The [Department of State](https://www.pa.gov/agencies/dos/programs/voting-and-elections/running-for-office)
links its [public candidate database](https://www.pavoterservices.pa.gov/ElectionInfo/ElectionInfo.aspx).
The reviewed page selected **2026 General Election (11/03/2026)**, value `116`,
and contained the full 1,298-row client-side dataset, not just a visible page.

That dataset is not itself a final general-election ballot roster:

- It contains 774 Democratic/Republican state-committee entries, which are excluded.
- It also includes unsuccessful primary filings under the selected general
  election. Petition/primary-write-in records require the source's explicit
  primary-winner flag. Approved nomination papers and substitutes are retained
  separately. Raw vote totals are not used to reconstruct nominees.
- Five exact duplicate candidacy claims are collapsed, leaving 442 records.
  Five explicit withdrawals and one inactive cross-filing remain as evidence
  but are withheld from previews. John Ventre's unsuccessful primary filing is
  not imported as a current nominee; Jason Richey's duplicate is not rendered twice.
- A `Write-in` **filing type** with a primary-winner flag describes a primary
  nomination, not a general-election write-in candidacy. Such nominees remain
  listed candidates rather than being incorrectly badged write-in. Likewise,
  the currently false general-result flags do not mean candidates were defeated.
- Governor and lieutenant-governor records remain separate source candidacies.
  No joint-ticket pairing is invented merely from a shared party.
- The five public-office types and ordinal congressional, senatorial and
  legislative districts are validated explicitly. Selection/date changes,
  mixed years, unknown status/type flags, ambiguous populated dataset containers
  and office/district mismatches fail closed.

The normal Node importer received a **922-byte response without a title or
election controls**, not the reviewed candidate page. That observation does not
establish why the publisher returned the wrapper. The existing importer identity
was not changed to force a different response. A public Candidate List button
also returned a generic report wrapper rather than an independently validated
roster; it is not used as qualification evidence. The working reviewed public
capture supplies the immutable local snapshot instead.

## West Virginia

The current [Secretary of State elections page](https://sos.wv.gov/elections)
links a [new candidate portal](https://candidates.wvsos.gov/regular), distinct from
the legacy historical selector. Its published client uses an anonymous candidate
results/export service as well as a separate authenticated content-management
service. Only the anonymous public routes were requested. No authenticated CMS
request or embedded credential was used or retained.

The public results endpoint is
`https://candidates.wvsos.gov/candidate-web-api/candidates`. Both reviewed requests
used `Content-Type: application/json`, no Authorization header, and fixed public
payloads:

```json
{"candidateType":"R","page":0,"size":5000}
{"candidateType":"W","page":0,"size":5000}
```

- The regular response contains 3,278 rows: 552 current general-election rows,
  twelve earlier Hamlin municipal rows and 2,714 primary rows. The regular
  endpoint also includes nonpartisan type `N`; it is not restricted to type `R`.
- The write-in response contains fifteen rows, twelve current general and three
  primary. Both responses explicitly report first/last page, one total page,
  page zero, a 5,000-row limit and matching total/returned counts.
- Only exact **11/03/2026**, **GENERAL**, election ID `19080` and the matching
  election-name marker are included. All 564 included public candidate IDs are
  unique. Primary losers, earlier elections and party committee offices do not
  become November ballot records.
- There are twelve general-election write-ins and twelve nonpartisan records.
  The source's broad `STATEWIDE` category means state-filed offices, not statewide
  voter eligibility. Circuit/family courts and their divisions remain regional;
  their numbers are never matched to unrelated legislative districts.
- Public candidate IDs and original district/division/area labels are retained
  as reconciliation fields. Judicial divisions stay distinct. Raw area labels
  are not promoted into inferred personal ballot eligibility.
- The API field named `townName` was checked against the anonymous CSV export's
  distinct **County** column for all 552 regular/nonpartisan and twelve write-in
  records. This verifies the source's race-county labels without using its
  separate residential county, street address or mailing information.
- All 108 safe source-published website links are retained. Bare published domain
  names receive an HTTPS scheme; links are not inferred from email addresses.
  Unsafe schemes, credentials and private/local hosts are suppressed. These are
  source-published links, not independently verified biographies or endorsements.

The supported Node runtime could not validate the publisher's certificate chain:
`unable to verify the first certificate`. The separate ordinary curl capture
reported successful operating-system TLS verification. That does not justify
changing the application's trust policy. No certificate check was disabled,
alternate trust store configured, TLS downgraded or new trust anchor installed.
Automatic retrieval is therefore disabled and the reviewed snapshot is bundled.

## Evidence, privacy and presentation

The Pennsylvania original HTML and both original West Virginia JSON bodies are
independently fingerprinted. West Virginia's document order is regular then
write-in; the endpoint URL is the same but the public payloads and original body
hashes differ. The source-set hash covers the ordered `{url, sha256}` descriptors.
The snapshot timestamp is the oldest included capture, not the current cache-load
time. Document counts, dates, URL order, fingerprints, record identities and the
public-field allowlist are checked by the strict loader.

The fixtures contain the complete observed row sets with only required factual
fields. Residential/mailing addresses, personal contact fields and irrelevant
document/finance links are removed. Fixture-byte hashes are **not** represented
as the hashes of the unredacted source bodies. Parsing the minimized fixtures
reproduces every canonical candidate field in the transfer; original-byte
fingerprints are checked separately against the captured raw material.

No visible onboarding, reassurance, project commentary, implementation explanation
or new decorative heading is added. The existing limited-coverage heading,
retrieval/election dates, official-source links, dated-snapshot limitation and
status feedback already meet the copy guidance and remain unchanged. Access and
certificate diagnostics belong in this operator report, not the interface.

## Address routing correction

The built-page review found that a resolved address outside a published local
guide returned district matches but omitted its state location context. This
prevented the state candidate adapter from attaching records to the initial
address response or the restored browser context. ZIP lookups were unaffected.

The response now retains a state selection only when the provider supplies a
recognized state code. It does not infer a state from submitted text, use an
unknown code, promote a local guide, or put a street address in a location label,
slug or saved cookie. Existing address-verification flags remain distinct from
guide availability. Controlled North Carolina API checks cover statewide-only
ZIP results, district-specific address results and cookie restoration; two
additional unit regressions cover recognized and missing/unknown state context.
Ordinary API tests now explicitly disable the live state repository unless a
test supplies its own fixture, avoiding new provider dependencies in local tests.

## Other remaining-state evidence

- **Connecticut:** the [current November sample-ballot page](https://portal.ct.gov/sots/election-services/town-ballots/2026-november-town-election-ballots)
  publishes 135 distinct PDF links, including one unrelated accessibility document.
  The subsequent AK/SC review isolates 134 actual town-ballot PDFs. These still need town/district completeness,
  joint-ticket and fusion-line reconciliation. Campaign-finance registrations
  were not substituted for ballot qualification.
- **Arkansas:** the public root still identifies the earlier preferential
  primary/nonpartisan judicial general election, not November. Its ten-second
  crawl delay was honored; no primary winners were inferred.
- **Idaho:** a current general-election page, statewide measure material and
  official pamphlet are identified. The candidate app previously returned a
  script HTTP 406; its robots path now returns HTML with noindex/nofollow rather
  than a valid robots policy. No app/challenge bypass was attempted.
- **Louisiana:** public robots explicitly disallows statewide and parish
  candidate-inquiry routes, which were not queried. The
  [official election page](https://www.sos.la.gov/elections-voting/election-dates)
  distinguishes November's Senate general election from House open-primary and
  local contests. A future adapter must preserve these different stages.
- **Maine:** direct requests for the published general workbook, September
  replacement/withdrawal PDF and October declared-write-in PDF returned HTTP 403.
  No host-alias, identity or TLS workaround was used.
- **Oklahoma:** the public book is the April filing list, not a November roster.
  The separate filing host's policy endpoint returned HTTP 403. No private voter
  warehouse, authenticated portal or primary-outcome inference was used.

## Local verification

All checks ran locally with Node 24.18.1 and npm 12.0.2:

- Lint, typechecks, both builds and 520 unit tests pass. Two optional PostgreSQL
  integration tests are skipped; no database or hosted CI acceptance is claimed.
- The eleven portal regressions, thirteen previous reviewed-dataset regressions
  and focused address API checks pass. The address-state regression failed before
  the correction and passes afterward.
- All 21 end-to-end tests and 48 general route/theme accessibility checks pass.
- Twelve additional built-page cases use the actual ten bundled state/DC datasets
  with external browser requests blocked. Every applicable candidate, published
  campaign link and ballot designation matches the API and restored cookie
  result at widths 320, 390 and 1280. Each case passes its WCAG A/AA scan with no
  browser errors or horizontal overflow, totaling **60 accessibility checks**.
- Pennsylvania and West Virginia ZIP results show six and four candidates. Two
  controlled address-district cases show ten and fourteen candidates respectively,
  each across five contests. Their geography is an explicit test fixture, not a
  claim that those synthetic addresses were geocoded or mapped to real boundaries.
  All eight new desktop/mobile screenshots were visually reviewed.
- The independent runtime verifier accepts 73 compiled modules. Removing each
  new compiled snapshot separately causes rejection; exact-byte restoration is
  verified and the final verifier passes. Fifteen native-binding checks pass.
- Compiled source diagnostics load all 442 Pennsylvania and 564 West Virginia
  records without live retrieval. The compiled export exactly matches every byte
  of the 1,007-line canonical transfer. Original source-body fingerprints were
  independently checked before removing the disposable raw downloads.
- The registry and 51-row research inventory agree on 26 integrated jurisdictions:
  fifteen automatic sources and eleven snapshots. Local Gitleaks scanning of all
  forty retained changed files finds no secrets; no source upload is used.
- Manifests, lockfiles and shared HTTP transport remain unchanged. No files are
  staged. Physical main and the managed checkout retain their original HEAD;
  all three unrelated physical changes retain their protected hashes.

Only generated raw source/contact downloads, public form tokens and duplicate
scratch exports are removed after acceptance. Canonical factual fixtures, source
fingerprints, records, transfer, reports, verification scripts/logs and candidate
screenshots remain. Scripts needing the removed original inputs require a fresh
permitted retrieval before reuse. This batch is local and unpublished; no hosted
CI, release artifact acceptance or production activation is implied.

## Changed files

- `back-end/src/state-ballot-portal-records.ts`
- `back-end/src/state-ballot-additional-records.ts`
- `back-end/src/state-ballot-records.ts`
- `back-end/src/state-ballot-export.ts`
- `back-end/src/state-ballot-sources.ts`
- `back-end/src/state-ballot-snapshot.ts`
- `back-end/src/location-lookup.ts`
- `back-end/src/data/state-ballots/pennsylvania-2026.json`
- `back-end/src/data/state-ballots/west-virginia-2026.json`
- `back-end/test/state-ballot-public-portals.test.ts`
- `back-end/test/location-lookup.test.ts`
- `back-end/test/api.test.ts`
- `back-end/test/fixtures/state-portals-pennsylvania.html`
- `back-end/test/fixtures/state-portals-west-virginia.json`
- `back-end/scripts/copy-runtime-assets.mjs`
- `back-end/scripts/verify-runtime-build.mjs`
- `deploy/runtime-artifact-contract.json`
- `docs/data/2026-11-03-pa-wv-candidates.jsonl`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `README.md`
- This report.

The shared HTTP transport, its tests, all TLS/public-IP/redirect requirements,
dependency manifests/lockfiles, geocoder, front-end copy and saved application
configuration are unchanged by this batch. The earlier local UI/data changes are
preserved; they are not claimed as new work here.
