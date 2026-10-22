# External reviewed election data: local migration review

## Scope and authority

Local source, data and validation only, starting from detached
`94d4adc0f576496f729628fcd3dc576964a5621f`. This review does not authorize a
commit, push, tag, release, deployment, server transfer, production import,
credential change or saved configuration change.

## Data preservation

Sixteen legacy runtime snapshots and eleven bulky documentation transfers moved
to the existing ignored `back-end/data/state-ballots/` collection area.
Snapshots retain their basenames; transfer files are under
`reviewed-transfers/`. All 27 original files, totaling 19,110,939 bytes, remain
byte-exact there, with separate original recovery copies and a SHA-bound manifest,
28-member archive and checksum file. The sixteen snapshots retain 16,171 records.
No candidate fact, document contribution, source hash or capture date is rewritten.
No Git history is rewritten.

The migration package is named `legacy-reviewed-state-data-2026`. Its canonical
inputs are not runtime cache envelopes. Production imports must use a separately
owned, absolute `STATE_BALLOT_DATA_DIR` outside the checkout and immutable release.
This review does not choose or change a host path.

All 158 pre-existing external files remain exact. The migration adds 30 files,
including the eleven nested transfers. Data archives and raw datasets stay out of
future source/code artifacts; previously published history is not erased.

## Runtime and artifact behavior

All 31 reviewed sources now require external validated imports, including the
sixteen legacy sources whose configuration lacks an explicit storage flag.
Source configurations remain unchanged to preserve fingerprints and cache
compatibility. The legacy snapshot parser name remains for compatibility;
the old bundled loader is a fail-closed shim, not an alternative data source.

Reviewed sources read external storage on each request. Missing data, a corrupt
envelope or a future capture time fails closed. A valid subsequent import becomes
visible without waiting for a positive or negative cache expiry or restarting the
service. Existing in-flight request coalescing remains. The nineteen automatic
adapters retain their existing TTL, negative-cache and transport behavior.
No PDF, image, news or candidate-statement automatic extraction is added.

The build copier removes obsolete generated candidate bundles and refuses their
reintroduction into source. Independent compiled-tree verification rejects their
presence. Artifact inspection rejects former source, runtime, canonical-collection
and former documentation data paths. SQL assets remain required. The data import, export and
source-check command entrypoints are explicitly required alongside the server and
reference manager.

Pre-change compiled code and current code round-trip all sixteen migrated caches
with exact records, dates and source configurations in both directions. All fifty
configured source objects match. This is compiled cache interoperability evidence,
not verification of a protected retained production artifact or actual host rollback.

## Deterministic tests

A 746,112-byte, explicitly test-only catalog replaces production-data dependencies
in tests. Existing parser and county fixtures remain unchanged. Connecticut and
Oregon companion claims are regenerated from those fixtures and checked against
their original transfer hashes rather than duplicated.

Indiana, Texas, Nebraska and DC use bounded regression selections, retaining
nonlocal records and representative local/status edge cases. Those selections are
not production bootstrap data or evidence of full source completeness. Full
production datasets are preserved and verified separately. The other twelve
legacy snapshot fixtures retain their original record counts.

Ten existing backend test files now explicitly inject owned external fixture
stores. New storage regressions cover all reviewed sources, same-clock imports,
replacement, corruption/future rejection and recovery. New root tests separately
exercise stale-copy removal, source-bundle refusal, independent compiled rejection,
required SQL and artifact-path exclusions.

## Verification

- Node 24.18.1 and npm 12.0.2; no dependency, package or lockfile changes.
- Lint and frontend/backend typechecking pass.
- Unit suites: 740 passes, zero failures and two existing optional PostgreSQL skips.
- Integrated suite: 21 passes, including both application builds.
- Compiled verification: 85 backend modules, required SQL/command files and no
  compiled candidate-data directory.
