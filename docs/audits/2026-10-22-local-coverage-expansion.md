# Local candidate transfer and additional Louisiana review

## Reviewed Washington transfer

The local-only `back-end/data/state-ballots/washington-stevens-candidate-backgrounds-2026.csv`
and matching JSONL contain thirteen factual paraphrases for five Stevens County
candidates in the November 3, 2026 election: Lori Larsen, Eric Simpson, Michelle
Enright, Mark Burrows and Jack Griffin Jr. They preserve exact official record and
race/candidate IDs, candidate authorship, source links, capture times and document
and statement hashes. These are submitted background claims, not independently
verified employment, credentials, qualification or personal ballot assignments.

The captured public statement responses explicitly print `CountyDisplay=Stevens`.
No county was inferred from names, mailing addresses, ZIPs or generic roster
labels. All seven retained identities match the freshly parsed 887-record official
roster and preceding snapshot exactly, after ordinary JSON omission of undefined
optional properties. Rick Johnson's factual sections all say no information was
submitted. Gene Healy's Wahkiakum PUD response has no nonempty statement. Neither
receives an invented background profile.

The original six-million-byte failure for race 186884 was not retried and its
bound was not increased. This review made no new Washington publisher requests.

| File | SHA-256 |
| --- | --- |
| `washington-stevens-candidate-backgrounds-2026.csv` | `303fc2b0de8a5634c37654a9e8ec21608380c7969eb4fe2842dd7c0111ba93fd` |
| `washington-stevens-candidate-backgrounds-2026.jsonl` | `d2073488f07457f762bc210eae1ad1ca76deeb9a4bfc2182163a8931b2c0f28e` |
| `washington-stevens-candidate-backgrounds-2026-manifest.json` | `788cb30daf7b736b3a804c176447c6c43caa488ef6fb0a55683df5d6d63942e2` |

The companion checksum file covers all three. CSV parsing round-trips every fact
and provenance field; formula-leading cells are escaped. Every paraphrase is
bound to a reviewed factual-section substring and captured statement hash. Raw
publisher prose, campaign appeals, photos, contacts, family/religion, evidence
anchors and copied HTML are excluded from the transfer.

## Integration boundary

This is a reviewed research transfer, not an imported reference collection. The
runtime remains at 61 configured collections, 534 profiles and 1,120 facts. The
unchanged v1.13.0 operator archive does not contain this companion. All 370
preceding canonical files remain byte-exact; four new companion files are outside
Git. Preserve or transfer them before archiving this worktree.

The existing Washington preparer correctly rejects the generic official
`County` label versus the response's `Countywide` jurisdiction. The negative
check exercised that exact identity error for every reviewed local candidate,
not an unrelated parse failure. Do not strip geography, substitute names, relax
the check or import the CSV with the current reference importer.

A maintained local adapter must bind the explicit response county and
jurisdiction type to exact official race/candidate identities, preserve original
official IDs and ambiguous printed labels, and test cross-county namesakes and
missing/conflicting county fields. Review district boundaries separately before
personal ballot assignment. County-wide source coverage alone does not establish
commissioner-district eligibility.

## Independently reviewed Louisiana publishers

Normal public requests used verified TLS, a stable descriptive agent, manual
redirect handling, bounded bodies and no voter identity. Sandbox DNS failures
were distinguished from publisher denials; approved normal network reads then
retrieved the same hosts, without changing DNS or permissions. Policies and full
response hashes remain with the ignored local evidence.

