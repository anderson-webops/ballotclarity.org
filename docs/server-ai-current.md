# Current server-AI instructions

Code target: **v1.12.1**. Reviewed data package: **v1.12.0**, November 3, 2026 election. This handoff is not proof of runtime
or data activation. Nationwide/local collection remains unfinished.

## Authority and release acceptance

Use the existing protected server deployment system and independently granted
operator authority. Source publication does not authorize changing DNS, credentials,
permissions, ownership, ports, Nginx/systemd policy or production data. Preserve
IPv4/IPv6. Report missing access/capabilities rather than changing them. Do not
compile a replacement on the server, clear quarantine or relax acceptance gates.

Resolve the annotated tag from main. Verify the five immutable workflow assets:
the Linux ARM64 runtime archive, runtime-manifest.json, acceptance-receipt.json,
SHA256SUMS and attestation-bundle.jsonl. Verify exact tag/commit/tree, checksums,
GitHub provenance, receipt, complete unpacked inventory, runtime/architecture and
host contract under the existing trust policy. The two biography preparation
modules are independently required runtime files, not optional source helpers.
Rehearse readiness, dependency failure, graceful shutdown and recovery from the
retained artifact; promote only through the protected host adapter.

Independently verify served frontend identity, health/readiness and affected
API/pages. A healthy endpoint or configured collection ID alone proves neither
release identity nor imported data. See [runtime-artifact.md](runtime-artifact.md).
Build toolchain: Node 24.18.1/npm 12.0.2; production uses compiled Node entrypoints,
not npm, tsx, development dependencies or a server-side source installation.

## Durable state and rollback

The UI-only v1.12.1 update preserves every v1.12.0 collection configuration and
snapshot. Retain v1.12.0 as the immediate code rollback. Do not regenerate or
relabel the unchanged v1.12.0 data package for this UI release. The older
v1.11.2 data/parser compatibility boundary below remains relevant for deeper rollback.

STATE_BALLOT_DATA_DIR must be absolute, writable by the existing application
identity, physically outside checkouts and immutable releases, and preserved
independently. Also preserve the existing database, ADMIN_DB_PATH,
LIVE_COVERAGE_FILE and metadata sidecar, and optional
BALLOTCLARITY_ZIP_LOOKUP_LOG_PATH. Credentials/logs never belong in artifacts.

Retain v1.11.2, its reviewed environment, manifest, transfer package and durable-
state backup before activation/import. Snapshot schema remains 1; no database
migration is introduced. All 59 preceding collection configurations, fingerprints
and snapshots remain unchanged. During rollback, v1.11.2 ignores
references-la-webster-additional-references-2026.json and retains its 59 compatible
collections. Its parser still requires factual items; do not pass it the new
manifest or relabel the new snapshot under an older ID.
For exact prior data, use the retained pre-import backup and v1.11.2 manifest.
Never rename sources, relabel snapshots, delete older data or
restore a bundled-data fallback to force compatibility. Older official allowlist
semantics also require their compatible reviewed environment.

## Coverage and source meaning

Retained official data: fifty datasets, 25,568 records, 49 states plus DC. These
are records, not unique people, complete ballots or personally eligible choices.
The registry has nineteen automatic adapters and 33 reviewed sources. Two
automatic publishers remain excluded; seventeen are currently permitted.
Brunswick NC's 39 records and Santa Fe NM's 46 retain separate IDs/documents and
do not replace primary feeds. Unverified local/legislative matching stays withheld.

Reference data: 60 collections across all 50 states plus DC, 307 profiles and 670
factual items. This update adds fourteen local Louisiana references and ten
background/position summaries. Seven new references contain names, offices and
attribution only, without invented background or repeated candidacy sentences.
All preceding 293 profiles and 59 configurations remain unchanged. Louisiana has
25 references: two Senate reports, nineteen local candidate submissions and four
local forum-report identities, not an accepted official qualification dataset. This is geographic reference coverage, not all candidates,
races, local areas or complete ballots. No directory, office
biography, news report or candidate submission establishes ballot qualification,
withdrawal, personal eligibility or a complete slate.