- Fifteen deployment-target native dependency entries pass their existing check.
- Full-data verification retains all 35 official datasets, 20,277 records and 219
  bounded projections. All 31 compiled reviewed imports preserve exact records
  and capture dates. Three existing reference collections retain 25 records and
  72 factual summaries, separate from official records and personal lookups.
- 120 responsive/WCAG cases pass with no overflow, page errors or reported
  accessibility violations. Every reviewed source renders in desktop light and
  phone dark modes; reference checks cover all three schemes and both modes.
  Full Illinois import, corruption and restoration are visible without restart.
  Two pagination cases use explicitly synthetic records, not collected data.
  Eight final images are manually inspected. Acceptance makes zero publisher
  requests and blocks browser requests outside loopback.
- Preservation binds 63 originals and 119 unrelated paths. Managed dirty union
  is 143 paths; physical main's three unrelated changes, both heads, empty staging,
  four worktrees and all five package/lockfiles remain unchanged. The complete
  external collection has 188 files, including thirty new migration files.
- Local Gitleaks 8.30.1 reports zero findings across 302 maintained/data inputs;
  nothing is uploaded. GitGuardian remains previously unavailable, not passed.
- Independent read-only checks confirm thirteen owned process IDs, six listeners
  and nine temporary stores absent. Pre-change compiled cache checks and local
  archive verification also remove their exact owned temporary stores.
- The protected runtime-artifact command stops at its unchanged clean-source
  guard. It is not passed, bypassed or represented as deployment-ready.
- `git diff --check` passes; Git reports only existing line-ending normalization
  notices, not patch whitespace errors.

The first focused pass exposed an unseeded Alaska test, and the first complete
unit pass exposed an Oregon/Utah isolation test still relying on the former
bundled fallback. Both now inject explicit controlled external fixtures; their
substantive parsing and cross-state isolation assertions remain. One formatting
diagnostic was corrected. The first expanded browser reviewer assumed every
source has an optional scope notice; the assertion now checks it only when the
source declares one. A second reviewer assertion requested an unadvertised raw
PDF instead of the source's actual page-link contract; it now checks declared
document links or the official landing page. The preservation reviewer also
changed its unchanged-source binding from a nonexistent intended backup to the
original baseline hash. These are retained diagnostics, not ignored failures or
new publisher requests.

Final code review found that seeding the malformed-portal regression could stop
at a cache-fingerprint mismatch before parsing its deliberately incomplete
response. That test now has no external store, requires exactly one controlled
fetch and retains its original unavailable/format assertions. The full lint,
typecheck and unit checks run again after that correction.

## Changed files and editorial assessment

Runtime changes are in `state-ballot-repository.ts`,
`state-ballot-snapshot.ts`, the backend asset copier/verifier,
`scripts/runtime-artifact.mjs`, the deployment contract and root ignore rules.
The sixteen former source snapshots and eleven former `docs/data/` transfers
are removed only after exact external preservation. Test changes are limited to
explicit fixture injection, the bounded catalog/helper and exclusion regressions.
`README.md`, `docs/state-ballot-sources.md` and `docs/runtime-artifact.md`
describe the new import/build boundary.

No visible frontend copy, navigation or layout changes are needed for this
migration. Existing source attribution, capture dates, qualification boundaries,
unavailable states and nonpersonalized-data limitations are necessary factual
disclosures and remain intact. There is no new reassuring, instructional or
implementation commentary in the interface. Existing environment-example settings
already cover persistent storage and need no change.

## Remaining boundary

This is one local setup improvement, not national-coverage completion.
Thirty-five retained official datasets are distinct from fifty configured source
jurisdictions. Local eligibility mappings, further candidate profiles, question
integration and remaining automatic-source caches still require evidence-based
work. Separately attributed reporting and candidate-authored information never
become official qualification or personal ballot eligibility. Final server-AI
operating instructions remain unfinished and undelivered until the broader
collection/setup requirements are ready. No scheduling or production activation
is claimed.
