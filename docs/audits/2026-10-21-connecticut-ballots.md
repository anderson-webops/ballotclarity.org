# Connecticut printed sample-ballot records

## Scope and delivery

Local continuation from `94d4adc`, preserving the forty-seven prior owned changes,
every other worktree and the physical checkout's three unrelated modifications.
No commit, push, tag, release, deployment, production administration, credentials,
permissions or saved application configuration changes are authorized or claimed.

The [Secretary of the State's rolling town-ballot index](https://portal.ct.gov/sots/election-services/town-ballots/2026-november-town-election-ballots)
provided 134 town PDFs, comprising **509 pages** and 109,044,597 original bytes.
The unrelated accessibility PDF is not a town ballot. Every included PDF was
retrieved with ordinary HTTPS, HTTP 200 and successful certificate verification.
All original-byte fingerprints were rechecked before preparing the snapshot.

The dated snapshot contains **709 candidacy/context records**, reconciled from
**15,517 printed candidate-line claims**. These are not 709 unique people or a
complete personal ballot. A shared probate candidate can have separate town
contexts; no legal probate-district boundary is inferred from those contexts.

| Scope | Records | Coverage and treatment |
| --- | ---: | --- |
| Statewide | 10 | Five offices; governor and lieutenant governor remain paired |
| Congressional | 13 | All five congressional districts |
| State Senate | 70 | All 36 Senate districts |
| State House | 246 | 139 of 151 House districts |
| Regional/local | 370 | Town probate, registrar, school board and town meeting; export only |

House districts **14, 16, 21, 31, 54, 56, 68, 72, 73, 74, 75 and 113** have no
printed candidate evidence in this corpus. They are not filled with candidates
from adjacent districts or primary-election totals. Some towns are absent from
the rolling index, and the ballots do not establish a complete declared-write-in
list. A blank write-in application or ballot position is not a named candidacy.

Configured coverage is now **28 states plus DC**: sixteen automatic sources and
thirteen dated snapshots. Twenty-two states, broader local mapping, measures and
candidate profile/news research remain unfinished.

## Extraction and reconciliation

- Poppler word coordinates and independently extracted PDF grid rectangles are
  reconciled. Word centers, rather than crop-edge characters or compressed raw
  text, determine each printed name. This avoids joined names and neighboring
  trailing glyphs in Avon and Middlefield.
- The actual Office/Party header anchors the office columns and physical party
  rows. Tag letters are evidence, not party lookup keys. Bethlehem prints David
  Labriola's `9A` marker in the Republican probate row on both pages; the record
  correctly remains Republican while retaining the printed marker.
- Merged multi-seat Board of Education and Representative Town Meeting headers
  are retained. Darien's nonpartisan row is read using the independent logical
  text order. New Movement entries in Bridgeport and Stratford are not moved
  into the Independent row.
- Nineteen enclosing page-frame rectangles in Cheshire and West Haven are
  removed from the derived fixture after confirming that they enclose at least
  64 actual grid cells each. They are not extra question cells or candidate rows.
  The earlier diagnostic total of 122 question cells included those frames;
  the accepted fixture contains 103 question-cell occurrences instead.
- All 509 pages identify the exact election date, configured town and one
  congressional, Senate and House district. Bilingual headers can interleave
  town and state labels. Westbrook's source actually prints `Westbroook`; this
  one documented source spelling is explicitly scoped, not handled with a
  general fuzzy town matcher.
- Header line boundaries are preserved. New Canaan's House 125 followed by
  question `1.` must not become district `1251`. Wrapped lists, translated
  labels, Norwalk's separate `137A` line, Windham's named polling areas and
  Windsor Locks's printed `One`/`Two` labels are retained as source context.
  The 1,435 claims without a printed voting-area label remain unset.
- Blank/overprinted slot markers account for 5,033 cells and produce no candidate
  records. Candidate Marshall-Nealy is not misclassified as a `Shall` question.
- Fusion endorsements are coalesced into 168 multiple-party records while every
  original printed party line remains in the companion evidence. Governor
  running mates remain one ticket. Single-choice nonlocal nominees with
  contradictory names for the same office/district/party fail closed.
- Punctuation, case and spacing variants are coalesced conservatively. Two
  additional mappings are scoped to their exact office/district: Rosa DeLauro /
  Rosa L. DeLauro in congressional district 3, and James Jimmy Sanchez /
  James Jimmy Sánchez in House district 6. The original claims remain unchanged.
  [DeLauro's official biography](https://delauro.house.gov/about-rosa) and
  [Sánchez's legislative biography](https://housedems.ct.gov/SanchezJ/Biography)
  corroborate identity and districts, not ballot qualification. Printed samples
  remain the election-status evidence.

The maintained parser checks ordered document identities/page counts, closed
office/party vocabularies, bounds, position-marker geometry and complete core
office headers. Changed or ambiguous data fails instead of yielding a plausible
partial preview. This is a reviewed extraction, not an unattended PDF crawler.

## Runtime and transferable evidence

`back-end/src/data/state-ballots/connecticut-2026.json` is an immutable dated
snapshot. Runtime loading, cache expiry, diagnostics and exports need no PDF
software, credentials or live publisher request. Automatic retrieval is refused.

The source-set hash is
`b44cbe36eb53a434092303151287487593b438e75722e6459740ccc7824f365a`.
It hashes the ordered JSON array of original `{url, sha256}` entries. All 134
document URLs, original hashes, capture times and first-introduced record counts
are retained. Those counts sum to 709. The aggregate timestamp is the oldest
capture, **2026-10-21T08:53:53.950Z**, not the fixture/build/export time.

- `docs/data/2026-11-03-connecticut-candidates.jsonl`: one manifest plus 709
  canonical candidate records, byte-identical to the compiled offline export.
- `docs/data/2026-11-03-connecticut-ballot-lines.jsonl`: one provenance/geometry
  manifest plus all 15,517 printed claims, each linked to its canonical candidate
  ID, document index, one-based page, town, printed voting area, name, party,
  physical office/party labels, position and cell bounds in top-origin PDF points.

No residential addresses, phone/email fields, campaign contact people, biographies
or expressive candidate statements are imported. No campaign URL is guessed.
These artifacts can be transferred by an authorized operator without publishing
the original PDFs or importing a broad raw voter-data dump.

ZIP-only lookup receives ten statewide records across five offices. Only explicit
address-matched congressional/legislative districts can add corresponding records.
Local offices, town-meeting areas and questions are not assigned by ZIP, town
name or a coincidentally equal district number. The source remains a limited
official-data preview, never a verified address-specific ballot guide.

Question extraction is not complete or accepted as a measure dataset. The
fixture contains 103 question-cell occurrences with 21 town/text combinations,
but some question layouts extend above the candidate grid. They require a
separate complete-text, legal-jurisdiction and licensing review before import.
There is no voter-facing measure coverage claim from this batch.

## Copy and interface review

The existing candidate section already contains substantive data, headings,
source/date attribution, controls and consequential limitations. No decorative
introduction, onboarding sentence or development-status text is added.
The snapshot now uses the existing dated-source disclosure rather than the
generic filing-only warning, followed by the necessary missing-town/district/
write-in scope notice. The rest of the section needs no copy change.

## Verification

- Nine new focused extraction, reconciliation, geography, provenance, offline
  cache/transport and exact-transfer tests pass.
- Repository lint, typecheck and production build pass. The independent verifier
  accepts 75 compiled back-end modules and required runtime assets.
- Unit suite: **539 passes**, zero failures, two pre-existing optional Postgres skips.
- End-to-end suite: **21 passes**.
- General accessibility: **48 successful route/theme checks**.
- Built API and real-source rendering: **18 cases**, each at 320, 390 and 1280
  pixels, with zero page errors or horizontal overflow. All expected candidate
  names, party lines, source dates and scope notices render. Saved lookup cookies
  restore the same previews. Connecticut's controlled ZIP case shows ten
  candidates/five contests; its address fixture shows fifteen/eight, without
  probate, registrar, board or town-meeting leakage. Address geography is a
  controlled fixture, not a new live Census eligibility verification.
- All eighteen actual-source cases pass accessibility review; Connecticut is
  additionally checked at all three widths. General route/theme checks are
  separate. Representative ballot layouts and Connecticut desktop/mobile ZIP
  and address screenshots were visually inspected.
- Compiled Connecticut diagnostics report 709 dated records. The compiled
  offline transfer is byte-identical to the canonical candidate file.
- Removing only the compiled Connecticut asset makes the independent verifier
  fail as required. Exact restoration is verified against its original hash;
  normal verification then passes for all 75 modules and required assets.
- All 134 original source fingerprints are rechecked at acceptance. The 51-row
  state inventory exactly matches the 29 configured jurisdictions. Manifest and
  lockfile state, staging, other worktrees and physical unrelated work remain
  unchanged. The native optional-binding check also passes for fifteen entries.
- Local Gitleaks review covers all **55 changed canonical paths** with zero
  findings and no external source upload. It is repeated after final report edits.

## Local retention

After acceptance, nine exact owned intermediate targets totaling **75,834,859
bytes** are removed. These are duplicate bbox/table/enriched corpora, obsolete
inspection/geography outputs and the Idaho HTML shell returned for robots.
The compact nine candidate-cell differences between independent extractors,
source fingerprints, test logs, screenshots and cleanup ledger remain.

The 134 original public PDFs and their word-coordinate corpus are retained for
unfinished complete question-text/measure review, rather than forcing another
109 MB download. They remain local and indexed, not deployed assets. Remove
them only after that factual work is accepted or explicitly abandoned. Preparation
helpers that depended on removed derived files must regenerate those files from
the retained originals before reuse. Dependencies, useful caches, other runs,
all durable source/tests/transfers and every unrelated worktree remain intact.

## Next-source research

Read-only discovery also reconfirmed the next public entry points without adding
unvalidated candidates or altering protected voter systems:

- [Idaho's general-election page](https://voteidaho.gov/idaho-general-election/)
  links [the full candidate search](https://run.voteidaho.gov/search) separately
  from personalized voter tools. The portal's robots path returns its HTML
  application shell with `noindex, nofollow, nosnippet`, not robots directives.
  Earlier ordinary script retrieval returned HTTP 406; no identity/access
  workaround or candidate ingestion is attempted. The official pamphlet remains
  a separate potential measure source.
- [Oregon's public Candidate Filing Search](https://secure.sos.state.or.us/orestar/CFSearchPage.do)
  explicitly offers the 2026 general election, separately from finance-committee
  searches. Form selection, full result counts and nomination status still need
  validation. Its robots endpoint attempted an HTTP redirect; HTTPS-only
  transport refused it, and the policy was not forced through a downgrade.

Neither discovery changes the count of configured states. Public candidate forms,
optional pamphlet participation and finance registration are not interchangeable
evidence of ballot qualification.

## Relevant files

- `back-end/src/state-ballot-connecticut-documents.ts`
- `back-end/src/state-ballot-connecticut.ts`
- `back-end/src/state-ballot-sources.ts`
- `back-end/src/state-ballot-records.ts`
- `back-end/src/state-ballot-repository.ts`
- `back-end/src/state-ballot-snapshot.ts`
- `back-end/src/data/state-ballots/connecticut-2026.json`
- `back-end/scripts/copy-runtime-assets.mjs`
- `back-end/scripts/verify-runtime-build.mjs`
- `back-end/test/fixtures/state-ballots-connecticut.json`
- `back-end/test/state-ballot-connecticut.test.ts`
- `deploy/runtime-artifact-contract.json`
- `docs/data/2026-11-03-connecticut-candidates.jsonl`
- `docs/data/2026-11-03-connecticut-ballot-lines.jsonl`
- `docs/state-ballot-sources.md`
- `docs/state-coverage-2026.csv`
- `README.md`
- This audit.

Earlier source/data changes remain intact. Dependency manifests, lockfiles,
shared remote transport, staged state and all worktree HEADs remain unchanged.