Local references cover eleven school-board profiles in Districts 3/5/7/9/10/11,
six Minden District C/D council profiles, three Minden police-chief profiles,
one Springhill mayoral profile and two Springhill District 2/3 council profiles. Preserve
candidate-statement authorship even when a submission uses third person or a
newspaper editor's byline. Only education, professional history, military service,
public service and volunteering are included. Studies/credit hours are not degrees;
employment and service assertions belong to their dated statement, not a claim of
current employment or independently verified licensure. Several scheduled posts
have modification dates before publication; preserve the actual publication date.
No campaign appeals, family/religion, personal contacts, ballot numbers or images
are imported. Specific stated priorities remain attributed positions, not enacted
policy. Generic promises and duplicate candidacy sentences are omitted.

Only la-webster-additional-references-2026 opts into allowIdentityOnly:true in the
trusted source registry. It permits facts:[] while preserving required name,
office, scope, source and capture provenance. All 59 preceding collections still
require one to six nonblank factual items. Missing/null facts, empty strings,
unknown fields and invalid names/offices remain errors. Neither a request query
nor an imported payload may enable this option. Configuration fingerprints bind
it to the reviewed new ID; never enable it globally to make invalid data pass.
The public facts field remains an array. Empty arrays render no fact list or
placeholder explanation, but retain the real identity, office and attribution.

The October 15 forum report supplies names/offices, not a question transcript or
complete slate. Do not invent answers or infer withdrawal from nonattendance.
The later District A report concerns a 2027 special election and contains a
conflicting oath year/name spelling; it is not a 2026 candidate/calendar input.
Broussard's announcement body lacks a given name; its image filename is not
identity proof. That profile remains held. Janice's original earlier capture is
reused without relabeling it as a fresh download.

The GPO/Joint Committee on Printing Directory is issued 2026-02-20 but states a
printed compilation cutoff of 2025-10-01. It supplies historical background, not
current membership or 2026 nominees. Exact normalized full-name/state matching is
the default. Six separately reviewed mappings bind the exact source, candidate
name, election office and edition to captured official identity pages; there is
no general nickname, title-stripping or fuzzy-name rule. Mixed-case surnames and
the printed city/state semicolon are recognized. Ticket members retain explicit
governor/lieutenant-governor slots. Existing non-directory profiles and inactive
candidates remain excluded. Three reviewed DE/ND/VT at-large House cases affect
reference display only; original official scopes and personal lookup are unchanged.

The source contains discrepancies. Fifteen edition-scoped field/clause/date holds
cover twelve people. The six preceding holds remain; nine new holds withhold
Womack/Coons/McBride service ranges, Risch's complex Senate clause, Fedorchak's
governor-name and ambiguous commissioner-year clauses, Balint's education, and
DeSaulnier's agency-name clause/Senate date range. The original PDF confirmed
earlier examples; new source-text differences are not assumed to be PDF errors.
Uncertain dates/degrees are omitted, not silently corrected from another source.
Current/open-ended role clauses and broken fields are withheld. Source authorship,
publication/capture dates and reviewed limitations must survive reprocessing.
Official biographies are not independent verification of every assertion.

Keep existing source distinctions and limits: NC judicial statements are candidate-
provided; NM court profiles are official biographies. AK ticket members are
separate profiles, not extra choices. OR retains five county profiles, including
three without independently matched filings. UT's sixteen congressional submissions
do not imply other candidates withdrew. AZ's five executive profiles correspond to
four ticket rows; honorary commander is not active military service. Joe/Joseph
Lombardo in NV is not Risa Lombardo in AZ. WA retains 887 official records and 24
profiles: twenty congressional and four LD1 House profiles, not a complete state
legislative slate. Question companions are not imported application measures.

## Reviewed-data transfer

Use the cumulative source-computer package:
back-end/data/state-ballots/server-reviewed-election-data-2026-v1.12.0.tar.gz

It is 759,088 bytes with exactly 94 flat members: 33 reviewed official snapshots/
17,662 records, 60 reference snapshots/307 profiles/670 facts, and
server-reviewed-election-data-2026-v1.12.0-manifest.json.

Archive SHA-256:
e211e56d8ac04465c234e26aaa1e6f5ca051df386fe0184c8f9d3d78dc38f90e

Manifest SHA-256:
bd97ee1e5abaa61a54218fad8ba77d098758ba08a0b6aa9b2e52da15fa6b1b85

This supersedes the v1.11.2 transfer procedure, not nine preceding packages,
published tags or durable data. All 354 preceding canonical files remain byte-exact.
Use the current manifest's single full snapshot per source ID. Original
configuration fingerprints and capture dates are preserved. Seventeen permitted
automatic sources refresh separately; their raw snapshots are not in this archive.

