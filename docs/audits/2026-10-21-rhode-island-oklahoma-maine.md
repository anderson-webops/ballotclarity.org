# Rhode Island, Oklahoma and Maine reviewed sources

## Scope

Local-only review of official November 3, 2026 publications. No source release,
host transfer, scheduler change or production activation is authorized here.
The publications establish printed sample-ballot facts, not personal eligibility,
current completeness, an unopposed determination or an election outcome.

| Source | Records | First document contributions | Boundary |
| --- | ---: | --- | --- |
| East Greenwich, Rhode Island | 33 | 32, 0, 1, 0, 0 | Five precinct samples; House District 24 occurs in precinct 0903, District 30 in the other four |
| Woodward County, Oklahoma | 40 | 38, 2, 0 | Two general samples and a city proposition; the second adds House District 58 |
| Selected Maine publications | 63 | 15, 18, 12, 11, 7 | Preserves Bangor's fifteen earlier municipal records and adds 48 records from Winthrop and Orono publications |

Rhode Island includes fifteen statewide, two congressional, one Senate, two House
and thirteen municipal records. All repeated candidates are reconciled across
the five originals; each original and its capture fingerprint remains required.
The printed name `Micholas A. Credle` is preserved rather than silently corrected.
Single-name offices remain listed, not inferred unopposed. Town Council elects
up to five two-year seats and School Committee up to four four-year seats.

Oklahoma includes 25 statewide candidates, two CD 3 candidates, two House 58
candidates, two county-assessor candidates and nine separate judicial-retention
names. Retention seats preserve court, district and office identifiers and the
Yes/No format. Their voter geography has not been independently corroborated, so
they remain in the non-address-matched local/regional directory category. This
conservative assignment does not assert that their electorate is county-only.
The source's `03` congressional label normalizes to district `3`; the ballot
remains the authority for the printed form. Party-only
straight-ticket boxes and Yes/No choices are not candidate records. No April
filing-book record is promoted to November qualification.

Maine includes five statewide, two CD 2, four Senate, five House and 47
municipal/regional records. The statewide Senate and CD 2 samples explicitly use
ranked-choice columns; governor and local/legislative offices do not. Readfield
and Winthrop use Senate 14 and House 57. The Orono publication contains both
House 24 and House 25 styles, with Senate 8. Overlapping Orono precinct labels
are not interpreted as a reliable voter-to-style mapping. Local county, court,
prosecutorial, school and municipal records never match generic numbered districts.

Winthrop's full school-board term and remainder ending December 31, 2027 remain
separate offices; library trustees are retained. The Orono municipal ballot and
warrant both print RSU No. 26. That source label is preserved without replacing
it with a different school district based on outside assumptions. Candidate
residential cities are not imported as electoral geography. Missing party labels,
incumbency and blank write-in spaces do not generate inferred facts or people.

## Collection and rights

The town and county public indexes, robots rules and available copyright pages
were reviewed before the document requests. Same-host collection respects the
published ten-second delay. Standard CivicPlus copyright notices do not confer
a blanket republication license; these packages contain factual election data,
not the original artwork, photographs, signatures or page design. Images and
OCR are review aids only. Every PDF's candidate-bearing pages are visually checked
against its original capture; text extraction alone is insufficient for scans.

The Rhode Island state portal, Oklahoma restricted filing host and Maine state
workbook restrictions are not retried or bypassed. Louisiana's Calcasieu clerk
publicly links a candidate photo directory, but its PDF redirects to a document
host whose robots entry returned HTTP 403. That host is not followed, and no
Louisiana candidate import is claimed. The Illuminator AI-policy entry also
returned HTTP 403 and is not retried through another identity or transport.
Axios and Verite reference entries likewise returned HTTP 403 after their robots
policies were read. WAFB explicitly excludes named AI agents; WDSU additionally
states extraction and dataset restrictions. No article body is retrieved from
those excluded or denied entries, and search-result leads are not imported as
candidate qualifications.

