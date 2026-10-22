# Independently published county facts for NC and NM

## Scope and current delivery boundary

This local review preserves the prior 48-dataset national package, existing
primary adapters and all unrelated work. There is no commit, push, tag, release,
publication, deployment, host transfer, credential, permission or saved
configuration change.

Two independent official county publications now supply 85 reviewed records and
155 document claims. They are prepared as factual CSV/JSONL and candidate
snapshots outside Git. They are **not yet registered or displayed by the app**.
The current importer correctly refuses both unknown source IDs. Completing
source-aware selection/failover without replacing primary feeds remains required.

## Sources and access review

### Brunswick County, North Carolina

The county's own 2026 election page links House District 17 and House District 19
sample PDFs directly from its DocumentCenter. Its general and AI-agent robots
groups permit the selected election, copyright/privacy and document paths;
excluded FAQ, calendar, administrative and feed paths are not queried.
Ten-second spacing is honored, including ordinary same-host document redirects.

The copyright notice reserves page-design rights. The linked county privacy
notice identifies public-record information and discusses data extracted from
the website; it does not supply a blanket graphics republication license.
This package contains factual names, offices, labels and ballot texts, not
original artwork, seals, signatures or page design.

Both two-page originals explicitly identify Brunswick County and November 3,
2026. All four pages are visually reviewed. The PDF permissions permit copying
and printing; encryption, change or annotation permissions are not altered.

### Santa Fe County, New Mexico

The independently authored county sample-ballot page publishes generic styles and
a county master list without requiring voter identity. Its current robots permits
the selected pages and document paths. The master is fifteen pages; all five
candidate-bearing pages and both pages of supporting generic style 1 are visually
reviewed. Pages six through fifteen of the master contain noncandidate question
material and are not claimed as newly curated full question texts here.

The supporting sample has a broken text-font mapping. Its printed visual content,
not a guessed character shift, corroborates 35 candidate/retention occurrences.
The readable master supplies all 46 records, with six named retention choices
kept separate. Source party codes and office-label typos remain in the claims;
normal party names are corroborated by the printed sample.

The master uses countywide `ALL` markers and explicit style/precinct columns.
Those do not establish statewide or personal eligibility for local judges,
magistrates or county officers. Precinct-to-address matching is not implemented
or inferred.

### Boundaries preserved elsewhere

No new request is made to the excluded New Mexico state candidate host, denied
North Carolina distribution host, private voter tools or previously restricted
Louisiana news/document hosts. These county publications are independently
published ballot material, not a proxy/mirror used to retrieve a denied state CSV.

Los Alamos policy returns HTTP 403, so no sample page or document follows.
Doña Ana's policy contains AI-specific exclusions and reference-use conditions;
it is not treated as unrestricted collection permission, and no index/document
is requested. Torrance's public election page chiefly links the voter tool and a
proclamation, not a verified candidate roster; excluded asset paths are not used.

Livingston and St. Tammany clerk pages do not provide a new candidate roster
through the reviewed paths. Jefferson's linked terms restrict reuse without
consent; no candidate material is extracted or distributed. Previously reviewed
Louisiana robots explicitly disallows statewide/parish candidate-inquiry routes,
which remain unqueried. The maintained source guide now records that restriction
rather than leaving only an incomplete-contract note.

## Retained factual package

`back-end/data/state-ballots/independent-county-candidates-2026` names the
CSV/JSONL, source-claim file, manifest, seven-member archive and checksums.
Two separate snapshot inputs and a Brunswick question companion are included.

| Collection | Records | Source claims | Statewide | Congress | State Senate | State House | Local |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Brunswick | 39 | 74 | 12 | 3 | 3 | 4 | 17 |
| Santa Fe | 46 | 81 | 18 | 4 | 0 | 9 | 15 |

Both Brunswick samples have 37 printed records; their two distinct House slates
produce 39 deduplicated records. The Santa Fe master contributes 46 and the
supporting style contributes zero additional identities. The sample's 35 printed
occurrences remain corroborating claims, not duplicate candidates.

Governor/lieutenant-governor tickets stay intact. Blank write-in spaces are not
people; one-name offices do not imply unopposed status, certification or outcomes.
Six judicial retention questions remain named individual choices, not a
competitive race. Regional courts and local numerical labels are not Census
legislative districts. All new district/local matching is withheld.

Four fully reviewed Brunswick question texts have eight source occurrences.
The school-bond disclosure retains $349,600,000 principal, $196,167,552 interest,
$545,767,552 cumulative cost and $54.66 per year per $100,000 of property value
exactly as printed. No tax calculation or recommendation is substituted.
Source positions are not invented official amendment numbers. These texts are
companions, not registered application measures.

Original source capture times and ordered binary hashes are preserved. PDF
creation/modification metadata is not relabeled as publication or certification.
The package contains no source graphics, contact data, voter identity or campaign
prose. Previously retained 209 external files are not overwritten.

## Verification and remaining integration

The factual verifier confirms 85 records, 155 claims, CSV/JSONL/snapshot parity,
all 120 machine-readable candidate-name occurrences and 35 visually corroborated
sample occurrences. Coordinate-based logical ordering verifies the complete four
question texts against both originals. Native PDF drawing order initially
interleaved the school-bond paragraphs; that diagnostic is retained and corrected
in the verifier, not by changing the reviewed legal text to fit extraction order.

The compiled snapshot codec and owned external stores accept the source-bound
draft inputs. Statewide previews contain twelve and eighteen entries with every
district/local addition withheld, even when a synthetic numeric district matches.
These are controlled module checks, not claims that site pages display the new
data. Compiled management imports reject both unregistered IDs and preserve the
owned stored bytes. No publisher request occurs during factual validation.

Lint/typecheck, 740 unit checks (two optional PostgreSQL skips), 21 integrated
checks with both builds, 85 compiled modules and fifteen native entries pass.
All 209 earlier external files and the seven-member new archive remain exact;
145 unrelated path entries, five package files, heads, staging and four worktrees
are preserved. The protected artifact check still stops at the clean-source
guard; it is not a release-readiness pass. No dependency/package/lockfile or
application-code changes are needed for this collection step.

Local Gitleaks reports one reviewed false positive: the manifest's application
revision is the exact Git HEAD inserted by the generator, not a credential.
The redacted finding is retained without suppression; no scanner pass is claimed.
No confirmed secret is found or input uploaded. GitGuardian remains previously
unavailable, not passed. Owned scan/archive stages are removed. No application
listener or rendering review is needed because this step changes no interface
or rendered data; eleven actual source-document images were reviewed.

## Changed files and no-change findings

Only `docs/state-ballot-sources.md`, NC/NM remaining-work cells in
`docs/state-coverage-2026.csv` and this new audit change. Existing primary source
objects, README, code, routing, visible website copy and layout remain unchanged.

The current interface is intentionally not populated by relabeling these
independent records as a primary state's feed. Required source attribution,
scope, dates, meaningful errors and existing limited-coverage copy remain intact.
No extra onboarding, reassurance or interface commentary is added.

## Next required work

Support multiple named official sources per state, with source identity carried
through the repository, API, data controls and management/export commands.
Preserve every existing primary source object/fingerprint, retain explicit
selection, and test failover without merging or relabeling source records.
Register these two reviewed sources only after that contract is verified.
Do not route AI collection through the excluded primary hosts.

Official Louisiana candidate material, further profiles/local coverage, reliable
personal local mappings and application measures remain unfinished. Final
server-AI instructions are still conditional on broader collection/setup and are
not delivered by this factual package.
