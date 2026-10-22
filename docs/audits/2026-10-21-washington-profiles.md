# Washington congressional candidate information

The public VoteWA guide provides candidate-submitted profiles for both candidates
listed in each of Washington's ten congressional districts. Twenty reviewed
profiles contribute 61 short factual background summaries, separate from the
887 official-list records and from address-specific ballot matching.

## Source and authorship

The public CandidateList links, exact accepted nine-page envelope and all 887
serialized records are reconciled before collection. VoteWA's robots entry is
HTTP 404. The observed normal-mode guide explicitly loads the public
`/elections/candidate.ashx` endpoint. Ten unfiltered race requests use only the
observed election/race/language fields, an empty county and `b=0`; no voter
identity, preview parameter, login, denied export or alternate transport is used.
Requests are separated by at least eleven seconds. The source's exact response
bytes, script identity and original capture times are retained locally.

The guide states that candidates supply their statements and election officials
do not verify their accuracy. The internal `IsApprovedForPost` field is not used
by that public client and is not treated here as qualification, publisher
verification, or a new entitlement to private or preview data. No unknown
publication date is inferred. The state public-domain notice also warns about
third-party copyrights. Accordingly only factual paraphrases, attribution and
source links are packaged, not campaign prose, photographs, endorsements,
personal contacts or family/medical details. Candidate-reported education is not
silently promoted from attendance or coursework to graduation or a degree.

## Local data and display

The ignored `washington-congressional-profile-facts-2026.csv` and matching JSONL
retain the reviewed summaries, public record associations, public/data URLs and
per-response/per-statement fingerprints. Their four-member factual-review archive
is not an application import format. The separate
`election-references-washington-congressional-2026.json` and three-member archive
use the supported strict reference importer. Both packages stay outside Git and
code releases; the previous official Washington dataset is unchanged.

The new source collection pins all ten public race documents. Its optional
`pageUrl` opens the actual guide rather than a JSON response. This display link
is independently validated as normalized public HTTPS and included in the
existing source-configuration fingerprint. Imported data cannot override it.
Existing Louisiana and Orono links retain their previous fallback behavior.
No automatic profile scraping is added; future curated statements require a new
reviewed import through the existing external, atomic, no-restart storage path.

## Verification

Lint, type checking, 734 unit tests and 21 integrated browser tests pass. Two
existing optional PostgreSQL tests remain skipped. Both applications build with
85 compiled back-end modules; fifteen native-binding checks pass. The final
compiled review passes 51 responsive/WCAG cases across three schemes, two modes
and desktop/320px widths. It verifies all three reference collections, 25
references and 72 factual summaries, including the earlier Louisiana/Orono data.
Eight representative final images are manually reviewed for factual content,
attribution, wrapping and legibility. Four additional native keyboard cases
confirm focus and heading position after fonts settle, without an audit script.
Some headless raster captures begin below the heading despite unchanged native
viewport geometry before and after capture; those diagnostics are retained, not
treated as a reason to alter application scrolling or claim a new product bug.

Compiled import/restart/export, the three-member application archive, the
four-member CSV/JSONL factual-review archive, invalid-import preservation,
manual-refresh refusal, no-restart recovery, state/filter isolation and separate
pagination pass. Two explicitly synthetic pagination cases are not collected
data. All 35 retained official datasets, 20,277 records and 219 bounded projections
remain exact. Controlled personal lookups for Louisiana, Maine and Washington
do not acquire candidate-reference material. Cached acceptance makes no publisher
requests. The first rendering fixture incorrectly omitted Washington's automatic
official cache when testing missing references; it correctly attempted a blocked
automatic refresh. The final fixture retains official data and omits only the
separate reference import, proving independent availability without relaxing the
zero-publisher-request gate. No application change was needed for that diagnostic.

Nine existing files and this audit change: the source registry/validator, shared
back-end/front-end public types, reference component, two reference tests, source
documentation and Washington inventory row. Ten originals are baseline-bound;
all 150 unrelated paths and prior unrelated lines inside intended files remain
preserved. The managed dirty union is 157 paths. All 147 previous external files
are unchanged; eleven new ignored package files bring the total to 158. Heads,
staging, four worktrees, five package/lockfiles and the physical checkout's three
unrelated modifications remain unchanged. The README's partial-coverage summary
already remains accurate and needs no change.

The protected runtime-artifact check stops at its unchanged clean-source guard.
It does not pass, and no source identity or release readiness is claimed. No
commit, push, tag, publication, transfer, production service or saved configuration
is changed. Further local/profile/measure work, legacy bulk-data migration and
the final server-AI instructions remain unfinished.

### Changed files

- `back-end/src/election-reference-sources.ts`, `back-end/src/election-references.ts`
- `back-end/src/types/civic.ts`, `front-end/src/types/civic.ts`
- `front-end/src/components/ElectionReferences.vue`
- `back-end/test/election-references.test.ts`, `front-end/test/election-references.test.ts`
- `docs/state-ballot-sources.md`, `docs/state-coverage-2026.csv`, this audit
