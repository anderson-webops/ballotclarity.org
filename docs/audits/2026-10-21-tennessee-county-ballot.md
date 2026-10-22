# Tennessee county sample ballot

## Source and access

Local-only review on October 21, 2026. No commit, push, tag, release, transfer,
deployment, production service, credential, permission or saved-configuration
change is authorized by this work.

The ordinary [Williamson County sample-ballot index](https://www.williamsoncounty-tn.gov/2173/Sample-Ballots)
links the [November 3, 2026 English sample](https://www.williamsoncounty-tn.gov/DocumentCenter/View/29633/2026-November-General-Election-With-Sample-SAMPLE-ExpressVote-English).
Its visible four-page heading identifies the state/county general election and
date. The image-only original was captured at `2026-10-21T20:11:08.276Z`, HTTP 200,
379,354 bytes, SHA-256
`8533b2966900c51387b9f10ff10d7c5ad5cdd1aea00648fa3c6c7cd7a862e5ce`.
Normal county robots permit these index/document paths, including the applicable
AI-crawler group, and the ten-second delay was observed. The footer's Privacy
link resolves to the county homepage, not a separate policy. No applicable
factual-reuse prohibition was identified in the inspected public pages. No
restricted state portal, login, identity change or alternate export was used.
Original seal and ballot graphics are excluded from factual transfer files.

## Reconciliation

All four rendered pages were visually reviewed. Candidate counts by page are
15, zero, 28 and twelve: 55 records in fourteen distinct offices. Scopes are 25
statewide, eight congressional, two Senate, eight House and twelve municipal.
The second page contains only the third constitutional amendment, not missing
candidate data. The companion retains three exact amendment identifiers and
YES/NO choices, not an OCR transcription, legal interpretation or application
measure object.

The OCR transcript demonstrably loses names and column context. Visible text
governs, including David Hatley, Victor L. Scoggin, Jeremy Dean Hearn, Micheál
(Me-Haul) O'Leary, Catherine Barcel "Barcy" Whitson and Laura Andreson. The source
prints David A Hardy without a period after A. No spelling is normalized from
unrelated news or a different candidate. Blank write-in spaces are not people.
Printed party nominees and Independent Candidate designations are retained.
Municipal rows have no inferred party. One-person offices do not imply unopposed
or elected status. Term lengths and later withdrawals/cancellations are not
inferred.

Fairview's mayor/commissioner, Thompson's Station's mayor/alderman and Nolensville's
commissioner offices remain distinct. The alderman block at the second column's
top continues Thompson's Station from the first column; it is not attached to
Fairview or Nolensville. Two-seat voting limits are retained on the applicable
offices. Municipal records are not assigned through ZIP, county or numeric
legislative districts.

## Boundary gate

The [county election commission](https://www.williamsoncounty-tn.gov/40/Election-Commission)
explicitly links congressional redistricting adopted May 2026. This index was
captured at `2026-10-21T20:23:16.126Z`, HTTP 200, SHA-256
`bf68ac71b1af237806753a79563543bd1afb3feae0a4bb0beced85f0ec546347`.
The older county calendar lists congressional districts 5/7; the newer sample
actually prints 5/9. Do not override it with an older map or infer that 7 means 9.

Current [Census legislative layers](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer)
advertise 120th Congress and 2026 legislative geography. This alone does not
verify a stored address match against the county's adopted map. Existing generic
matches do not retain the congressional session in their public district type.
`withheldDistrictScopes: ["congressional"]` therefore prevents all eight
congressional records from entering address previews, while preserving their
browsable facts and the existing state Senate/House path. This conservative
source-level restriction is not a claim that Census lacks current boundaries.
It remains until a source/map/provider-vintage reconciliation is accepted.

## Storage and validation

The external snapshot's document-set SHA-256 is
`5b0c76ba644aec162d6f67fab937d246c7d285b61cefa79523e4179ac5aedde7`.
The original capture time is retained across import, restart, rendering and
export. New factual payloads live in ignored `back-end/data/state-ballots/`,
outside Git and immutable code artifacts. Back them up separately before
removing this checkout. The archive contains the snapshot, candidate export,
page-level candidate claims, question identifiers and manifest only. Automatic
refresh and bundled fallback are refused.

Five focused synthetic tests pass: manual-only/no-network behavior, exact
persistence/export, browse-only congressional records with typed aliases,
payload-override/date/document refusal, and source-fingerprint invalidation.
Root lint/typecheck, 648 unit tests, both builds, 21 E2E tests and the fifteen-entry
native-binding check pass. Two existing optional PostgreSQL tests are skipped.
The back-end build verifies 79 compiled modules and runtime assets.

Final compiled acceptance unpacks the exact five-file archive, checks its hashes,
imports all 55 actual records through the supported command and reads them after
restart. A separate-process export is byte-exact. Automatic refresh is refused;
an invalid document count cannot overwrite the prior good cache. The API and
public projections reconcile 27 retained snapshots, 18,728 records and 200
bounded pages with no publisher requests. All 55 Tennessee records are also
checked through the actual API and rendered pagination; source URLs and capture
times are unchanged. The ZIP fixture exposes only 25 statewide records in two
offices. Typed congressional numbers cannot bypass the source gate; typed
Senate/House matching still works. Municipal records remain unassigned.

Twenty-two rendering/WCAG A/AA cases pass across three existing design schemes,
light/dark modes and widths 320, 390 and 1280. They cover missing data, pagination,
local/congressional filters, quoted and accented names, no results, earlier
Montana/Kansas/Nevada sources, cross-state directory isolation and saved lookup
restoration. Seven final images were visually inspected, with no overflow,
uncaught page errors or reported WCAG violations. No generic onboarding or
implementation copy is added. A synthetic local-status phrase was omitted from
the final data; printed party/nominee labels, vote limits, source links and the
consequential coverage/boundary notices remain. Existing navigation and styling
need no changes for this dataset.

Diagnostics are retained, not counted as passes: ESLint's membership rewrite
initially exposed a type-narrowing error; the final two-line source gate is typed
explicitly. The first browser pass identified a missing direct document link,
which is now configured and tested. A later harness assumption expected both the
index and document in an interface that intentionally selects document links;
the final check verifies the index in the API and the document in the page. The
empty-geography lookup fixture was correctly refused saved-context persistence;
the final fixture supplies only a state identity, not invented districts. No
application safety guard, accessibility rule or source assertion is weakened.
Explicit document/font/theme/data readiness replaces a slow generic network-idle
wait in the local review harness.

The final receipt binds the seven changed canonical files, an independent local
Gitleaks scan and the preservation check. All 130 unrelated paths, five package
and lockfiles, 61 prior external files, heads, empty staging and four worktrees
are preserved. New data comprises seven ignored files; no data is added to code
artifacts. Temporary services, browser and stores are closed/removed. GitGuardian
was previously unavailable and is not recorded as a passed scan. Nothing is
published, transferred or activated.

## Continuing work

Arizona remains review-only. Newly reviewed Yavapai notices establish four
printed governor/LG tickets and three explicit local withdrawals; they do not
invent running mates for its two named governor write-ins. Its 152-page Mohave
sample is captured but not reviewed or integrated. Prior Pima/JPR transfer facts
remain unchanged. Washington's normal public candidate page is accessible, but
its prior CSV-export denial and unresolved notice links remain boundaries, not
permission to force a bulk download. Other remaining states, fuller Maine
coverage, local eligibility, amendments, profiles/news, measures and existing
bulk-data migration still need work before the final server-AI instructions.

Further source investigation finds a separate Town of Dane November index with
three explicitly linked school-area samples and a Type B notice. Its public
robots and linked document host allow those paths. Vendor privacy review and
document curation remain pending; no Wisconsin records are imported. The
separate Dane County ballot-information request returns HTTP 403 and is not
retried. Providence's public 2026 index and full current privacy notice are
readable; the notice reserves copyright in page content/format/images. No city
graphics, candidate facts or quoted policy text are imported. Its index links
state candidate searches rather than a directly accepted candidate dataset.
No access rule is bypassed through these independently published leads.
