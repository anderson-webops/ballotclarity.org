# Utah congressional profile review, October 22, 2026

## Scope and provenance

The public [current-election index](https://vote.utah.gov/current-election-information/)
links the [2026 voter pamphlet](https://vote.utah.gov/wp-content/uploads/2026/09/2026-Voter-Information-Pamphlet.pdf).
The cover explicitly identifies the November 3, 2026 general election. The downloaded
118-page PDF is 30,792,889 bytes, captured at 2026-10-22T05:35:46.438Z, SHA-256
`5869a5a4052a20a67d248a12aa35e9cacdfc7f61e9938907a89da76f4c78a434`.
That is a capture date, not a publication date inferred from PDF metadata.

Normal system HTTPS verification succeeded without trust or identity changes.
The initial ten-megabyte download ceiling stopped before downloading the PDF;
the same public link was subsequently accepted under an explicit fifty-megabyte
ceiling. No access denial was overridden. Current `vote.utah.gov/robots.txt`
permits the reviewed paths and requests a ten-second delay, honored between
same-host captures. The state terms were reviewed through their exact same-host
redirect. They do not establish unrestricted third-party statement rights.

The pamphlet's federal-candidate notice says the Lieutenant Governor's Office
has not edited submitted statements. The collection remains candidate-provided,
not official biography, state verification, independent qualification or an
endorsement. No address-based voter tool, registration lookup or campaign site
was requested. No publisher PDF, essay, photograph, contact, age, residence or
family information is packaged or committed.

## Reconciliation and factual limits

All twenty House candidate pages, the cover and the authorship page were visually
reviewed after text extraction. Every identity and printed congressional district
matches the retained official dataset's twenty House candidates. Its complete
255-record snapshot remains byte-identical. Sixteen submitted statements produce
sixteen separate references and thirty brief background/position summaries.

Jesse West, Babak "Bobby" Darvish, Daniel Cottam and Cassie Easley have explicit
no-submission pages. They remain official candidates, not withdrawn or dropped.
Robert Moesinger/Robert M. Moesinger and Blake Moore/Blake D. Moore are explicit
reviewed middle-initial variants in the same printed district, not fuzzy joins.
The review JSONL preserves those decisions and each page/fact's source phrases.

Riley Owen's Princeton attendance is not upgraded to a degree. Peter Crosby's
two degree levels are unspecified and stay unspecified. Qualified policy positions
are summarized as positions, not broader claims, legal conclusions or allegations
about opponents. One unpublished tariff summary was narrowed before acceptance
to preserve that qualification; its obsolete outputs were removed and only hash
metadata retained. State legislative, school-board and judicial listings do not
become profile coverage under this congressional collection.

## Application and operator boundary

`ut-congressional-statements-2026` adds one pinned candidate-statement source.
The existing independent reference schema, external atomic storage, compiled
import/export, filtered API and directory display need no new credential or
runtime variable. Seven preceding collection configurations are unchanged.
Reference facts never enter official totals or personal lookup previews.
The existing candidate-provided label, source link, capture date and attention-date
styling are reused without adding explanatory website copy.

The ignored `back-end/data/state-ballots/` directory holds the supported snapshot,
factual CSV/JSONL, review and manifest. CSV/JSONL are research companions, not
application importer inputs. The two-member
`server-reviewed-utah-addendum-2026-v1.10.3.tar.gz` includes only the supported
snapshot and transfer manifest. It supplements the unchanged v1.10.0/v1.10.1/
v1.10.2 packages and requires v1.10.3 plus separately approved operator transfer
and import. Exact current hashes and acceptance steps are retained in the
local-only operator handoff outside Git.

Bulk data stays outside Git and runtime artifacts. Source publication, runtime
activation and reviewed-data activation are distinct. No production connection,
transfer, import, scheduler, permission or saved-configuration change is made.

## California no-change finding

The California voter-guide host's policy request returned HTTP 403 with ordinary
verified HTTPS. No profile documents were collected. The main Secretary of State
pages were separately readable and confirmed statement participation conditions,
but do not supply permission to evade the guide denial. No CDN, alternate identity,
mirror or tax-return/contact-list request was used. California's separately accepted
official candidate dataset is preserved. Profile coverage remains incomplete.

## Local acceptance

Root and standalone back-end locked installs, lint, typecheck and both builds pass.
The unit suites pass 754 tests with two existing optional PostgreSQL skips;
all 21 integrated smoke tests pass. Local actual-data acceptance exercises eight
compiled reference imports/exports, 80 profiles/213 factual items, 43 API cases
and 24 responsive/theme accessibility renders. All 48 core accessibility checks
also pass. Representative Utah mobile/light/dark and desktop renders were visually
reviewed, with no horizontal overflow, attribution loss or date-contrast failure.

All five retained official snapshots still populate with counts 39/46/155/279/255.
Synthetic state-only previews remain 12/18/18/7/7; no reference ID or fact enters
personal lookup. Missing/corrupt reference recovery, query/scope/pagination,
source/state separation and prior collection preservation pass without publisher
requests. No provider credentials or real residential addresses are used.

Full and production audits find no advisories. All 1,227 registry signatures,
444 package attestations and fifteen native-binding entries verify. Independent
local Gitleaks scans pass. The bounded GitGuardian availability probe times out;
it is unavailable, not a passed scan. Existing hooks and all unrelated physical
checkout changes remain intact. An isolated clean-source runtime acceptance and
protected release verification are separate delivery gates, not inferred from
these local results.