The source agent has not uploaded/imported this package. An independently
authorized operator must arrange an approved transfer. No source-agent SSH/SCP,
public upload, GitHub data asset, guessed server path or permission change.
Bulk datasets stay outside Git and runtime releases. Without approved transfer,
report reviewed data unavailable rather than claiming code activation populated it.

Verify compact `/records` rows link to exact `/record/:state/:id` details. Open
an official record, a sourced factual profile and a sparse identity-only profile;
confirm statuses, facts, source attribution and capture dates remain available on
the detail pages. Similar names and references from a different collection must
not substitute for the requested identity. Verify the header Change control and
legacy `#change-location` links reach the focused home lookup form. Calendar dates
remain neutral; only the nearest relative timeline label is red. Past dates remain
available in their secondary disclosure. No data import is needed for this UI change.

Before extraction, verify both hashes and the exact member allowlist. Reject
traversal, links, extra members, wrong sizes/hashes or mismatched source/election/
configuration fingerprints. Use officialSnapshots only with the official importer
and referenceSnapshots only with the reference importer. Import all 93 snapshots
separately, retaining source ID, status, count and original capture time.
Research CSV/JSONL, publisher text/PDF, images, contacts and credentials are not
importer inputs and are not members of this package.

## Publisher eligibility and automatic official downloads

Review current exact-host policy, permitted paths, election selection and reuse
before retrieval. A functioning adapter is not permission. Preserve TLS, delays,
redirect handling, bounded responses/retries and exclusions. Never change identity,
use mirrors to evade denial, query private voter tools or derive nominees from
primary totals/FEC filings.

Keep nc-sbe-2026 excluded: its distribution-host policy returned 403. Keep
nm-sos-2026 excluded: the state candidate host explicitly excludes OpenAI agents.
Independent county sources were assessed on their own authority, not as proxies.
Louisiana candidate-inquiry paths, denied exports, King County reuse-restricted
publications and other earlier exclusions remain excluded. The October 22 review
also found www.sos.la.gov wildcard Disallow:/; named search-engine exceptions do
not authorize this agent. www.jeffparish.gov policy returned 403. Calcasieu's own
candidate documents redirected to 0fed7ada-ffd6-448a-9d77-f7f552b92923.filesusr.com,
whose policy returned 403; neither destination document was requested. Do not use
alternate Wix hosts, mirrors, screenshots or cached copies to bypass these limits.
Caddo's selected publisher was robots-blocked in discovery. West Carroll returned
HTML instead of a usable policy, so no election content was accepted there.

The independently permitted Lafayette, Jefferson Clerk, St. Tammany, Iberia and
West Baton Rouge pages supplied calendars/office information, not named slates.
Honor Jefferson Clerk/St. Tammany's ten-second spacing. Calcasieu's public HTML
lists offices and partial question headings, not candidate names/full measures;
its candidate-page date label is inconsistent. West Baton Rouge mixes old
elections and a 2006 typo with 2026 dates. Do not infer names, stages, deadlines,
qualification or complete measures from these pages. See the Louisiana audit.

Webster Parish Journal's public article policy allowed the reviewed original
statements, independently of excluded government lists. This release adds no
automatic news collector or scheduler. Renew exact-host/path policy and authorship
review before fetching changed statements; stage them for human review. Check
later withdrawal/disqualification reporting without using a search miss as proof
of qualification. Future elections need new reviewed IDs, dates and imports;
never change a 2026 collection to another election or auto-approve raw prose.
The independently mentioned www.greatermindenchamber.com publisher explicitly
excludes GPTBot and numerous AI agents. Its non-www policy redirected to www;
only those policy requests were made. Do not use the wildcard allowance, another
identity, member portal, cached page or mirror to obtain its candidate directory.
Original newspaper submissions and independent forum coverage are not copies of
that excluded directory.

The CA voter-guide host returned 403 on October 22; do not request that guide,
its CDN or a mirror. The independent national congressional publication is not a
copy or proxy for that guide. Utah's public pamphlet host requires ten-second
spacing and renewed authorship/reuse review. Danielle Ford's campaign biography 403
and Arizona Clean Elections' document-host policy 400 were not bypassed. Nevada's
accepted biography follows the actual public www homepage, not guessed int/prod
hosts. VoteWA uses its observed election 899 normal-mode public contract, without
preview flags, voter identity or restricted exports.

