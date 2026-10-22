# Current server-AI instructions

Target: **v1.10.3**, November 3, 2026 election. This is the current operating
handoff, not proof of deployment or data activation. Further collection continues.

## Release and authority

Use the existing protected server deployment system and independently granted
operator authority. Source publication does not authorize changing DNS, credentials,
permissions, service ownership, ports or Nginx/systemd policy. Preserve IPv4/IPv6.
Do not compile a replacement on the server or weaken a missing-capability gate.

Resolve the annotated tag from `main`. Verify the five protected workflow assets:
the exact Linux ARM64 runtime archive, `runtime-manifest.json`,
`acceptance-receipt.json`, `SHA256SUMS` and `attestation-bundle.jsonl`. Verify the
tag/commit/tree, checksums, GitHub attestation, receipt, complete unpacked inventory,
runtime/architecture and host contract under the existing trust policy. Rehearse
health/readiness, dependency failure, graceful shutdown and recovery from the exact
retained runtime. Promote only through the protected host adapter. Never replace
accepted assets, clear quarantine or silently fall back to source installation.

Independently verify served frontend build identity and affected API/pages after
activation. A healthy endpoint alone does not establish release identity or data
coverage. See [runtime-artifact.md](runtime-artifact.md). The build toolchain is
Node 24.18.1/npm 12.0.2; production runs compiled Node entrypoints without npm,
tsx or development dependencies.

## Durable state and rollback

`STATE_BALLOT_DATA_DIR` must be absolute, writable by the existing application
identity, and physically outside checkouts and immutable releases. Preserve it
independently across upgrades and rollback. Also preserve the existing database,
`ADMIN_DB_PATH`, `LIVE_COVERAGE_FILE` and metadata sidecar, and optional
`BALLOTCLARITY_ZIP_LOOKUP_LOG_PATH`. Never include credentials/logs in artifacts.

Retain the pre-activation runtime, reviewed environment and durable-state backup.
Check rollback compatibility before importing data or changing allowlists. Older
releases may not understand new IDs, state filters or `STATE_BALLOT_ENABLED_SOURCES`;
restore their compatible reviewed configuration rather than accidentally enabling
an excluded publisher. Do not delete older data to force startup or restore bulk
datasets inside the runtime tree.

## Coverage and data boundary

The retained collection has fifty official datasets, 25,568 records, across
49 states plus DC. Counts are records, not unique people or complete ballots.
The registry has nineteen automatic adapters and 33 reviewed sources. Two automatic
publishers remain excluded from AI collection. Brunswick NC's 39 records and
Santa Fe NM's 46 retain separate IDs, dates and documents, without replacing primary
feeds. New local/unverified legislative matching remains withheld.

Eight reference collections retain 80 entries and 213 factual items. North Carolina's
eight judicial submissions are candidate-provided; New Mexico's two Supreme Court
retention profiles use official court biographies. Neither source establishes
qualification or personal eligibility. Candidate statements are not independent
verification. Louisiana's two reported Senate
references are not official qualification; Louisiana still lacks an accepted
official candidate dataset. Question companions are not application measures.

Alaska adds fifteen individual candidate submissions for statewide/federal offices.
Ticket members are separate profiles, not extra official ballot choices. Oregon's
eastern-county edition adds fourteen submissions, including five county-office
profiles. Three of those local submissions have no independently matched retained
filing and remain references only. Neither collection changes official totals,
personal previews or precinct eligibility. Missing statements are not withdrawals.

Utah adds all sixteen congressional submissions and thirty short background/position
items from its public general-election pamphlet. Four other congressional candidates
remain in the official list without profile submissions. Two explicit middle-initial
name variants were reviewed against the same printed House districts. These are
candidate-provided claims, not state-verified biographies or personal ballot matches.

Bulk election data is outside Git and runtime releases. Code deployment alone
does not populate reviewed records or reference collections.

## Reviewed-data transfer prerequisite

Prepared source-computer package:
`back-end/data/state-ballots/server-reviewed-election-data-2026-v1.10.0.tar.gz`,
with its `-manifest.json` and `-SHA256SUMS` companions. This is **not a server path
obtained by cloning Git**, not one of the protected runtime assets, and not uploaded
by source publication. Request separately approved transfer through the existing
trusted operator channel if absent. Never substitute fixtures or denied scraping.

Expected archive SHA-256:
`8f31619604d8f034962bb5dd22dda917845804ae35785981b40c647d7d28e41c`.

Expected manifest SHA-256:
`3a5219266f8e36466d484e728b4f4e0a1b5bf9242a793ce44a64b4c9f633c1ab`.