| Publisher | Policy reviewed October 22, UTC | Observed public page outcome |
| --- | --- | --- |
| `www.opclerkofcourt.com` | 15:19:12, ordinary policy 404 | [Ouachita links](https://www.opclerkofcourt.com/links.aspx) returned an unpopulated application shell, not a named slate. No administrative or authenticated endpoint was used. |
| `clerk25th.com` | 15:19:14, wildcard allow | [Plaquemines qualifying](https://clerk25th.com/elections/qualifying-for-elected-office/) and [election overview](https://clerk25th.com/elections/) supplied instructions/offices and excluded state-portal links, not an independent named list. |
| `www.bossierclerk.com` | 15:19:15, wildcard allow | [Bossier home](https://www.bossierclerk.com/) supplied services, closure notices, training and external state links, not candidate names. |
| `www.livclerk.org` | 15:19:16, empty successful policy | [Livingston elections](https://www.livclerk.org/elections/) supplied voting information and external ballot/results links, not a named slate. |
| `www.tangiclerk.org` | 15:25:48, public election path permitted | [Tangipahoa current election](https://www.tangiclerk.org/elections/current-election-news) linked its candidate list to the excluded state portal. Neither that portal nor the precinct-document link was fetched. |

These five publishers supplied no accepted named slate. A later independently
permitted St. Charles Parish publication supplied the reviewed source below.
Search-only third-party ballot sites were discovery leads, not substitutes or mirrors for excluded state data.
Existing Louisiana SOS, Jefferson, Calcasieu and other publisher exclusions remain
in force. These findings concern the reviewed pages, not proof that an entire
parish has no other permitted publication. Broader research remains unfinished.

## St. Charles Parish candidate source

The registrar's [current publication page](https://www.stcharlesparish.gov/Home/Components/FacilityDirectory/FacilityDirectory/26/183)
now links a [November 3 unofficial sample](https://www.stcharlesparish.gov/home/showpublisheddocument/13854/639254309447270000),
although the discovery index still described its earlier June sample. Exact-host
policy was captured at 15:29:40 UTC and permits both observed paths. Script,
administrative and web-service exclusions were preserved. The original two-page
scanned PDF was downloaded directly from the parish at 15:30:58 UTC, without a
redirect, state-portal request or alternate identity.

- PDF: 1,655,119 bytes; SHA-256 `11998379597cd79ff47952805b7beebba0ce9975a5b9f1f3359553fffd051506`.
- Thirty-two candidate rows in ten races: 26 on page one and six on page two.
- Two Senate general-election candidates, fifteen U.S. House primary candidates,
  three Public Service Commission District 1 candidates and twelve parish/district
  candidates. No separately unstated local or commission stage was inferred.
- Party labels reconcile to fifteen Republican, ten Democrat, five No Party and
  two Libertarian entries. Names, quoted nicknames, suffixes, parties and printed
  numbers were checked against both original page renderings, not accepted from
  OCR alone. In particular, Patrick Forbes is printed as Democrat, and Michael
  Mebruer's surname and Lindsay Garcia's quoted nickname were checked visually.

The external `louisiana-st-charles-2026.json` snapshot and matching candidate-claim
CSV/JSONL preserve document/page provenance. Snapshot SHA-256 is
`ce32cbc62c839e4c5cad573ab104a7b0fc87201b5037e9136d056376ebcfd720`;
CSV SHA-256 is `3b300bf85f563f64b800452435474f3e7562b627f84ec3712bb44e1ebaab01a5`.
The new `la-st-charles-sample-2026` source is manual-review/external-storage only;
no PDF, candidate corpus or operator handoff enters Git or the runtime artifact.

The Public Service Commission is a state office elected by district, not a parish
office or a statewide electorate. Its three records retain state-office scope,
District 1 and its precise jurisdiction. An explicit source-side
`withheldStatewideOffices` gate excludes it from personal previews. House and local
choices are also withheld from unverified district matching. The state-office
filter distinguishes statewide offices and state districts. A controlled preview
therefore contains only the two Senate candidates, even with coincident House
district numbers. The source does not establish a complete Louisiana ballot.

Printed voting-area strings and partial-precinct labels remain in the claim
companions, including the ambiguous slash in the School Board District 8 label.
They are not converted to Census/legal boundaries or inferred FIPS identifiers.
The ten constitutional amendments and two parish propositions remain unimported.
The earlier fifty datasets and 25,568 records remain unchanged. This local source
adds 32 records, yielding 51 prepared official datasets and 25,600 records across
all fifty states plus DC, not complete candidates or personal ballots. Source
publication and production import remain separate pending work.

## Initial local verification on v1.13.0

The strict root locked install, lint, type checks and 91-module build pass. The
unit suites report 793 passes and two existing optional PostgreSQL skips. Eleven
compiled actual-data API/recovery checks verify all 32 exact IDs, scope filters,
reviewed names, source isolation and the unchanged 25 Louisiana references.
Twenty-four rendered cases cover the directory, state-office filter and four
actual detail pages at 320/1280 pixels in light/dark modes, with no horizontal
overflow or WCAG 2 A/AA violations. Mobile directory and commission-detail
screens were also inspected visually.

Missing and corrupt local snapshots return the existing 200/unavailable response
with zero candidates, preserving healthy references; restoration recovers all 32
without restarting. The initial verifier incorrectly expected HTTP 503 for a
corrupt stored snapshot. Its completed 24 rendering checks were retained; a
separate exact-data recovery check verified the real unavailable-data contract.
No application behavior or acceptance gate was changed to pass that check.

The fixture makes no publisher requests, uses no real voter/provider or database
credentials, and removes its owned listeners, browser and external test store.
All 370 preceding canonical files, 52 preceding state-source configurations and
61 reference configurations pass independent preservation checks. Local source
and research-export secret scanning passes; no source was sent to GitGuardian.
This is local source/data acceptance, not hosted CI, signed-artifact, production
PostgreSQL, release publication or live-data activation acceptance.

## Integration onto the cleaned v1.13.1 baseline

The prepared source cohort was fast-forwarded onto the independently accepted
v1.13.1 pool/release-identity repair without changing its implementation. All
387 retained data files and the nine local source/audit files were preserved;
the only upstream change within the cohort replaces an obsolete tracked-handoff
reference with a local-only reference. No operator prompt is tracked or packaged.

Fresh root and standalone back-end locked installs, lint, type checks, both
builds, 794 unit passes/two optional local PostgreSQL skips, 21 browser tests,
48 general accessibility cases, full/production audits, registry signatures,
native-lockfile checks, production fixture and analytics checks pass. Another
24 actual-data rendered cases pass at 320/1280 pixels in light/dark modes, with
11 compiled API/identity/recovery cases and no publisher requests. Both local
development identities agree; this is not a claim of immutable or live release
identity. Directory and commission-detail screenshots were visually inspected.

The new cumulative external package contains 96 regular JSON members: 34 reviewed
official snapshots, 61 reference snapshots and a manifest. The exact unpacked
package passes the maintained compiled import commands for all 95 snapshots,
retaining 17,694 candidate records and 534 reference profiles/1,120 facts.
Seventeen separately parsed historical automatic captures bring the prepared
official total to 25,600. Their parsing is not a claim of current publisher
freshness. Research-only measures/local backgrounds/access catalogs are excluded.
Prior archives remain byte-exact, and all owned fixture stores/listeners/browser
were removed. Protected CI, immutable artifacts and production activation require
their own separate acceptance; no local check substitutes for them.
