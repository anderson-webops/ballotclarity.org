# Current server-AI instructions

Target: **v1.11.1**, November 3, 2026 election. This handoff is not proof of runtime
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

STATE_BALLOT_DATA_DIR must be absolute, writable by the existing application
identity, physically outside checkouts and immutable releases, and preserved
independently. Also preserve the existing database, ADMIN_DB_PATH,
LIVE_COVERAGE_FILE and metadata sidecar, and optional
BALLOTCLARITY_ZIP_LOOKUP_LOG_PATH. Credentials/logs never belong in artifacts.

Retain v1.11.0, its reviewed environment, manifest, transfer package and durable-
state backup before activation/import. Snapshot schema remains 1; no database
migration is introduced. All 51 preceding collection configurations and
fingerprints remain unchanged. During rollback, v1.11.0 ignores the six new
us-cdir AR/DE/ID/ND/VT/WY cache files and references-dc-local-biographies-2026.json.
Its 51 known collections remain compatible, including the nine expanded snapshots
whose old records are unchanged. For exact prior data, use the retained pre-import
backup and v1.11.0 manifest. Its older preparation command lacks the new reviewed
identity, heading and at-large cases; do not use it to overwrite expanded data.
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

Reference data: 58 collections across all 50 states plus DC, 284 profiles and 639
factual items. This update adds 22 Directory profiles/43 facts in fifteen states
and eight DC profiles/23 facts. All preceding 254 profiles remain unchanged.
Six new Directory collections cover AR/DE/ID/ND/VT/WY; nine preceding collections
gain thirteen further exact matches. DC adds independent council/AG biographies,
including three ward candidates. This is geographic reference coverage, not all
candidates, races, local areas or complete ballots. Louisiana has two attributed Senate
reports, not an accepted official qualification dataset. No directory, office
biography, news report or candidate submission establishes ballot qualification,
withdrawal, personal eligibility or a complete slate.

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
back-end/data/state-ballots/server-reviewed-election-data-2026-v1.11.1.tar.gz

It is 754,597 bytes with exactly 92 flat members: 33 reviewed official snapshots/
17,662 records, 58 reference snapshots/284 profiles/639 facts, and
server-reviewed-election-data-2026-v1.11.1-manifest.json.

Archive SHA-256:
3c9cb7a75005883ca098571cad0118b8dbe6b3c80535c3e7be4f1933e9b351f0

Manifest SHA-256:
6643cf51e4a9cac682fb6b99593ad9c35aa2c354b62fc7cd4d61e455931e374b

This supersedes the v1.11.0 transfer procedure, not seven preceding packages,
published tags or durable data. All 323 preceding canonical files remain byte-exact.
Nine expanded Directory snapshots have new versioned transfer filenames; use the
current manifest instead of importing both old and new files for one source ID.
Original configuration fingerprints and capture dates are preserved. Seventeen permitted automatic sources refresh
separately; their raw snapshots are not included in this archive.

The source agent has not uploaded/imported this package. An independently
authorized operator must arrange an approved transfer. No source-agent SSH/SCP,
public upload, GitHub data asset, guessed server path or permission change.
Bulk datasets stay outside Git and runtime releases. Without approved transfer,
report reviewed data unavailable rather than claiming code activation populated it.

Before extraction, verify both hashes and the exact member allowlist. Reject
traversal, links, extra members, wrong sizes/hashes or mismatched source/election/
configuration fingerprints. Use officialSnapshots only with the official importer
and referenceSnapshots only with the reference importer. Import all 91 snapshots
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
publications and other earlier exclusions remain excluded.

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
   by state/source against the verified manifest. Expected references total 284
   across 50 states plus DC. There are 58 source collections, not one per state.
3. Check AR 2, DE 2, ID 2, ND 1, VT 1, WY 1 and DC 8 profiles; CA now has 37,
   MI 8, VA 8 and NJ 5. Verify correct election
   offices/ticket slots, GPO source links, publication dates and capture times.
   Existing NC/NM totals become 9/3, AZ 6, NV 5, OR 17, ME 4; WA 24, AK 15 and UT 16
   remain unchanged. No missing biography implies withdrawal.
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
