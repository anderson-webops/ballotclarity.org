# Source-aware county integration

## Scope

Local implementation only. No commit, push, tag, release, publication, deployment,
server transfer or administration, credential, permission or saved configuration
change is authorized or performed. The final server-AI instructions remain
conditional on broader collection and setup, not delivered by this audit.

The accepted factual county package supplies 39 Brunswick County NC records and
46 Santa Fe County NM records, 155 original document claims, six distinct New
Mexico retention choices and four separate Brunswick question texts. Its
original dates, hashes and historical not-yet-integrated annotation are retained.
No publisher is requested again for implementation or acceptance.

## Contract

`back-end/src/state-ballot-registry.ts` adds two named reviewed sources alongside
the existing fifty primary sources. The original primary registry file and all
fifty primary source objects/fingerprints remain unchanged. No candidate roster
is added to code, Git or the compiled runtime. Ordinary reviewed import and
external persistent storage remain mandatory.

The repository selects a state and optional exact source ID. Default selection
tries enabled sources in registry order and returns one valid snapshot, with its
own provenance, never a merged list. An explicitly selected unavailable source
remains unavailable. Cache keys, pending fetches and external files retain exact
source identity. Manual rereads, immediate import/recovery, future-date and
post-election expiry guards remain operative.

An optional `STATE_BALLOT_ENABLED_SOURCES` allowlist intersects with the existing
state allowlist. It enables server operators to exclude a publisher entirely
without disabling independent local publications or changing application code.
Neither primary host is contacted during this review. It does not authorize
future collection against excluded publishers or automate policy approval.

The records API lists enabled source options without a publisher read, validates
explicit selection before retrieval, and derives dates, scope and document links
from the actual selected configured source. It rejects cross-state, unknown,
repeated and malformed source selections and mismatched repository results.

The directory adds only a labeled native Source selector where multiple sources
exist, an Automatic option, and necessary source-unavailable feedback. Search,
filters, links, navigation and attribution retain the choice. Changing states
clears it. Existing accessibility labels, source/date and personal-ballot limits
remain; no extra onboarding, reassurance or implementation commentary is added.

Management imports accept both sources normally. Refresh uses exact automatic
IDs, so a fallback cannot make a failed primary appear refreshed. Check/export
commands accept repeated `--source`; export additionally supports `--all-sources`.
Single-source-per-state transfer bytes remain schema 1. Multiple sources for one
state use schema 2, a source manifest and a source ID on each row. Missing inputs
fail before output creation; existing files are not overwritten.

County/district facts remain browsable rather than assigned to an address.
Every new congressional/legislative matching scope is withheld. Local offices,
regional courts, joint tickets and retention choices retain their source labels.
Question texts are not promoted into application measures.

## Verification

Lint/typecheck, 751 unit passes with two optional PostgreSQL skips, 28 focused
passes, 21 integrated passes with both builds, 86 compiled modules and fifteen
native entries pass. All fifty actual official datasets, 25,568 records and 281
bounded projections remain connected to the correct sources. All 33 reviewed
compiled imports and seventeen fresh persistent automatic-cache refreshes pass
without a publisher request. A cold repository reads every dataset exactly.

Twenty-five responsive/WCAG cases cover both counties in all three light/dark
schemes, desktop layouts, explicit source selection, attributed default fallback,
unavailable primary sources and the two state-only lookup previews. Eight final
images are manually inspected. Source control keyboard order, state reset,
office filtering and name search remain functional. Neither local nor unverified
legislative records enter a personal preview; statewide counts are twelve and
eighteen. Invalid stored county data fails closed and a restored import appears
without restart. Single-source transfer bytes remain exact. A separately labeled
synthetic primary fixture tests same-state schema-2 export; it is not part of the
collected dataset. Invalid/unavailable exports leave no partial output.

The first acceptance fixture deliberately lacked an automatic primary cache;
the local network guard blocked its attempted refresh before any request. The
unavailable-source export fixture now uses invalid stored data to test format
failure without retrieval. An initial browser harness used nonexistent theme
names and an obsolete cleanup callback. Only the harness was corrected to the
existing ledger/foundry/ember schemes and supported resource closure; its exact
owned stores/listeners were checked and cleaned before the complete final pass.
These diagnostics are retained rather than counted as successful checks.

Eighteen maintained files, fifteen baseline-bound originals, 135 unrelated path
entries and all 218 canonical external files are preserved. The primary registry,
five package/lockfiles, heads, empty staging and four worktrees remain exact.
Dirty-source artifact rejection remains a safety gate, not a passed production
artifact or deployment claim. No dependencies or versions change.

Local Gitleaks reviews 337 inputs. Its one redacted finding is the county
manifest's generator-inserted Git revision, not a credential; the exact field,
line and current HEAD are checked. The original finding remains unsuppressed,
no scanner pass is claimed, and no confirmed secret is found or input uploaded.
GitGuardian remains previously unavailable, not passed. Owned services, browser,
temporary stores and scan stages are closed/removed and independently checked.

## Changed files and copy review

- Source/data path: `back-end/src/state-ballot-registry.ts`,
  `back-end/src/state-ballot-repository.ts`, `back-end/src/state-records.ts`,
  `back-end/src/state-ballot-export.ts`, `back-end/src/types/civic.ts`.
- Management: `back-end/src/manage-state-ballot-data.ts`,
  `back-end/src/check-state-ballot-sources.ts`,
  `back-end/src/export-state-ballot-sources.ts`.
- Directory: `front-end/src/pages/records.vue`,
  `front-end/src/composables/useStateRecords.ts`,
  `front-end/src/utils/state-records.ts`, `front-end/src/types/civic.ts`.
- Tests: `back-end/test/state-ballot-multiple-sources.test.ts`,
  `front-end/test/state-records.test.ts`.
- Documentation: `README.md`, `docs/state-ballot-sources.md`,
  only NC/NM remaining-work cells in `docs/state-coverage-2026.csv`, and this audit.

Visible copy changes are limited to the necessary Source/Automatic control and
source-specific unavailable feedback. Existing source scope, dates, accessibility
labels and personal-ballot limits remain necessary and unchanged. No additional
sentences, headings, reassurance or interface explanations are introduced.
Unrelated routes, navigation, privacy/legal content and layout have no changes.

## Remaining work

The national package plus the two new county inputs supplies fifty official
datasets and 25,568 records across forty-nine states and DC. Louisiana still
lacks official candidate integration; separately attributed reporting is not
qualification evidence. Broader local coverage, permitted profiles, reliable
personal local mapping and application measures remain incomplete. No existing
denied host, private voter tool or reuse restriction is bypassed for coverage.