Its 37 members are 33 reviewed official snapshots with 17,662 records, three
reference snapshots with 25 entries, and the manifest. Automatic official-source
snapshots are deliberately excluded: refresh those sources normally. Verify the
archive/manifest, require exactly the listed safe regular-file members, extract
to owned staging outside the release, and verify every input hash and configured
source fingerprint before import. Preserve original source dates/hashes. Imports
are atomic per file, not a transactional batch; retain the prior backup and check
each command before continuing.

The separately prepared `server-reviewed-judicial-addendum-2026-v1.10.1.tar.gz`
adds two reference snapshots, ten profiles and 22 facts. It has exactly three
members: the NC and NM snapshots and its `-manifest.json`. It requires the
v1.10.1 or later compatible runtime and separately approved operator transfer, just like the retained
v1.10.0 package. Do not replace the earlier package or import into an older runtime.

Addendum archive SHA-256:
`2008a225e0e6b92ead5921d84e10f5b2d8bac5703207b60c4f13925b244197ee`.

Addendum manifest SHA-256:
`e804e9db3e3f72512f6ec33ab59e0e3a91842602054c285af4353a943ab89009`.

Verify both hashes, the exact regular-file members and every source/input
fingerprint before using the existing reference importer on
`election-references-north-carolina-judicial-2026.json` and
`election-references-new-mexico-supreme-2026.json`. The factual CSV/JSONL companions
are not importer inputs. Earlier reference configuration fingerprints and data
remain unchanged, so missing addendum imports must not hide LA/ME/WA references.
Rollback to v1.10.0 ignores these new collection files; retain rather than relabel
them and restore the retained compatible environment. Profiles never enter personal
lookup previews or change official record totals.

The additional `server-reviewed-pamphlet-addendum-2026-v1.10.2.tar.gz` contains
exactly the AK and OR reference snapshots and its `-manifest.json`: 29 profiles
and 89 factual items. It requires v1.10.2 and a separate approved transfer/import.
Retain both earlier data packages unchanged. Its archive SHA-256 is
`3458a414e453f142d848a410a89a10a32c10af25db229c982ce81b97414b09d7`;
its manifest SHA-256 is
`b94a89262bcde7d03a93a980e8145333fc05c08eda8db610e29e4587a9cab134`.

After exact member/hash/source validation, import
`election-references-alaska-statewide-2026.json` and
`election-references-oregon-eastern-2026.json` through the reference command.
Do not import the companion CSV/JSONL through the official candidate command.
These are reviewed candidate-supplied summaries, not automatic PDF scraping or
independent qualifications. Earlier collection fingerprints remain unchanged.
Rollback to v1.10.1 ignores the two new collection files; retain rather than
relabel them and restore the compatible reviewed configuration.

The additional `server-reviewed-utah-addendum-2026-v1.10.3.tar.gz` contains exactly
`election-references-utah-congressional-2026.json` and
`server-reviewed-utah-addendum-2026-v1.10.3-manifest.json`: sixteen profiles and
thirty factual/position items. It requires v1.10.3 and a separate approved transfer
and reference import. Preserve all three preceding data packages unchanged.
Archive SHA-256:
`f4e70434e37ae9feac0c6b4f174103992e4ab6e91313cf00db0bcdff9f61e184`.
Manifest SHA-256:
`604c369398fe2ea0e972405c615a3fec316a8648be701a5fccbee8587ef576ef`.

Verify the exact two members, data/configuration fingerprints and capture time
before import. The companion CSV/JSONL and review manifest are not importer inputs.
No publisher PDF, photograph or contact data is in this archive or runtime release.
Rollback to v1.10.2 ignores the new collection while preserving earlier data; retain
its file and restore the compatible reviewed configuration rather than relabel it.

## Publisher policy and configuration

Review current publisher policies, permitted paths, election selection and reuse
conditions before retrieval. A working adapter is not permission. Honor delays,
redirects, TLS, exclusions and bounded failure handling. Do not change identity,
use mirrors/alternate hosts to evade a denial, query private voter tools or infer
nominees from primary totals/FEC filings.

The California voter-guide host's policy request returned 403 on October 22.
Do not collect that guide or use its CDN, a mirror or another identity to bypass
the denial. This does not change the separately reviewed official candidate list.
Utah's public pamphlet host permits collection with a ten-second delay; recheck
its current terms and candidate authorship before another capture. The profile
path needs no address-based or private voter tool and is not an automatic adapter.

Keep `nc-sbe-2026` excluded: its configured distribution-host policy request
returned 403. Keep `nm-sos-2026` excluded: the state candidate host explicitly
excludes OpenAI agents. Independent county publications were assessed on their
own authority, not used as proxies. Louisiana statewide/parish candidate-inquiry
paths and previously denied/reuse-restricted sources remain excluded. Review
[state-ballot-sources.md](state-ballot-sources.md) and source audits before changes.

