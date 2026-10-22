# Current server-AI instructions

Target: **v1.10.4**, November 3, 2026 election. This is the current operating
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

Ten reference collections retain 88 entries and 236 factual items. North Carolina's
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

Arizona adds five individual profiles from official biographies and candidate
statements, corresponding to four governor/lieutenant-governor ticket rows.
Profiles do not add official choices. Nevada adds two gubernatorial profiles and
one lieutenant-governor profile from official office biographies. These are not
complete executive slates. Keep source authorship separate for every record;
official office biographies do not establish ballot qualification or independently
verify all their claims. Stale office/term claims and uncertain dates are omitted.

Bulk election data is outside Git and runtime releases. Code deployment alone
does not populate reviewed records or reference collections.

## Reviewed-data transfer prerequisite

Use one cumulative source-computer package:
`back-end/data/state-ballots/server-reviewed-election-data-2026-v1.10.4.tar.gz`.
It is 716,788 bytes with exactly 44 flat members: 33 reviewed official snapshots
(17,662 records), ten reference snapshots (88 profiles/236 factual items), and
`server-reviewed-election-data-2026-v1.10.4-manifest.json`.

Archive SHA-256:
`fdee8ee4026b7bf2edd3eaaf388dfb8e1e6ef07f6cdf548140815275db29fc98`.
Manifest SHA-256:
`e000ab93cc6a7234fafc38e1b29c41a0ac39365cba7b9047e35c0e8744f7d132`.

This replaces the four-package transfer procedure, not the historical packages,
tags or data. Preserve those artifacts for recovery. Existing snapshots retain
their original bytes, configuration fingerprints, capture dates and authorship;
nothing is relabeled as freshly collected. The seventeen permitted automatic
sources are refreshed separately and are not bulk files inside this package.

The source agent has not uploaded or imported it. An independently authorized
operator must arrange an approved transfer. Do not use source-agent SSH/SCP,
public uploads, GitHub release assets, guessed remote paths or relaxed permissions.
Without approved transfer, report reviewed data unavailable rather than pretending
code activation populated it.

Before extraction, verify archive/manifest hashes and exactly the declared members.
Reject traversal, links, extra members or mismatched sizes/hashes. Verify each
snapshot's source/election/configuration fingerprint against the accepted runtime.
Use the manifest's `officialSnapshots` list only with the official importer and
`referenceSnapshots` only with the reference importer. No research CSV/JSONL,
publisher PDF, photograph, contact, campaign essay or credential is included.

Import all 43 listed files separately, retaining exit status, original timestamp
and count; re-importing unchanged snapshots uses the same atomic validation.
Existing data survives absent later imports. Do not delete unrelated durable
state or restore a bundled-data fallback. During rollback to v1.10.3, retain but
do not relabel the two new AZ/NV collection files; restore that runtime's compatible
reviewed configuration. The eight preceding reference configurations are unchanged.

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

Danielle Ford's campaign biography returned 403; do not retry it through other
routes, identities or mirrors. Arizona Clean Elections' linked document host
returned 400 for its policy request, so no document collection was accepted there.
The separately permitted independent biographies/statements are not substitutes
for those documents. Nevada's captured governor biography is linked from the
actual public www homepage; search-only int/prod hosts were never requested.

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
3. Check `/api/election-references/LA`, `/ME`, `/WA`, `/NC`, `/NM`, `/AK`, `/OR`, `/UT`, `/AZ`, `/NV`
   and the directory sections. Expected totals are 2, 3, 20, 8, 2, 15, 14, 16, 5 and 3,
   respectively. OR's local filter has five references, without adding official
   records or making them personal ballot choices. Retain distinct
   candidate-provided, news-report and official-biography labels, original capture
   dates and source links. Missing/corrupt profiles must not disable official data.
   Never turn references into qualification or personal lookup content.
   UT has sixteen congressional references and no local/statewide profile records;
   its retained official dataset stays at 255 records, including all twenty House
   candidates. Synthetic state-only UT previews remain seven retention entries.
   AZ's official snapshot stays at 207 records and NV's at 254. Risa Lombardo and
   Joe/Joseph Lombardo remain different people in different states. Angela Harrolle
   Mohan is the lieutenant-governor ticket member, not an extra governor choice.
   Her honorary commander role must not be presented as active military service.
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