Derive the current 50-source allowlist without publisher requests:

```bash
node --input-type=module -e 'const { configuredStateBallotSources } = await import("./back-end/dist/state-ballot-registry.js"); console.log(configuredStateBallotSources.filter(source => !["nc-sbe-2026", "nm-sos-2026"].includes(source.id)).map(source => source.id).join(","));'
```

Apply STATE_BALLOT_ENABLED_SOURCES through the existing approved configuration
procedure before collection. If setting STATE_BALLOT_ENABLED_STATES, include
every selected source's state. STATE_BALLOT_LOOKUP_ENABLED is the existing
repository kill switch; false alone is not a substitute for a source allowlist.
Enable data access only through independently approved environment management.
Reference collections are separate reviewed imports, not governed by the official
source allowlist. Their configured metadata is not data-availability evidence.

Run compiled commands with the accepted runtime/protected environment:

```bash
node back-end/dist/manage-state-ballot-data.js import /approved/staging/reviewed-state.json
node back-end/dist/manage-election-references.js import /approved/staging/reviewed-references.json
node back-end/dist/manage-election-references.js export WA --source wa-congressional-statements-2026
node back-end/dist/manage-election-references.js export CA --source us-cdir-ca-2026
node back-end/dist/manage-election-references.js export DC --source dc-local-biographies-2026
node back-end/dist/manage-election-references.js export LA --source la-webster-statements-2026
node back-end/dist/manage-election-references.js export LA --source la-webster-additional-references-2026
node back-end/dist/manage-state-ballot-data.js refresh WA MT KS SC UT MS SD HI CO KY ND VA MI WY MD FL DE
```

Use exact verified manifest lists, never an unreviewed directory glob. Use
--source for every reference export; more states now have multiple collections,
and ambiguous exports fail explicitly. Imports remain atomic and are reread on
the next request without restart. Official freshness defaults to four hours;
failed fetches use bounded retry caching. Never relabel a stored capture as a new
download or present invalid/expired data as current.

Use only the host's already approved scheduler and explicit permitted refresh
list while policies remain valid. This release installs no scheduler. Do not
schedule all-source refreshes, automatic OCR approval, repeated invalid imports
or unreviewed news/campaign extraction.

## Reusable biography preparation

The new command stages reviewed-format data without network requests or imports:

```bash
node back-end/dist/manage-election-references.js prepare-congressional /approved/staging/plan.json
```

The plan has exactly these fields:

```json
{
  "schemaVersion": 1,
  "type": "congressional-biography-preparation",
  "sourceText": {
    "path": "/approved/source-captures/directory.txt",
    "url": "https://www.govinfo.gov/content/pkg/CDIR-2026-02-20/text/CDIR-2026-02-20.txt",
    "capturedAt": "<actual successful capture time>",
    "sha256": "<actual downloaded-text SHA-256>"
  },
  "candidateFiles": ["/approved/staging/official-snapshot.json"],
  "referenceFiles": ["/approved/staging/preceding-reference-snapshot.json"],
  "outputDirectory": "/approved/staging/new-preparation"
}
```

Construct paths/lists/metadata programmatically from verified inputs. Placeholders
are not valid inputs. Candidate files must be current configured 2026 official
snapshots, not raw publisher files; excluded NC/NM source IDs are rejected.
Provide all preceding non-directory reference collections for the selected states
so existing people are not duplicated. Prior us-cdir collections may be supplied
but do not suppress their own re-preparation.

Under independently approved host collection authority, review GovInfo's current
policy and download the explicitly configured public text into external storage.
Record actual URL, 200 status, capture time, byte count and SHA-256 under normal
verified HTTPS; do not copy this workstation's capture time onto a server download.
No credential is needed. The command verifies the hash, edition/compilation
notice, configured candidate provenance, dates, identities, active statuses and
external output. Files are created exclusively; use a fresh staging directory.
A failure does not import anything or authorize replacing existing outputs.

