# National congressional biography collection

## Scope

Forty additive reference collections contribute 162 profiles and 325 short factual
items, matched to active retained 2026 general-election candidate records. The
preceding eleven configurations/92 profiles/248 facts remain unchanged. Combined
references total 51 collections, 254 profiles and 573 items across 44 states. These
are background references, not official choices, complete slates or personal
eligibility. Official source data remains fifty datasets/25,568 records across
49 states plus DC; Louisiana still lacks an accepted official qualification list.

The six reference-state gaps AR/DE/ID/ND/VT/WY plus DC remain unfinished. Strict
matching deliberately leaves nicknames, omitted middle names, ambiguous identities
and unsupported office/geography unresolved rather than guessing.

## Source and access

The source is the Joint Committee on Printing/GPO's
[2025–2026 Congressional Directory](https://www.govinfo.gov/app/details/CDIR-2026-02-20).
Its actual sitemap-linked details page exposes the text, PDF and MODS renditions.
The exact-host robots file, developer hub and reuse policy were reviewed before
content collection. Requests used ordinary verified HTTPS, stable descriptive
identity, manual redirects, time/size bounds and no credential. Robots excludes
search/admin paths, not the requested publication paths. No restricted search,
preview, private voter API, alternate identity or mirror was used.

The [developer hub](https://www.govinfo.gov/developers) describes supported bulk
access. The [reuse policy](https://www.govinfo.gov/about/policies) distinguishes
government work from incorporated third-party copyright and nontransferable
image rights. No full publication, photos, contacts or raw book is distributed
in application snapshots, Git, runtime assets or the operator package.

| Capture | UTC | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Exact-host robots | 2026-10-22T07:13:11.287Z | 5,092 | `44c5698f1245cef059b8722b6108a87a128c61dbf4c25fbe11402952b805309c` |
| Actual text rendition | 2026-10-22T07:14:13.020Z | 1,155,810 | `7757cde4dc6cde3e7dc697bd12d841f6d9a159050769105b650e03f8c777d3e5` |
| MODS metadata | 2026-10-22T07:14:13.198Z | 4,043 | `88e4138ee726b80cbbc77e4936167bfb46fa140be51b228af7ceb1a7558291ff` |
| Original PDF | 2026-10-22T07:37:37.371Z | 18,290,908 | `c1b179bb58825fee87c21e5b3bead9bb34f63601644fb384033a9b83e57b37e2` |

All captures returned 200 without redirects. The publication date is 2026-02-20,
but the printed compilation notice says 2025-10-01. Metadata's edition/ingest dates
do not make historical membership or jobs current. The existing CA voter-guide
denial was not bypassed: this independent federal publication is not that guide.
Excluded NC/NM state candidate hosts were not requested; matching uses their
separately approved county inputs. All earlier publisher restrictions remain.

## Extraction, identity and quality

The bounded parser recognizes 476 biographies. Initial inspection proposed 179
exact full-name/state matches from the fifty retained official datasets. Thirteen
already-profiled people and four inactive matches are excluded, leaving 162.
The four inactive identities retain their official records/statuses but are not
new references: Mace/Graham in SC, Buchanan/Wilson in FL. They are not promoted
from primary activity or stale directory membership into current ballot choices.

Creation uses normalized full-name equality, including standard case/punctuation/
accent and last-name-first formatting, never fuzzy/nickname matching. State must
also match uniquely. Dropping middle initials is used only conservatively to
suppress duplicate existing profiles, never to create a new identity. Existing
directory collections do not suppress themselves during later re-preparation.
Ticket splitting is explicit: two members and a governor/lieutenant-governor
office label are required. Current election office comes from the candidate input,
not the prior congressional office. University boards and local offices are not
misclassified as governor or federal races.

Only education/professional-history fields are eligible. Field length, encoding,
control characters, clause balance, six-item/600-character limits and source
provenance are checked. Parenthetical semicolons remain within their clauses.
Current/present/open-ended job claims, military/family/birth/religion/contact
sections, elected-current-membership inferences and unknown fields are omitted.
Every accepted fact is a word-order-preserving subset of its own captured field;
candidate identity, original official snapshot hash/time and biography offset are
retained in the separate review companion. All forty state samples were reviewed.

The text contains nine replacement characters; affected fields are withheld,
not repaired by guessing accents or dates. Original PDF pages 102,143 and 147 were
rendered and visually checked. Several discrepancies are printed in the original,
not introduced by the text extractor. Six edition-specific holds across five
profiles prevent known uncertain claims from being exported:

- Morrison's education has internally inconsistent graduation ordering; omit it.
- James's directory degree labels differ from his current official biography;
  omit education rather than borrowing replacement claims under GPO attribution.
- Spartz's institution clause differs from her official biography; omit that
  clause while preserving other supported professional background.
- Rounds's state-Senate clause is withheld and the disputed governor range is
  omitted, retaining the former-governor role without inventing dates.
- Morelle's Assembly date range is withheld; the role remains without a guessed
  conversion between election and service years.

The [James biography](https://james.house.gov/about/),
[Spartz biography](https://spartz.house.gov/about) and
[Rounds biography](https://www.rounds.senate.gov/about-mike) informed conservative
withholding, not replacement records or new publisher captures. Background remains
attributed source material, not independent verification of every claim. Education
attendance is never promoted to a degree. Missing background never means withdrawal.

## Reusable preparation and storage

`manage-election-references.js prepare-congressional PLAN.json` validates bounded
local text/capture metadata, configured candidate/reference inputs, the known
edition and external output. It performs no download or import and needs no
provider credential. Files are created exclusively in fresh external staging.
Prior non-directory collections for selected states are required to avoid duplicate
people. Known excluded source IDs, wrong elections, hash/time mismatch, ambiguous
names and unsafe output are rejected. Current quality holds are edition-scoped.

Publication date, congress, edition years, compilation notice/cutoff and election
date are centralized; IDs/filenames derive the election year. New editions still
need publisher review, validated configuration and an accepted runtime. Supported
host downloads can feed this offline flow without putting bulk data in Git.
Unknown formats, count drops or empty/missing states require review before separate
imports; staging is not automatic publication authority. The new modules are
independently required by the runtime build and artifact contract. Negative tests
retain missing-module, SQL and bundled-data exclusion gates.

Forty application snapshots plus CSV/JSONL/review/manifest add 44 canonical files.
The CSV has 325 fact rows; JSONL has 162 profiles. Research companions are not direct
application importer inputs. Four owned external preparation stages were removed
after acceptance; all 276 preceding canonical files remain byte-exact.

The new cumulative local v1.11.0 package is 748,433 bytes with 85 flat members:
33 unchanged reviewed official snapshots/17,662 records, 51 reference snapshots/
254 profiles/573 facts and a manifest. Archive SHA-256:
`95a9d12a3468969ee297b560fbf95989547f6f92bc7e4eaf7bf3723658d029fb`.
Manifest SHA-256:
`23c8e0126a65ebe2b88d326a3cfa7b9af88a49f180e00d28c3f888ced73cdb0b`.
Three package files bring canonical total 323. Six preceding packages/tags are
preserved. Source agents perform no production transfer/import, scheduler install
or server administration. Approved operators must transfer and import all 84
snapshots separately; seventeen permitted automatic sources refresh independently.

## Validation

Locked root/back-end installs, configured format/lint, typecheck, both builds and
771 unit checks pass, with two existing optional PostgreSQL skips. Eight new focused
regressions cover source/edition gates, identity/status/state/ticket isolation,
deduplication, malformed/long fields, quality holds, external/exclusive staging,
no network/import and runtime helper requirements. No dependency/lockfile change.
Full/production audits, registry provenance and native-binding checks pass.

The initial formatter overlapped installation and failed while dependencies were
being replaced; it was rerun only after both locked installs finished. Subsequent
lint diagnostics were fixed through the configured tools and narrow source changes.
A runtime test fixture was extended for the two newly required modules without
relaxing its SQL/data-exclusion checks. A preliminary parser diagnostic incorrectly
stopped at line ends; it was not accepted as data. The corrected paragraph parser
preserves the complete relevant fields and rejects damaged ones.

Broad actual-data acceptance exercises compiled imports/exports, all reference
states, all fifty retained official datasets, new state pages, source attribution,
filters/pagination, partial corruption/recovery, keyboard focus, themes/mobile and
unchanged personal previews. The first expanded browser run correctly hit the
existing read throttle; the harness now paces requests/renders without changing
application limits. Its failed evidence and cleanup receipt are preserved.
The paced run passes 181 API cases and 64 rendered accessibility cases with no
violations or overflow, including all forty new state pages, six CA themes and
desktop, preceding WA pagination/focus recovery and independent collection
corruption. All 84 compiled imports and 51 reference exports round-trip. Fifty
official datasets retain their totals; reference fields never enter the eight
synthetic personal previews. Test services/stores close cleanly. The final
source-local acceptance receipt records actual results, not test intent.
Historical per-source fixture clocks preserve original captures and runtime TTL;
they do not assert that all retained automatic sources are simultaneously fresh now.

The final data-rendering pass uses compact House office labels with the district
shown once, and the actual GPO publisher. CA mobile/desktop and MI/MN mobile
screenshots were visually inspected. The existing Retrieved label was already
correct and remains unchanged; no frontend source or explanatory copy was added.

Release assets, cryptographic acceptance, public code activation and approved data
activation remain separate gates. Current server instructions specify source
allowlists, all import prerequisites, future collection/review and v1.10.5 rollback.
