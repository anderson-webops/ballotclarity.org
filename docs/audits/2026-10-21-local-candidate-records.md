# Local candidate source records and Bangor municipal ballot

## Collection and scope

The [City of Bangor sample-ballot index](https://www.bangormaine.gov/204/Sample-Ballots)
publishes a [municipal ballot image](https://www.bangormaine.gov/ImageRepository/Document?documentID=5566)
that explicitly identifies Tuesday, November 3, 2026. Normal public requests and
ordinary TLS succeeded. The city's robots policy permits these paths for the
descriptive review agent; its copyright notice contains no explicit extraction
prohibition. No restricted state host, identity or access-control workaround was
used. The separately identified Maine general workbook, amendment and write-in
files remain unavailable through normal requests.

The image was captured October 21, 2026 at 15:38:41.119Z, with 102,433 original
bytes and SHA-256
`533ac9a4cd8468d4d5d2689b51661a2c00914168f14ab820f0337eab61f4cfad`.
All fifteen candidate rows were visually reviewed against the original pixels:
twelve City Council and three School Committee candidates. Each office has
three three-year seats and a vote-for-three limit. Blank write-in spaces are not
named candidates. No party labels appear, so none are inferred. The three-person
School Committee list is not promoted to an unopposed/elected status.

Candidate names are displayed in first-name order while the claim companion
retains each printed surname-first name, row, office, seat/term limit and original
fingerprint. OCR is only a cross-check: it misses or distorts several names and is
not imported blindly. Residential addresses printed in the original image are
excluded from every curated application and transfer record. Campaign websites,
party affiliations and state/federal ballot access are not guessed.

This is fifteen local-only Maine records, not statewide or federal coverage and
not a verified personal ballot. ZIP, county, legislative, ward or generic numeric
district matches do not assign these municipal candidates to voters.

## Access restrictions retained

King County's normal robots and election-home requests returned 200, and its
landing page explicitly links a current November general-election sample ballot.
However, its [terms of use](https://kingcounty.gov/en/shared-topics/about-king-county/website/terms-of-use)
require prior written permission for publishing, displaying or distributing
website/app content and data. No King County candidate or measure content is
integrated, exported or included in the transfer package. The downloaded PDF,
derived extracts and two renders were removed after retaining compact ordinary
transport, source fingerprint and policy-decision evidence. Its source does not
provide an access/permission workaround for the blocked Washington state export.

The earlier guessed King County November-page URL returned 404; discovery used
the actual election-home links instead. Primary-election samples and incumbent
directories are not treated as proof of November ballot qualification. Washington
remains an unresolved source, not a newly integrated state.

Further research located November general-election sample-ballot links on the
official [Bristol](https://www.bristolnh.gov/m/newsflash/home/detail/116),
[Goffstown](https://www.goffstownnh.gov/325/Elections) and
[Alton](https://alton.nh.gov/absentee-sample-ballot-november-3-2026-state-general-election/)
town pages in New Hampshire. Normal policy/index/original requests succeeded;
the three two-page PDFs are retained for the next reconciliation pass. Applicable
robots paths and crawl delays were honored, and linked copyright notices were
reviewed. These originals are not imported, exported or counted as New Hampshire
coverage. Alton has no embedded text and Bristol's embedded OCR is unreliable;
original-page review is still required. The blocked state host is not bypassed.

## Application change

`/records` makes reviewed state, district and local facts browsable without
claiming voter eligibility. It provides a state selector, office-level filter,
name/office/jurisdiction search, 50-row pagination and an explicit inactive-record
option. Source, retrieval date, election date, scope limits, known status, printed
party labels and ballot designations remain visible. Candidate websites use the
existing safe external-link component. There is no new promotional introduction,
prototype commentary, site-wide warning banner or obvious how-to paragraph.

Sources, the footer and resolved lookup results link to the directory. Lookup
links retain the current state, including full state-name inputs. Browsing does
not mutate the saved lookup or promote records into guide coverage. The page
explicitly distinguishes source records from a personal ballot. Red election
dates, existing theme/selection behavior and footer-only legal links are retained.

Two additive read-only endpoints expose state metadata and filtered/paginated
public records through the existing repository. Query length, scope, status,
single-value inputs, limits and offsets are validated before data loading. Default
active statuses exactly match the personal-preview filter. The optional inactive
view retains explicit withdrawal/defeat/disqualification/other statuses rather
than labeling all source rows active ballot candidates. Outdated offsets return
the last valid page. Missing imports, source mismatches and provider failures
remain unavailable and never reveal internal errors or fabricate a fallback.

Public serialization whitelists fields, excludes residential/contact/private
properties and rejects unsafe campaign URLs. A bounded per-client throttle runs
before source loading. Listing states does not fetch every publisher. Automatic
sources retain the existing cache/freshness/persistence controls; reviewed image
sources require manual validated imports and cannot automatically OCR/download.

The rendered-data review also found that a repeated jurisdiction/office label
could hide Nebraska's published regional district numbers. Context now falls
through to the next non-repeated source field. It retains 432 Nebraska district
labels, removes redundant numeric labels already printed in 28 New York and 190
Indiana office names, and exposes the retained source-area context on 360 South
Carolina rows. These are display changes, not geographic eligibility matches or
new source facts. Ward and circuit labels are not replaced with generic districts.

## External transfer

`me-bangor-2026` is `manual-snapshot`, `reviewed-image`, external-only. Canonical
Git-ignored files in `back-end/data/state-ballots/` are the Bangor snapshot,
candidate JSONL, fifteen linked claims, provenance manifest, checksums and an
exact four-file archive. The original address-bearing image is not an application
asset or transfer input. Back up ignored factual data independently before
removing the checkout. Existing NY/VT datasets and all unrelated work remain
protected; no new dependency or bulk payload is added to Git/code artifacts.

Nineteen manual sources plus sixteen automatic sources are configured across
thirty-four states and DC, but Maine is municipal-only. Sixteen states still have
no integrated dataset; broader Maine state/federal, local eligibility, measures,
profiles/news and validated legacy bulk-data migration remain unfinished.

## Verification

Twenty-three focused import/API/query/privacy/status tests and 607 full unit tests
pass, with two existing optional PostgreSQL skips. Lint has no warnings;
front-end/back-end typechecks and builds, all 21 integrated E2E tests, 79 compiled
back-end modules and fifteen native-binding checks pass on Node 24.18.1/npm 12.0.2.

Compiled API checks serve the actual nineteen reviewed datasets plus the retained
South Carolina capture from isolated external stores, with twenty source cases
and zero publisher requests. A separate exhaustive serialization/pagination pass
checks all 17,793 records across 188 pages, including the 523-record legacy Illinois
snapshot. IDs, public fields and original capture dates are preserved. Compiled
Bangor archive/import/restart/export reproduces the candidate transfer byte for
byte; missing imports remain unavailable and automatic image refresh is refused.
The controlled Maine ZIP fixture never assigns municipal candidates or a verified
guide. Browsing New York does not replace that saved Maine lookup.

All 34 final rendering/accessibility cases pass without horizontal overflow,
uncaught page errors or WCAG 2 A/AA violations. They include all three palettes,
light/dark and 1280/390/320px Bangor views; missing data, Vermont local records,
New York pagination, search/empty results, Nebraska district labels, Indiana
deduplication, South Carolina inactive records and narrow layout, plus Sources
and lookup-results links. Eight final screenshots were visually reviewed. The
earlier twenty-nine-case run preceded the district-label correction; only the
later built output is accepted as final evidence.

The independent local secret scan covers all 124 dirty canonical paths and
sixteen external factual/checksum inputs, with no findings or external upload.
Previously unavailable GitGuardian upload is not represented as a passed scan.
Final receipts bind source/document hashes and the scan's exact input bytes.
All 103 unrelated baseline paths, thirteen earlier NY/VT data files, five package
and lockfiles, heads, staging and four worktrees remain unchanged. Seventeen
intentionally amended prior files have baseline-bound recovery originals. The
Bangor archive contains exactly four validated factual files, without the original
address-bearing image. Temporary active-data stores are removed.

The final server-AI handoff remains queued until national collection/setup reach
their verified completion boundary. Nothing is committed, pushed, published,
transferred to the host or deployed; no server services, credentials, permissions
or saved application configuration are changed.

## Changed files

- Registry, reviewed-image validation and preview status reuse:
  `back-end/src/state-ballot-sources.ts`,
  `back-end/src/state-ballot-snapshot.ts`,
  `back-end/src/state-ballot-records.ts`,
  `back-end/src/state-ballot-repository.ts`.
- Public API, contracts and API regressions: `back-end/src/server.ts`,
  `back-end/src/state-records.ts`, `back-end/src/types/civic.ts`,
  `back-end/test/state-records.test.ts`, `front-end/src/types/civic.ts`.
- Directory and navigation: `front-end/src/pages/records.vue`,
  `front-end/src/composables/useStateRecords.ts`,
  `front-end/src/utils/state-records.ts`,
  `front-end/test/state-records.test.ts`,
  `front-end/src/components/LookupResultsPanel.vue`,
  `front-end/src/components/AppFooter.vue`,
  `front-end/src/pages/sources/index.vue`,
  `front-end/server/routes/sitemap.xml.ts`.
- Documentation and inventory: `README.md`, `docs/state-ballot-sources.md`,
  `docs/state-coverage-2026.csv`, and this audit.
- Three reviewed-document tests retain their raw-document rejection assertions,
  with the obsolete “bundled snapshot” error expectation changed to “validated
  snapshot” for external imports: `back-end/test/state-ballot-ca-in-tx.test.ts`,
  `back-end/test/state-ballot-county-publications.test.ts`,
  `back-end/test/state-ballot-reviewed-pdfs.test.ts`.

No further About, legal-navigation, privacy or selection changes are necessary in
this pass. Their earlier accepted changes remain intact. New visible copy is
limited to candidate/source facts, controls, essential status/error feedback and
the local distinction between source records and personal ballot eligibility.