Derive the current 50-source allowlist without a publisher request:

```bash
node --input-type=module -e 'const { configuredStateBallotSources } = await import("./back-end/dist/state-ballot-registry.js"); console.log(configuredStateBallotSources.filter(source => !["nc-sbe-2026", "nm-sos-2026"].includes(source.id)).map(source => source.id).join(","));'
```

Apply the result as `STATE_BALLOT_ENABLED_SOURCES` through the existing approved
configuration procedure before collection. If also setting
`STATE_BALLOT_ENABLED_STATES`, include every selected source's state.
`STATE_BALLOT_LOOKUP_ENABLED=false` alone does not restrict directory reads;
the source allowlist restricts publisher eligibility. Reference collections are
separate reviewed imports and are not governed by that official-source allowlist.

## Import and automatic collection

Run compiled commands from the accepted runtime with its protected environment.
Use the verified manifest's exact file lists, not an unreviewed directory glob.

```bash
node back-end/dist/manage-state-ballot-data.js import /approved/staging/reviewed-state.json
node back-end/dist/manage-election-references.js import /approved/staging/reviewed-references.json
node back-end/dist/manage-state-ballot-data.js refresh WA MT KS SC UT MS SD HI CO KY ND VA MI WY MD FL DE
```

Import all listed reviewed/reference files separately, checking exit status,
identity, count and original capture time. Reviewed data is reread immediately
and persists across restart without a bundled fallback. Automatic downloads store
validated facts, not raw contact-bearing responses. Freshness defaults to four
hours; failed fetches have bounded retry caching. Invalid/expired data is not
silently represented as current.

Use only the host's already approved scheduling system for the explicit permitted
refresh list while current policies still allow it. This release installs no
scheduler. More frequent invocation respects the freshness window rather than
inventing a new capture. Do not schedule unqualified all-source refreshes,
automatic OCR approval, repeated invalid imports or news/profile extraction.

## Acceptance after activation

1. Verify health/readiness and served release identity separately from data.
   `GET /api/state-records` must list only enabled choices without loading publishers.
   Reconcile every imported state's full paginated count, dates and source links.
2. Browse `/records?state=NC&source=nc-brunswick-samples-2026` and the equivalent NM
   source. Confirm 39/46 records, local scope, retention choices and source/state/
   filter isolation. Explicit missing sources stay unavailable. Default fallback
   must retain the actual returned source's attribution, not its primary's label.
3. Check `/api/election-references/LA`, `/ME`, `/WA`, `/NC`, `/NM`, `/AK`, `/OR`, `/UT`
   and the directory sections. Expected totals are 2, 3, 20, 8, 2, 15, 14 and 16,
   respectively. OR's local filter has five references, without adding official
   records or making them personal ballot choices. Retain distinct
   candidate-provided, news-report and official-biography labels, original capture
   dates and source links. Missing/corrupt profiles must not disable official data.
   Never turn references into qualification or personal lookup content.
   UT has sixteen congressional references and no local/statewide profile records;
   its retained official dataset stays at 255 records, including all twenty House
   candidates. Synthetic state-only UT previews remain seven retention entries.
4. Using synthetic state-only locations, check twelve NC/eighteen NM preview
   entries, no new unverified legislative/local assignment, and limited-coverage
   feedback. Never use a real person's address for acceptance.
5. Exercise keyboard controls, mobile layouts, dark/light themes, visible text
   selection, red election/deadline dates, meaningful errors and restart recovery.
   Do not request excluded publishers during checks.
6. Reconcile source fingerprints, counts and operator logs. Stop on mismatches.
   Report source publication, runtime activation and data activation separately.

## Future elections and remaining work

Do not relabel a 2026 snapshot or old capture as current. Existing sources stop
serving after their election window. New dates, URLs, formats, boundary vintages
and publisher policies need reviewed source changes/tests and a new accepted
runtime when the contract changes. Archive previous data/configuration, create
new source IDs when identity changes, and keep elections isolated. Adapters only
collect their explicitly configured election, not arbitrary future elections.

Continue independently permitted Louisiana/local official material, substantive
candidate-provided profiles and attributed reporting where official data is
unavailable. Retain URLs, original publication/capture dates, hashes, source
qualification and consequential limitations. Never guess party, outcomes,
unopposed status, precinct eligibility or future availability. Add personal local
matching only after authoritative boundaries/provider vintage are verified.
Question companions need full election/date, choice, geography and application
contract review before measure import.

Keep visitor text to actual content, necessary controls and consequential
accessibility/error/safety disclosures. Operating commentary belongs here, not
on the website.
