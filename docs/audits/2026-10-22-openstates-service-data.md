# Open States legislative-service data

The [published bulk-data page](https://open.pluralpolicy.com/data/legislator-csv/)
provides current-legislator CSV downloads for all 50 states and DC without an API
key. Its [terms](https://open.pluralpolicy.com/tos/) make no copyright claim over
published data; the [People repository](https://github.com/openstates/people)
also specifies CC0. This is third-party structured data, not an election-office
certification or an official biography.

## Reviewed October 22 captures

All 51 exact documented CSV URLs returned HTTP 200: 7,336 unique legislator
records within their state files, 6,088,219 bytes, and no populated biographies.
HTTP last-modified values range from October 20 to October 22. Download time is
not the date an individual role was verified. The publisher describes nightly
publication, not guaranteed same-day verification of every membership change.

The bucket's `robots.txt` returned HTTP 403. That resource was not retried or
accessed through another host. This does not establish that the explicitly
documented CSV endpoints are denied: each was requested once through its normal
public URL and succeeded without credentials, identity changes or challenges.
No denied CSV was retried, mirrored or proxied. The downloader stops on a data
endpoint denial. Future collection requires continued publisher permission and
normal access; these captures are not blanket permission for other sites.

## Exact joins

The preparation uses one retained candidate capture per explicitly selected
official source, preserving all older captures. Fifty reviewed candidate sources
contain 25,031 records. Three duplicate historical captures were excluded from
the join without removing them. The held Nebraska candidate source and the two
retired North Carolina/New Mexico sources are not selected.

An accepted join requires the same state, election, name, chamber and literal
district. Name handling permits case, whitespace, typographic apostrophe and
period formatting only. It does not remove initials or accents, guess nicknames,
reorder names, infer a new district, or score likely matches. Inactive, withdrawn,
defeated, disqualified and unsupported records are not used. Unicameral/DC roles
are not forced into a two-chamber match.

There are 1,495 exact candidate-record/person matches in 32 states:

| States | Profiles |
| --- | --- |
| AL · CA · CO · CT | 96 · 61 · 51 · 95 |
| DE · FL · GA · IA | 19 · 83 · 20 · 4 |
| IL · IN · KS · KY | 89 · 72 · 19 · 58 |
| MD · MO · MT · NC | 91 · 92 · 64 · 3 |
| ND · NV · NY · OH | 39 · 20 · 2 · 9 |
| OK · OR · RI · SC | 1 · 46 · 1 · 95 |
| SD · TN · TX · UT | 52 · 5 · 105 · 52 |
| VT · WA · WI · WV | 4 · 89 · 2 · 56 |

The 4,349 other eligible candidate records remain internal match-review entries,
not adverse findings or missing-biography notices. Many candidates are not
serving legislators. A match adds one attributed service fact, not a nomination,
party change, complete biography, full ballot, or personal eligibility claim.
There are no new profiles for the other 19 downloaded jurisdictions.

## Application integration

`openstates-bulk.ts` whitelists person ID, name, chamber, district and logical CSV
record number. Biography text, email, phone, addresses, birth dates, photos and
social accounts do not enter prepared exports. The 32 snapshots retain exact
capture URLs, SHA-256 fingerprints and timestamps. The CSV crosswalk additionally
binds every match to its retained official candidate ID, source fingerprint and
capture date.

The existing reference importer, repository, API and detail pages consume these
snapshots. A new `public-dataset` kind renders as “Public dataset”, never “Official
biography”. Lists retain their existing title/supporting-line structure; service
facts remain on details. Missing optional service collections do not create a
pointless retry warning; missing required collections still do. All 62 preceding
source declarations and their 540 profiles/1,138 facts remain separate.

The shared reference-caption helper omits a jurisdiction only when the office
title already ends with that complete label. For example, “State Senate District
6” no longer gains a second “District 6”. Distinct places and districts remain
visible, and the underlying source fields are unchanged.

The existing management CLI accepts `prepare-openstates PLAN.json` in source and
compiled modes. A version-1 `openstates-reference-preparation` plan names captured
downloads (`stateCode`, absolute `path`, exact `url`, `capturedAt`, `sha256`),
absolute `candidateFiles`, explicit `allowedCandidateSourceIds`, and an absolute
`outputDirectory` outside the application checkout/release. Preparation validates
the whole input set, refuses duplicate captures and existing output files, writes
reviewable snapshots/crosswalk/hold metadata, and performs zero network requests
or imports. Data belongs in external server storage, not code-release assets.

The publication configuration records a one-day minimum refresh interval and a
2 MiB per-state limit. This change does not install a scheduler or activate an
automatic collector. Future refreshes must retain the same provenance, reviewed
candidate-source selection and publisher-access checks. Election dates remain
explicit configuration; the current collections expire after the 2026 election
window rather than being relabelled for another election.

## Local verification

Lint, typecheck, 822 unit passes with two optional PostgreSQL skips, build,
21 integration tests and 15 native-binding checks pass. Real-data checks cover
all 51 API jurisdictions, all 50 retained candidate sources, all 94 populated
reference collections and all 2,035 profiles. There are 48 core accessibility
cases, 76 full-data mobile/desktop rendering and accessibility cases, and 12
additional cases for the final duplicate-caption correction. Source facts,
authorship, capture dates and state isolation remain intact, without runtime
publisher requests or browser errors. All 76 full-data views were rechecked
against the final build after the caption correction, respecting the normal
rate-limit window rather than changing it.

The local-only packet is 271,664 bytes with 36 regular members; raw CSVs and
operator instructions are excluded. All 425 preceding canonical files remain
byte-exact. Local source/expanded-packet scanning has no findings. A separate
raw evidence scan retains 14 checksum false positives, each verified against
its unchanged source file, not hidden through scanner configuration changes.
No commit, push, tag, release, private transfer or production activation is part
of this local milestone. Scheduled downloading remains future work.