Inspect the preparation manifest and every affected count/source/field delta
before imports. Current Directory preparation produces 46 collections/184 profiles/
368 facts. DC's eight profiles/23 facts are a separately reviewed import, not
output from this parser. Keep all fifteen quality holds and no-current-role rules.
The six identity mappings require renewed review for any new source/name/office
or edition; do not generalize them. Stop on unexpected missing
states, count drops, unmatched candidates, changed fields or source drift; retain
healthy durable data and stage evidence rather than automatically publishing a
partial or empty replacement. Then separately validate/import exact approved files.
An approved host job can download/stage known-edition updates without adding data
to Git; automatic staging does not grant automatic publication authority.

Publication date, congress, edition years, printed cutoff/notice and election date
are centralized in congressional-biographies.ts; filenames/IDs derive the election
year. New editions/elections still require reviewed source configuration, renewed
publisher permission, format/identity tests and an accepted runtime. Never point
a 2026 source ID at 2028, guess new endpoints or treat prior membership as nomination.
Archive prior configurations/runtime/data and reassess edition-specific holds.

## Runtime and data acceptance

Reference reads combine the earliest unexpired election in registry order before
global q/scope/limit/offset filters; states/elections never merge. Two-day UTC
post-election expiry is unchanged. API collections lists configured IDs; returned
records retain source.collectionId, original opaque ID and attribution. Clients
use compound collection/record identity. Missing/corrupt files retain healthy
collections with incomplete:true and local Retry. All missing is unavailable;
failures without healthy data return 503. Recovery needs no restart and must not
steal focus after the reader moves elsewhere. Official/personal lookup stays
independent.

1. Verify source tag/assets and served release identity separately from data.
   Check health/readiness and the affected directory pages.
2. Reconcile all imported official snapshots and full paginated reference totals
   by state/source against the verified manifest. Expected references total 307
   across 50 states plus DC. There are 60 source collections, not one per state.
3. Check AR 2, DE 2, ID 2, ND 1, VT 1, WY 1 and DC 8 profiles; CA now has 37,
   MI 8, VA 8 and NJ 5. Verify correct election
   offices/ticket slots, GPO source links, publication dates and capture times.
   Existing NC/NM totals become 9/3, AZ 6, NV 5, OR 17, ME 4; WA 24, AK 15 and UT 16
   remain unchanged. No missing biography implies withdrawal.
   Louisiana has 25 total references, 23 under scope=local and two under
   scope=statewide; local records retain Webster Parish/Minden/Springhill geography.
   Seven new identities have facts:[]: Hanson, Lindsey-Keener, Franklin, Raborn,
   Roy, McIver and Morris. Check candidate versus news attribution, source dates,
   no empty fact lists/placeholders, mixed-detail search/paging and keyboard links.
   Withholding the new collection leaves eleven healthy preceding references;
   withholding the older local collection leaves sixteen. Restore without restart.
   Its official-record API remains unavailable. Querying Webster backgrounds must
   not create official candidate rows, local assignment or personal ballot choices.
4. Confirm all fifteen held fields/clauses/ranges do not appear. DC keeps distinct
   council/AG attribution and actual capture dates, without invented publication
   dates or current-term claims. Ward 3/5/6 profiles filter as local; Robert White's
   reference concerns the federal delegate race, not his source biography's council
   role. All fields remain attributed background, never qualification.
   Test query/scope/global pagination and cross-state/name separation.
5. Preserve NC 39/NM 46/AK 155/OR 279/UT 255/AZ 207/NV 254/WA 887 official records and
   synthetic state-only preview counts 12/18/18/7/7/23/18/10, plus DC 33 from its
   unchanged 436-record official list. New profiles must
   never enter personal lookup or create unverified local/legislative assignment.
6. In an isolated acceptance environment, withhold/corrupt/restore individual
   collections, check healthy partial results/Retry, restart recovery, keyboard
   focus, mobile/themes, visible text selection and red election/deadline dates.
   Never corrupt production files or contact excluded publishers for tests.
7. Reconcile source fingerprints, operator logs and original capture dates; stop
   on mismatch. Report source publication, runtime activation and data activation
   separately. Local historical fixture clocks are not evidence of live freshness.

Further work includes permitted Louisiana/local official publications, remaining
candidate backgrounds, challengers and attributed reporting. Having at least one
reference in every state/DC does not complete these election/local coverage goals.
Reliable personal local matching requires authoritative boundaries/provider
vintage. Question companions require election/date/choice/geography/application
review before measure import. Keep website text to substantive data, necessary
controls and essential factual/accessibility/error/safety disclosures; operating
commentary belongs here, not in the interface.
