# Additive state-guide coverage

October 23, 2026. Local source and fixture verification, not public activation.

## Snapshot contract

`CoverageSnapshot.additionalGuides` is an optional array of bound election,
jurisdiction and location objects. Legacy primary fields remain intact. Additional
election dates, jurisdiction/state identities, contest and record identities, and
required content arrays are checked when reading the snapshot. Conflicting
jurisdictions and reused election, contest or record slugs are rejected. Multiple
elections may share an identical jurisdiction record.

Additional locations are coverage selections requiring official confirmation,
not personal address matches. Each additional guide starts with its own draft
workflow, even when the primary snapshot already has published coverage. A file
load or snapshot metadata classification does not publish the added guides.

Published public collections now consider all explicitly published, correctly
bound elections rather than only the primary election. Candidate, measure,
contest, district, election-list and source paths retain the existing content and
publication filters. Measures inherit their own parent election date. A public
jurisdiction summary cannot send readers to an unpublished next-election guide.

Location lookup selects the matched guide's jurisdiction, location and content
status, not the primary guide's context. Statewide guides can match geography
within their state, but are labeled limited local coverage. Measure-only guides
do not imply candidate coverage. Additional ballot requests cannot substitute a
different location identifier. The additive optional `BallotResponse.scope`
distinguishes statewide from local guides.

## Reader-facing changes

- Statewide guides disclose that local races are not included. They do not use
  the unqualified verified-guide badge reserved for the existing local path.
- Short measure lists show direct title-and-summary links, without duplicate
  contest headings, one-item toggles, empty office explanations or search/index
  controls for a handful of items. Long guides retain those navigation controls.
- Election indexes use whole-row links with the substantive item title and one
  supporting line. The contest page remains reachable there; measure detail is
  directly reachable from the ballot guide. No page is orphaned by these changes.
- Empty deadline sections, repeated generic office labels, per-card link stacks
  and a duplicate ballot-guide action are omitted. Existing dates remain plain
  text; source claims, qualifications and privacy/legal destinations are retained.
- Contest navigation uses the election returned with that contest, not a saved
  selection from a different state. Measure contests use their actual title.
- Unknown office contacts do not create empty field labels or unnamed email links.

## Files

- `back-end/src/coverage-repository.ts`: additive schema, binding validation and
  multi-guide repository access.
- `back-end/src/coverage-snapshot-validation.ts`: publication diagnostics inspect
  additional election/jurisdiction records as well as primary content.
- `back-end/src/guide-packages.ts`: independent draft workflow seeds.
- `back-end/src/server.ts`: published collections, lookup/location binding and scope.
- `back-end/src/location-lookup.ts`: statewide matching and limited-coverage status.
- Both `src/types/civic.ts` copies: optional ballot scope.
- `front-end/src/components/ElectionHero.vue`: truthful scope and fewer repeated facts.
- `front-end/src/components/ContestSection.vue` and `MeasureCard.vue`: direct summaries.
- `front-end/src/pages/ballot/[slug].vue`: scope and short-list navigation.
- `front-end/src/pages/elections/[slug].vue`: populated sections and concise index.
- `front-end/src/pages/contest/[slug].vue`: own-election links and substantive titles.
- `front-end/src/pages/locations/[slug].vue`: omit unknown contact fields/panels.
- `back-end/test/multi-guide-coverage.test.ts` and
  `front-end/test/guide-scope.test.ts`: identity, publication, scope and copy checks.

## Verification boundaries

Controlled local fixtures combine the unchanged Fulton primary guide with the
two North Dakota and three Idaho native measure drafts. The checks exercise no
added publication, North Dakota only, and both states together. Positive routes
use isolated test-only workflows, not actual editorial approval. The five native
drafts and their publication flags remain unchanged.

The retained 50 native candidate caches/25,031 rows and 95 reference collections/
2,040 profiles/4,235 facts remain bound to their original capture times. The
candidate-cache replay uses a historical test clock only. No publisher access,
freshness recertification, active snapshot replacement or production action is
performed. All 531 canonical data files and the separate frozen release candidate
are protected. No dependency or lockfile change belongs to this cohort.

Local checks pass: 931 unit tests with two optional PostgreSQL skips, repository
lint/types/builds, 21 built-app browser checks, 48 core accessibility cases and
15 native-binding entries. Fifty actual-data rendering/accessibility cases cover
measure, ballot, election, contest and jurisdiction routes at mobile/desktop sizes
in light/dark combinations. Three controlled publication states preserve the
primary guide and hide each unapproved added state. Four representative final
screenshots were visually reviewed.

## Unfinished work

Maintained draft assembly, editorial review and publication remain distinct from
this additive runtime contract. The native draft objects are still not complete
coverage snapshots or production-import approvals. Advisory and non-binary
questions still require an appropriate choice model. National/local content
coverage, source release and public activation are not complete.
The related-page visual review also identifies a follow-up: generic contest-role
headings/related-item labels and unknown-deadline placeholder panels still need
conditional display or substantive labels. They are not new sourced ballot facts,
and the unpublished state fixtures must not be treated as a finished public guide.