Louisiana Radio Network supplies a separately attributed September 17 reference
to Julia Letlow (Republican) and Jamie Davis (Democrat) in the November Senate
general. Its public robots entry permits the report, with a one-second delay;
the ordinary report and linked terms page return HTTP 200. The terms page renders
only its heading and copyright footer, with no substantive terms text or frame;
this is not treated as a blanket reuse license. Only names, reported party/race,
publication date and source provenance enter `louisiana-reported-2026.jsonl` and
its checksum companion. No article prose, quotes, media or electoral forecasts
are copied. This reference schema is not an official candidate snapshot and is
not yet displayed or used for personal matching. It does not close Louisiana's
official-integration gap or establish a complete list.

Three Orono candidate-statement PDFs were captured for separate profile review.
They are candidate-authored material, not government verification of biographical
or policy claims. Four other advertised documents produced self-redirects; no
redirect loop is followed. None supplies qualification independently of the
municipal sample. Profile prose and photographs are not copied into these
candidate packages or the application.

## Data and upgrade contract

The Git-ignored `back-end/data/state-ballots/` directory holds:

- `rhode-island-2026.json`
- `oklahoma-woodward-2026.json`
- `maine-local-samples-2026.json`

Each has candidate JSONL, printed-source claims, question references, a manifest,
checksums and an exact five-file archive. Raw PDFs and screenshots are excluded.
Ten question references preserve titles, choices and source pages. Only the two
short Maine questions and Woodward city proposition include complete question
text; other references are explicitly incomplete. These are not application
measure payloads and never imply a personal ballot assignment. The earlier
Providence question companion remains separate and unchanged.

All three source configurations require external, reviewed imports. An empty
data directory returns unavailable without contacting the publishers or falling
back to bundled code assets. Automatic refresh deliberately refuses these sources.
Use the supported compiled import command after checksum review, with
`STATE_BALLOT_DATA_DIR` set to durable writable storage outside code releases.

Maine's active source changes from `me-bangor-2026` to
`me-local-samples-2026`. Import the new five-document payload before enabling the
new source. The earlier Bangor snapshot, claims, manifest, archive and checksums
remain byte-for-byte intact for rollback. Its fifteen candidate IDs remain intact
inside the new dataset. The composite capture time remains the earlier Bangor
capture, not the time of the newer town downloads. Do not rename the old cache
or manufacture newer capture times to satisfy the new source identity.

Local eligibility, later amendments, broader local coverage, profiles/news,
application measures and final server operating instructions remain unfinished.

## Local verification

- Lint and type checks pass; both applications build, with 81 backend runtime modules verified.
- 718 unit tests pass, with two existing optional PostgreSQL skips; all 21 integration tests pass.
- All fifteen deploy-target native-binding checks pass without changing dependencies or lockfiles.
- The compiled importer, restart/export path and exact five-file archives preserve all three datasets; invalid provenance and automatic refresh are refused without modifying accepted caches.
- Thirty-five retained source datasets reconcile 20,277 candidate records through 219 bounded projections; twelve typed district cases retain correct federal/legislative matching and withhold local/judicial records.
- Sixty-one responsive/accessibility cases pass across Ledger, Foundry and Ember, light/dark and 1280/320px. Eight representative screenshots are visually inspected. Scope limits and red election dates remain visible; duplicate freshness wording is removed only from the three new/expanded notices.
- The final cached-data review makes no publisher requests. Controlled geography fixtures test real reviewed records, not new address geocoding or personal eligibility.
- The separate two-record Louisiana reference has exact source fingerprints and checksums; the official snapshot validator and compiled importer refuse it, preserving the accepted cache.

Maine's old single-image test fixture is now explicitly synthetic, preserving its
image-import and local-eligibility regressions while the live configuration uses
five originals. An earlier fixture assumed no Maine source links; the updated
test validates the new links and retains the missing-link case separately. No
runtime validation, source restriction or eligibility gate is relaxed.

Maintained files changed in this batch:

- `back-end/src/state-ballot-sources.ts`
- `back-end/test/state-ballot-coastal-plains-sources.test.ts`
- `back-end/test/state-records.test.ts`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `README.md`
- This audit

The 114 earlier external files, five package/lockfiles, all unrelated dirty work,
staging, heads and four worktrees remain protected. The final evidence receipts
also check test-service shutdown, temporary-store removal and a local secret scan.
No commit, push, tag, publication, host transfer or deployment occurs.
