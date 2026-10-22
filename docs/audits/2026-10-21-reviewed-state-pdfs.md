# Reviewed general-election PDF datasets

## Added coverage

| Jurisdiction | Included records | Source documents | Statewide entries in a ZIP-only preview |
| --- | ---: | ---: | ---: |
| Missouri | 425 | 1 | 4 |
| Nebraska | 569 | 2 | 21 |
| District of Columbia | 436 | 3 | 33 |
| New Jersey | 39 | 3 | 4 |
| Alabama | 300 | 4 | 27 |
| Total | 1,769 | 13 | 89 |

These five dated datasets bring locally configured coverage to twenty states plus
DC: fifteen automatic sources and six reviewed snapshots. Thirty states still
lack an integrated dataset. Configured coverage is not a complete personal ballot,
complete local coverage, ballot-measure coverage or candidate-profile completion.

The canonical transfer document is
`docs/data/2026-11-03-reviewed-pdf-candidates.jsonl`. Its first line records source
identity, election date, retrieval policy, original document hashes/capture times,
included record counts and consequential scope notices. Remaining lines contain
factual candidate and contest fields only.

## Source interpretation and reconciliation

### Missouri

The [official certification](https://www.sos.mo.gov/CMSImages/ElectionCandidates/2026GeneralElectionCertifiedCandidates.pdf)
explicitly identifies the November 3 general election. Its 425 records comprise
three auditor nominees, 24 congressional nominees, 34 Senate nominees, 305 House
nominees, nine partisan circuit-judge nominees and fifty retention candidates.

The fifty retention candidates remain separate retention questions. Only the
Supreme Court retention is statewide; the five appellate-region, 28 circuit and
sixteen associate-circuit retention records remain local. Judicial circuit and
division numbers never become legislative or congressional eligibility.

### Nebraska

The [2026 election index](https://sos.nebraska.gov/elections) links the September 11
final general candidate list and August 3 judicial-retention filings. Positional
PDF extraction includes all 521 candidate rows, independently checked against the
521 incumbency cells, plus all 48 retention filings. Mailing, residence and contact
columns are not imported.

The unicameral Legislature uses state-senate geography, not state-house geography.
The two explicitly statewide workers' compensation retention questions are
statewide. The appellate, district, county and juvenile judicial districts remain
local, as do education, power, natural-resource and other specialized districts.
Every retention candidate has a separate question. A page footer is not part of
the final judge's question.

### District of Columbia

The [official election page](https://dcboe.org/elections/2026-elections) supplies
36 general-election names, 356 non-vacant ANC candidate rows and 44 registered
write-in candidates. Blank ANC vacancies and generic write-in spaces are not
invented candidates. ANC-SMD identifiers such as `6/8F01` are preserved.

Two published ANC withdrawal annotations are retained as inactive candidacies:
Aleria Elyse Butler in 2E01, October 5, and Julian Hunt in 6D06, October 13. Their
annotation dates are source status, not part of their names. Contact-person/slate
columns are not mistaken for additional candidates.

Federal delegates and the District's shadow senator/representative offices remain
distinct. The latter are labeled as the D.C. shadow delegation, not represented
as seats in the voting U.S. Senate or House. The essential citizenship limitation
is preserved, consistent with the Board's
[non-citizen voting guidance](https://dcboe.org/voters/register-to-vote/non-citizen)
and separately published citizen/non-citizen sample ballots. Ward and ANC
eligibility is not inferred from state legislative district numbers or ZIP alone.

### New Jersey

The [official general-election page](https://www.nj.gov/state/elections/election-information-2026.shtml)
links Senate and House lists with published totals of four and 35 candidates.
The September 4 District 7 amendment contains three nominees and replaces that
district's prior entries, rather than duplicating them. County slogan repetitions,
summary pages and the blank amendment cover are not candidates.

Every included list identifies November 3. The separate District 11 special
election and primary lists are excluded. This dataset is expressly federal only;
it does not establish state or local coverage.

### Alabama

The [official general-election section](https://www.sos.alabama.gov/alabama-votes/voter/election-information/2026)
provides state certifications and subsequent party amendments. The reviewed set
contains 114 Democratic, 180 Republican and six independent candidacies.

The Democratic state certification incorporates the August 24 amendment. Only
its current five candidate-table pages are used, not the superseded July 1
attachment. Those five pages contain 24, 26, 26, 24 and fourteen records. Their
orientation and every candidate/office/district/place were visually reviewed;
uncorrected OCR is not accepted as authoritative. Examples corrected against the
page images include Senate 11, House 101, Macon County Place 1 and Madison County
Place 1. Statewide, legislative, court-place and education districts remain
separate.

The August 28 digitally extractable Republican list contributes 175 current regular
nominees, including the corrected House District 51 candidate. The September 2
amendment explicitly adds the four special-primary congressional nominees and
Senate District 25 nominee. Its current full nominee table independently contains
180 rows. Party executive-committee winners and superseded attachments are
excluded, even though the collated PDF also includes them.

The independent certification supplies two Senate and four House candidates.
Common office labels reconcile equivalent Democratic, Republican and independent
contests without combining separate places. Alabama's
[judicial qualification guidance](https://judicial.alabama.gov/Appellate/JudgeQualification)
identifies its appellate judges as statewide; the
[PSC's published description](https://psc.alabama.gov/wp-content/uploads/2021/12/APSC-BROCHURE.pdf)
identifies its commissioners as elected statewide.

The September 2 Secretary of State cover expressly distinguishes acceptance of a
late amendment from ballot reprinting. Accordingly, the preview and transfer
retain a printed-ballot limitation. Certification is not relabeled as proof that
every printed ballot contains the amended nominee.

## Loading, evidence and privacy

These are reviewed snapshots, not automatic PDF crawlers. No new PDF dependency,
OCR service, production PDF executable, provider credential or account is required.
Automatic transport refuses every manual-snapshot source before a request, and a
failed local load never falls back to downloading the PDF.

Each snapshot keeps the oldest included document's actual capture time. Reloads,
cache expiry, diagnostics and re-export do not replace it with the current time.
The source-set SHA-256 covers the ordered `{url, sha256}` document descriptors;
each original PDF fingerprint remains separately available. Strict loading checks
configured URLs, the document-set digest, counts, dates, record layout and unique
identities, rejecting unexpected contact fields.

All five JSON assets are independently required by the runtime contract and build
verifier and are explicitly copied into compiled output. The transfer exactly
matches their accepted factual records. Residential addresses, phones, emails,
contact people and expressive candidate essays are not included.

Applicable Missouri, Nebraska, New Jersey and Alabama robots exclusions do not
cover the retrieved election documents; DC robots returned 404. No authentication,
CAPTCHA, challenge, TLS or access-control bypass was used. The 34.8 MB Alabama
amendment was retrieved only for local review with an explicit bounded PDF limit;
the automatic importer's existing size limit is unchanged.

The only additional visitor-facing copy is the consequential dated-snapshot,
federal-only, citizenship or printed-ballot limitation. No onboarding, prototype,
progress, implementation or reassurance text is added to the interface.

## Local verification

- Formatting, lint and front-end/back-end type checking pass.
- All 501 unit tests pass; two optional PostgreSQL checks are skipped. Seven new
  tests cover snapshot provenance, cache dates, offline loading, source totals,
  amendment reconciliation, withdrawals, specialized geography and transfer parity.
- The integrated build/runtime suite passes all 21 browser tests. Both builds
  complete, verifying 72 compiled back-end modules and the required JSON assets.
- All 48 general route/theme accessibility checks pass, plus five actual-snapshot
  page checks. No accessibility violations, browser errors or horizontal overflow
  occur in the five real-data reviews at 320, 390 and 1280 pixels.
- API lookup, active-cookie restoration, original capture dates, essential scope
  notices and every eligible candidate are checked on each built page. Screenshots
  of all five jurisdictions are visually reviewed.
- All fifteen native-binding checks pass. Independently removing each of the five
  compiled snapshot assets makes the runtime verifier fail; each exact asset is
  restored and the complete verifier passes afterward.
- Compiled offline diagnostics return all five datasets. Re-export exactly matches
  the canonical 1,769-record transfer, including all thirteen document fingerprints.
- Gitleaks scans all nineteen changed source/data/document files and reports no
  secrets. No external GitGuardian source upload is attempted or authorized.
- Dependency manifests and both lockfiles are unchanged. Existing validated
  installations are reused; no dependency upgrade or clean-install claim is made
  for this source-only local batch.

The first unprivileged full-unit attempt could not open a loopback test fixture.
The subsequent approved local test run passes without changing saved permissions,
application configuration, source transport limits or safety gates. The unrelated
physical-checkout files and other worktrees remain unchanged.

## Delivery boundary

These additions remain local. No commit, push, tag, release publication, deployment
or production administration is performed for this batch. An earlier release
publication request remains pending explicit authorization. Local acceptance is
not CI/release acceptance or proof of production activation.
