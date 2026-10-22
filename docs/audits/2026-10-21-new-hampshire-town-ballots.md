# New Hampshire town sample-ballot integration

## Sources and scope

Official November 3, 2026 general-election samples are published by
[Bristol](https://www.bristolnh.gov/m/newsflash/home/detail/116),
[Goffstown](https://www.goffstownnh.gov/325/Elections) and
[Alton](https://alton.nh.gov/absentee-sample-ballot-november-3-2026-state-general-election/).
All six original pages were visually reviewed. Normal policy, index, copyright
and original-file requests succeeded with ordinary TLS and a descriptive agent.
The applicable Bristol ten-second and Alton twenty-second crawl delays and
Bristol's named AI expensive-route restrictions were respected. The linked
copyright notices contain no explicit extraction/redistribution prohibition.
Blocked state and Exeter sources were not bypassed or retried with another
identity, host, cached payload or weakened TLS.

Original captures, not the review time, define the data's retrieval dates:

| Town | Captured October 21, 2026 (UTC) | Bytes | Original PDF SHA-256 |
| --- | --- | --- | --- |
| Bristol | 16:32:49.853 | 317,788 | `a33c47be28cc061e0de6d9636fe6ec24547ff5f89e1b042c79846f176f31c4ec` |
| Goffstown | 16:32:50.076 | 60,787 | `740d817ffcffe002814ddf75f58301d107d3c9845045346eaf6cb4a454e33996` |
| Alton | 16:32:50.394 | 575,282 | `4dc23d067eb4ada88ca94f84fae93325dc153fbf671f5a6c59ec06ff64a2326d` |

The three-document source fingerprint is
`25264c6601c8a28a2f4de9f2368c88c19fea87103fd6160afb480d66680e52c9`.
This is a partial, dated sample-ballot collection, not a complete state
certification or verified personal ballot.

## Reconciliation

The 92 printed party lines in 37 printed office blocks produce 76
candidate/ballot-area records. Six statewide governor/U.S. Senate candidates are
coalesced across three town publications. Four same-name, same-office, same-area
Republican/Democratic endorsements remain single records with both party labels.
Their separate printed claims, physical party columns, rows and page numbers
remain in the claim companion. Goffstown's Other/Republican/Democratic column
order differs from Bristol and Alton; it is not assumed to be universal.

The resulting scopes are six statewide, seven congressional, six state Senate,
twenty-two state House and thirty-five local/regional records. Repeated names
across different unmapped congressional/council ballot areas are not silently
merged into an inferred common district. These are records, not a claim of 76
different people. Blank write-in spaces are excluded. Listed candidates are not
promoted to qualified, unopposed or elected status; party membership and campaign
websites are not guessed.

Original pixels and enlarged details resolve names where OCR is unreliable,
including `Matthew D. Bjelobrk` and the printed compound `Steven PihlCoffill`.
Goffstown's `Shanun R. Carey`, initials, suffixes, wrapped names and apostrophes
are preserved rather than normalized to more familiar spellings. Alton has no
embedded text; OCR is a cross-check, not the import source.
The independent OCR cross-check finds 73 of the 92 full printed names exactly;
the other nineteen wrapped or misread claims are reconciled against original
pixels, not accepted through fuzzy name substitution.

House labels remain exactly county-named: Grafton 10/18, Hillsborough 29/44 and
Belknap 7. They never become bare Census district numbers. Goffstown's four-seat
and two-seat House blocks and Alton's three-seat block retain their printed vote
limits and seat counts. Unprinted congressional, Senate, executive-council and
county district identifiers are not inferred from town names. Only statewide
candidates or an exact, independently supplied county-named House match can
enter a candidate preview. This still does not publish a verified voter guide.

## Additional factual data

Four ballot questions are retained separately: the shared CACR 13 probate-office
question and three town-specific school tax-growth questions for Newfound Area
(SAU 4), Goffstown (SAU 19) and Alton (SAU 72). The companion retains full printed
question text, Yes/No choices and all six question/source claims. Printed
legislative passage numbers are not election results. The proposed probate change
does not remove the current ballot's probate candidates.

These questions are not yet integrated as application measures or assigned to
voters. No recommendation, passage prediction, legal interpretation or invented
summary is added to the interface.

## Storage and display

`nh-town-ballots-2026` is reviewed-PDF/manual-snapshot/external-only. Seven
canonical ignored files in `back-end/data/state-ballots/` contain the snapshot,
candidate and claim JSONL, measure companion, manifest, checksums and an exact
five-file transfer archive. Original PDFs/renders are not code or transfer assets.
The first document contributes 27 new records, the second 29 and the third 20;
these unique contributions are not confused with their printed row totals.
Back up ignored data independently before removing the checkout.

The candidate directory exposes the facts through its existing filters and
pagination. A small additive metadata field supplies labeled links for all three
original PDFs; links must match the configured document set, use safe HTTPS URLs
and have nonempty bounded labels. Invalid or reordered link metadata fails
closed. No source fan-out is introduced. Missing imports still expose the
official document links without claiming data availability. Sources without
explicit document links retain their existing official-index link.

Visible copy remains limited to factual source coverage, candidate data, controls
and essential limitations. There is no new tagline, introduction, prototype
commentary, global warning banner or how-to section. Earlier About, privacy,
selection and footer-only legal-navigation work is preserved.
Visual review caught a redundant internal matching code after the already
printed House district name. The context helper now prefers the published
district label and suppresses its opaque matching alias. All twenty-two affected
House rows retain their full printed district and source area; exhaustive checks
over 17,869 records confirm every other display context is unchanged.

## Verification

Twenty-one focused tests and 615 full unit tests pass, with two existing optional
PostgreSQL skips. Lint has no warnings; front-end/back-end typechecks and builds,
all 21 E2E tests, 79 compiled back-end modules and fifteen native-binding checks
pass on Node 24.18.1/npm 12.0.2.

The compiled API serves twenty-one locally retrieved snapshots with zero publisher
requests. Exhaustive serialization/pagination checks retain 17,869 canonical
records over 189 pages. The New Hampshire archive has exactly five factual files
and is 11,282 bytes. Unpack/import/restart/export reproduces the candidate transfer
byte for byte; missing imports stay unavailable, and automatic PDF refresh is
refused. A controlled state-only ZIP lookup attaches six statewide candidates in
two offices without publishing a guide. Exact county-named House fixtures add
only their own two/eight/six/four candidates; bare numbers, other district types
and all unprinted congressional/Senate/county identifiers add none. These fixtures
do not certify real-world voter geocoding or local eligibility. Browsing New York
does not replace the saved New Hampshire lookup.

All 31 final rendering/accessibility cases pass without horizontal overflow,
uncaught page errors or WCAG 2 A/AA violations. They include eighteen New Hampshire
local-list width/palette/light-dark combinations, both candidate pages, five named
House districts, original spellings, empty search, missing imports, original PDF
links, older Maine/New York datasets and three lookup widths. Six final images
were visually reviewed. The first automated rendering pass preceded the visual
district-code correction; only the later built output is accepted as final.

The local independent secret scan covers all 126 dirty canonical file paths plus
twenty-two external factual/checksum inputs, with zero findings and no external
upload. Previously unavailable GitGuardian upload is not represented as passed.
Final receipts bind exact scan inputs and source hashes. All 116 unrelated
baseline paths, nineteen earlier external-data files, five package/lockfiles,
heads, staging and four worktrees remain unchanged. Eleven intentional prior
deltas have baseline-bound recovery originals. All owned API/browser processes
are closed and active temporary data stores are removed.

The inventory now has thirty-five states plus DC: sixteen automatic sources,
twenty dated/manual sources and four external-only sources. Fifteen states still
lack integrated datasets; broader local mapping, measures, profiles and validated
legacy bulk-data migration remain unfinished. National collection and the final
server-AI handoff remain incomplete. Nothing is committed, pushed, published,
transferred to the server or deployed. No service, credential, permission or saved
application configuration changes are made.

## Remaining-state leads

The [City of Independence, Minnesota election page](https://www.ci.independence.mn.us/government/elections)
independently publishes four school-area sample PDFs, and
[Story County, Iowa](https://storycountyiowa.gov/1754/General-Election-11032026)
links a general-election candidate list. Permitted normal policy/index/original
requests retain four two-page Minnesota originals and a ten-page Iowa original
for the next reconciliation pass. A same-host Iowa 301 supplies its canonical
document URL; this is not a denied-source workaround. Iowa's PDF metadata title
still says 2022 while its visible text header identifies November 3, 2026 and
FINAL, so original-page review is required rather than trusting metadata alone.
Minnesota's samples have no embedded text. Neither state is newly imported,
exported or counted as integrated by this work. Publisher privacy/copyright/
disclaimer notices and exact transport fingerprints are retained; no blanket
license for all files is inferred from a notice applying to a particular document.

## Changed files

- Registry and safe source-document metadata: `back-end/src/state-ballot-sources.ts`,
  `back-end/src/state-records.ts`, `back-end/src/types/civic.ts`,
  `front-end/src/types/civic.ts`.
- Directory rendering and regressions: `front-end/src/pages/records.vue`,
  `front-end/src/utils/state-records.ts`,
  `front-end/test/state-records.test.ts`, `back-end/test/state-records.test.ts`,
  `back-end/test/state-ballot-new-hampshire.test.ts`.
- Inventory and operator documentation: `README.md`,
  `docs/state-ballot-sources.md`, `docs/state-coverage-2026.csv` and this audit.
