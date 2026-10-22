# Attributed candidate information

## Source boundaries

This local change displays five reviewed references independently of official
candidate records: two Louisiana Senate reporting references and three Orono,
Maine candidate-provided statements. It does not add official Louisiana
qualification, change the 20,277 retained candidate records, infer local ballot
eligibility or turn reporting into an election outcome.

Louisiana Radio Network's Joe Gallinaro report is explicitly dated September 17,
2026. Julia Letlow and Jamie Davis each have one short reported-candidacy fact.
Their page shows the publisher, publication date, original October 21 capture,
source link and a qualification limitation. The older research-only JSONL remains
unchanged, rather than being relabeled as an official snapshot.

The town's Biggie, Demeritt and Biddle documents contain nine short background or
priority summaries. Candidate-provided claims are labeled as such, not presented
as independent government verification. Names and offices reconcile with the
earlier Orono sample; its printed RSU No. 26 label remains unchanged. No unknown
publication date is inferred from a filename or retrieval time. Source article or
PDF prose, photographs, family details, personal contacts, forecasts and political
endorsement arguments are not packaged or displayed.

No new publisher request is required. The prior reviewed captures and hashes
are reused with their original timestamps; all earlier robots exclusions, HTTP
403 responses and redirect-loop limits remain in force.

## Operation

`election-reference-sources.ts` pins each reviewed state, collection identity,
election date, document URL, publisher, source kind and known publication date.
The separate reference validator requires the full document set, original-byte
fingerprints, oldest capture, exact per-document contributions and bounded public
fields. Qualification/status fields, contact fields, arbitrary links and private
payload fields are refused. Reference IDs are not personal-ballot candidate IDs.

The importer and repository reuse the existing external-directory, bounded
regular-file and no-follow safety helpers. Validation precedes atomic replacement;
the cache also binds its source configuration. Missing imports remain unavailable,
malformed data fails closed, and reads observe reviewed updates without restart.
There is no network fetch, automatic news/PDF refresh or bundled fallback.

The existing `STATE_BALLOT_DATA_DIR` holds separate `references-<collection>.json`
files outside code releases. The existing lookup kill switch disables both
repositories by default. Official state-selection controls retain their existing
meaning; they do not turn reporting into an official source. Reference collection
expiry matches the official two-day post-election window. Future elections need
new reviewed collection identities and imports, not silently substituted dates.

The new read-only `/api/election-references/:stateCode` endpoint has independent
bounded filtering, pagination and throttling. Its public fields include only
reviewed names, offices, factual summaries and attribution. Failures stay isolated
from official records. The directory's information counter and `referenceOffset`
do not alter official counts or pagination. A keyboard-accessible jump link makes
the new section reachable without scrolling through fifty official rows.

The keyboard review caught redundant filter-object watchers reloading both lists
on a hash-only navigation. Their stable reactive data keys already handle actual
state/search/scope/offset changes; removing the extra watchers prevents the lists
from collapsing while the anchor is scrolling. The installed Nuxt implementation
was checked before using that behavior. Existing filter routes retain their keys,
and no global router, scrolling or reduced-motion setting is changed.

## External data

`back-end/data/state-ballots/election-references-louisiana-2026.json` and
`election-references-maine-orono-2026.json` remain Git-ignored. Each has source-review
JSONL, a manifest, checksum list and an exact three-file archive. Raw captures and
media are not archive members. The earlier 137 data files remain unchanged.

Use the separate reference command, never the official candidate importer:

```sh
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-louisiana-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-maine-orono-2026.json
node back-end/dist/manage-election-references.js export LA
```

## Acceptance boundary

Both applications build with the reference modules and management entrypoint.
The maintained runtime contract independently requires the compiled command and
retains all previous requirements. The protected runtime-artifact acceptance
command stops at its clean-source guard because this local-only worktree contains
preserved uncommitted work. That guard is not bypassed; no commit, source identity,
production artifact acceptance or release readiness is claimed.

Further profiles, official Louisiana sources, local eligibility, application
measures, legacy bulk-data migration and final server-AI instructions remain
unfinished. No commit, push, tag, release, server transfer or production change is
authorized by this local review.

## Local verification

The final source passes lint, type checking, 732 unit tests and 21 integrated
browser tests. Two existing optional PostgreSQL tests remain skipped. Both
applications build, including 85 compiled back-end modules; all fifteen native
binding checks pass. Package metadata and both lockfiles are unchanged.

The compiled-data review passes 35 responsive/WCAG cases across three schemes,
light/dark modes and desktop/320px layouts. Four additional real-data entry-page
cases confirm that the information jump is visible before the long official
list. Eight representative final images are visually reviewed for readable
attribution, factual content, wrapping, focus visibility and source/date labels.
The two explicitly synthetic pagination cases are not collected candidate data.

Both three-member external archives unpack exactly. Compiled import, restart and
export preserve all five references and eleven facts. Invalid qualification
fields and automatic refresh are refused without replacing accepted data.
Reference-cache failure returns an isolated error, and retry after restoring the
reviewed file works without restarting the service. Independent state selection,
filtering, pagination and keyboard focus pass. Personal lookup responses do not
acquire reference material. All 35 retained official datasets, 20,277 records and
219 bounded projections reconcile unchanged. No publisher request is made during
this review; source captures and known publication dates are preserved.

This batch changes nineteen maintained files: four reference back-end modules,
two tests, a front-end component and composable, the existing records page and
composable, shared public types, server registration, runtime entrypoint checks
and contract, and four documentation/inventory files. Earlier unrelated lines
inside those files remain preserved. The complete managed dirty union is 156
paths, not a new clean source identity. All 140 unrelated paths, including the
physical checkout's three modifications, remain exact. The previous 137 external
files are unchanged; the ten new ignored reference-package files bring the total
to 147. Source heads, staging and four worktrees remain unchanged.

The protected production-artifact command remains stopped at its clean-source
guard. Passing local application checks does not satisfy that separate gate.
No gate, source identity, release artifact, hosted scheduler or production
service is changed or claimed accepted.
