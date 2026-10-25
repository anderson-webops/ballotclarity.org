# State-measure guide preparation

`prepare-state-measure-guides PLAN.json` is an offline preparation command. The
compiled entrypoint is `back-end/dist/prepare-state-measure-guides.js`; the source
entrypoint is `back-end/src/prepare-state-measure-guides.ts`. It does not fetch,
change active data, publish guides, or approve production import.

## Plan contract

The JSON object requires `schemaVersion: 1`,
`type: state-measure-guide-preparation`, `baseSnapshot`, `inputs`,
`outputDirectory` and a lowercase slug `outputName`.

- `baseSnapshot` is either null or an absolute `path` and exact `sha256` pair.
  Supplied primary and additional records are preserved by default. Base approval
  is not inherited by added data. Ordinary preparation remains append-only and
  rejects an existing state/election/jurisdiction scope. The explicit primary
  augmentation option below prepares an additive review, not an approved replacement.
- Each input supplies absolute draft `path`, `sha256`, `stateCode`, `electionDate`,
  `summaryAsExplanation` and `documents`. State/election selection is configuration,
  not a hardcoded 2026 state list. Native drafts must remain explicitly unpublished
  and unapproved for automatic import.
- Local inputs also require a matching `jurisdiction` object in both plan and
  native draft: `jurisdictionType` (`county`, `city`, `town` or `independent-city`), `name` and a
  state-prefixed `slug`. Measure locations must name that same area and state.
  Omitting, changing or broadening a local scope to statewide is rejected.
- Each document supplies its native dictionary `key`, absolute capture `path`,
  `sha256`, exact `url` and original `capturedAt`. Every native document must have
  one matching capture. Source/page references and known publication dates must
  match that document's reviewed metadata. Retrieval/preparation dates do not
  become publication dates.
  PDF page checks use the pinned bytes, including document-center URLs without
  a `.pdf` suffix; citing an unreviewed page is rejected.
- `summaryAsExplanation` explicitly permits copying an existing summary into an
  empty native explanation field. This is recorded as a field mapping, not a new
  factual claim or editorial approval. Leaving it false preserves the empty field.
- `outputDirectory` must be a new directory outside the application/release, with
  an existing parent. Existing directories/files and symlinked inputs are refused.
  JSON drafts and base snapshots retain the 12 MiB file limit. Pinned PDF
  documents may be up to 32 MiB; larger non-PDF captures remain rejected. All
  preparation inputs together are limited to 64 MiB, and each output file stays
  within 12 MiB. This does not increase candidate-cache or network-collection
  limits.

## Outputs

Standalone preparation emits six flat files: guide bundle, draft workflows,
review diagnostics/holds, measure/source CSV, manifest and checksums. The bundle
is not a complete coverage snapshot or a primary-guide replacement. It contains
only selected native measures, never coerced non-binary advisory questions or raw
PDFs/HTML.

With a pinned base, two additional files contain the combined coverage draft and
digest-bound metadata. Metadata stays unknown and has no review/approval dates;
normal coverage promotion rejects it. Exported workflows concern only newly added
guides and always start in draft. Existing publication decisions are not exported
or changed.

## Explicit primary augmentation

An optional `primaryAugmentation` object supplies the pinned base's exact
`electionSlug` and `jurisdictionSlug`. It requires a non-null base and exactly one
native input matching the primary state, election date, jurisdiction kind and name.
It rejects an additional-guide target, ambiguous duplicate primary scope, existing
contest/measure identities and conflicting source identities. The ordinary plan
without this option retains its existing append-only behavior.

Mode `augment-pinned-primary-review-only` adds the new measure contests, root
measure records and citations. Existing contests, candidates, jurisdiction/location
records, primary metadata/freshness clocks, collection metadata and every additional
guide remain intact. The bundle and draft workflow concern the augmented primary;
the CSV identifies the new claims using the existing canonical primary slugs.
The manifest distinguishes changed primary content from preserved primary metadata
and existing contests.

All publication, automatic-import and primary-replacement approval flags remain
false. Digest-bound coverage metadata remains unknown. Preparing or repeating an
augmentation does not promote data or change an existing output/active snapshot.
Normal independent coverage and guide acceptance still apply to the exact result.

## Claim fields

The CSV grain is one measure/source citation, with title, summary, YES/NO meanings,
original capture information and source/draft digests. Spreadsheet-risk prefixes
are escaped in CSV only; JSON claims are unchanged. Fiscal, legal and timing
qualifiers remain in native JSON. Unknown optional update dates stay unknown;
freshness aggregation compares actual instants, including time-zone offsets.

An optional native `ballotOptions` object preserves the printed binary pair using
the existing `yes` and `no` selection keys. Supported pairs are Yes/No,
For/Against, Approve/Reject and For general obligation bonds/Against general
obligation bonds, matched without changing the source's letter case.
Omission retains the legacy Yes/No behavior. Reversed, unknown, duplicate or
non-binary choices are rejected instead of being coerced. Public detail buttons,
section headings and saved/printed decision labels use the same pair.

Reviewed Oklahoma samples also use the exact pairs
`FOR THE PROPOSAL - YES` / `AGAINST THE PROPOSAL - NO` and
`FOR THE PROPOSITION - YES` / `AGAINST THE PROPOSITION - NO`.
These remain distinct; partial labels, reversed choices and mixing the two
subjects are rejected. This does not admit arbitrary binary-looking wording.

Reviewed Connecticut municipal samples additionally use the exact bilingual pairs
`Yes/Sí` / `No/No`, `Yes/Sí` / `No`, and `Yes - Si` / `No - No`. Their accents,
separators and complete pairings remain intact through preparation, decisions and
printing. This is not a general translation or a rule to discard Spanish labels.
Unreviewed translations and mixed pairs remain rejected.

An explicitly reviewed binary advisory question may use `decisionEffect:
"advisory"` with an explicit supported `ballotOptions` pair. It stays non-binding
in cards, detail pages, saved/printed plans and citation CSV. Unknown effects,
inferred advisory labels and non-binary choices remain rejected. Omitting this
optional field does not assert that another measure is binding. Advisory detail
pages do not emit legislation structured data. A mixed preparation appends a
`decisionEffect` CSV column; existing preparations without the field keep their
original byte format. The field never grants publication or import approval.

Reviewed Colorado compiled samples additionally use `YES/FOR` / `NO/AGAINST`
and `For the Measure` / `Against the Measure`. Their complete labels remain
intact in preparation, citations, saved choices and printing. Reversed pairs,
mixed short/long labels, altered separators and incorporation choices remain
rejected. A two-option question choosing between election methods is not
coerced into a binary proposal. Proposed municipalities and special districts
still require accepted exact geography rather than a countywide assignment.

If any prepared measure explicitly supplies `ballotOptions`, the citation CSV
adds trailing `yesLabel` and `noLabel` columns, including defaults for other rows.
All CSV fields remain quoted and formula-safe. Legacy preparations without
explicit options keep their original sixteen-column output byte format.

Diagnostics and source classification do not grant publication approval. Explicit
reviewer decisions, coverage promotion and public guide publication remain separate
gates. The runtime contract requires both new compiled modules but excludes the
prepared datasets themselves. No dependency or package manifest change is needed.

## Initial preparation verification

The maintained source/compiled commands reproduce the two North Dakota and three
Idaho native drafts, with eight pinned captures and eleven measure/source CSV rows.
Five explicit explanation mappings preserve the original claims. The unresolved
North Dakota wording and Idaho's non-binary advisory question remain review holds.

Verification preserves the primary guide, appends Idaho without changing an
existing North Dakota guide, rejects duplicate replacement and refuses promotion
of unknown metadata. Final outputs byte-match the API/browser-tested packet.
That initial verification recorded 941 unit passes/two optional PostgreSQL skips,
lint/types/builds, 21 built-app browser checks, 48 core accessibility cases,
50 actual-data rendering/accessibility cases and 15 native entries. Runtime
verification checked 104 compiled backend modules and deliberately missing tool
modules. These local results are not immutable release-artifact acceptance,
editorial approval or public activation.

Public measure payloads include an optional `electionSlug` derived from their
published parent election, alongside the parent date. Measure back-links and
breadcrumbs use that identity rather than another saved guide. Legacy responses
without it retain their existing fallback; unpublished records reveal neither
parent field. Stored measure records are not mutated by this projection.

Four Alabama native drafts were also prepared from four retained two-page Fair
Ballot Commission statements. Their JSON/CSV retains original capture hashes,
page citations, 29 research field rows and unknown publication dates. The current
school-merger thresholds, voluntary student participation and weekly first-stanza
scope remain explicit. Fiscal statements are attributed, not converted into
quantified zero-cost estimates.

All four Alabama drafts remain held pending review of the publisher's linked
policy. Amendment 1 additionally retains an unresolved vacancy-timing difference
between the ballot question and the Commission analysis. Preparation does not
resolve either hold, add Alabama to automatic collection, replace existing guides
or authorize publication. The offline assembler carries all five holds into its
review output while preserving the primary, North Dakota and Idaho guides.

## Lookup selection

When a location matches exactly one published local guide and one published
statewide guide for the same election date, lookup opens the statewide guide if
it has public ballot content and the local guide has only logistics. The original
local guide remains separately accessible and unchanged. The selected state
guide keeps its limited-local-coverage status and official-confirmation caveat.

Draft or suppressed content cannot win this selection. Different election dates,
two content-bearing guides, two logistics-only guides, multiple local areas or
multiple state guides stay unselected with their separate guide actions. This does not merge guides,
assign local questions statewide, change publication decisions or implement the
separate reviewed replacement/import flow.

Manual lookups with published, verified ballot content open that guide directly.
IP guesses, unresolved location choices and logistics-only results keep their
results/selection flow. A lookup cannot inherit a featured election summary with
a different slug. Saved choices and reloads must remain bound to the selected
guide; the state guide's local-coverage limitation remains visible.

Local guide matching uses exact, type-aware area names, including existing
capitalized jurisdiction types. Independent-city questions use county-equivalent
geography and an exact reviewed county-equivalent name, not a locality-name guess.
Meaningful words such as `City` remain part of the name: Baltimore City must not
match Baltimore County. Ordinary county questions match county geography; town
questions match locality geography. Substrings, unknown or conflicting geography
and a lone guide in the same state do not establish a local match. Partial local
guide limits remain present in lookup, overview, ballot and printed saved plans.

The same local-race exclusion is retained on statewide saved plans, including
their printed view, so completion counts do not imply a complete local ballot.

Competing guide actions carry their own published `guideContent`, election date
and name. The public lookup handler resolves those fields against the same
published package and election used by the guide endpoint; missing or withdrawn
packages are omitted. Unresolved competing elections remain unselected. Each choice opens
its own ballot content or logistics overview, rather than inheriting another
guide's status. Unresolved geographic choices must still be resolved first.

Guide choices are whole-row links showing the area, election name and date,
separate from official election tools. Same-title guides for different elections
remain distinct. Older actions without per-guide metadata are usable only when
their election and area exactly match the selected published guide. The guide
endpoint continues to enforce publication and content suppression on direct
loads and reloads; an old saved lookup is not an authorization to publish data.

## Statewide measures with local questions

The public view of a nonempty local guide can include a separately published,
measure-only statewide guide for the same state and exact election date. This
is response-only composition: stored guide identities, data, workflows and
approval decisions remain separate. Statewide routes never acquire county
questions. Unknown geography, other dates/states, local siblings, draft or hidden
content and statewide guides containing candidate races are not automatically
combined. Competing scopes without this supported relationship remain explicit.

The combined election includes computed `includedStatewideElectionSlugs` and
updated content counts. Stored copies of that response metadata do not grant
eligibility. Coverage limits continue to identify incomplete local coverage.

Inherited measure links add `?election=<local-election-slug>`. The public measure
endpoint validates that both the measure and requested ballot are published and
that the composed ballot actually contains that measure, then returns the
requested parent context without changing its geographic scope or citations.
Malformed or inapplicable contexts fail rather than borrowing a saved location.
Canonical links without a context retain the original statewide parent. Saved
plan links, reloads and print views use the same validated composition.

Long printed choices remain fully visible in stacked controls, with a short
operational navigation heading. They are not shortened into another ballot
response, made smaller, or hidden in a dropdown.

## Tennessee retained-ballot preparation

The same configurable preparer accepts Tennessee's three statewide amendment
drafts from one retained four-page county sample, without adding a state-specific
runtime adapter or granting retrieval rights. Amendments 1 and 2 cite reviewed
page 1; Amendment 3 cites reviewed page 2. The original October 21 capture and
unknown publication date remain unchanged. Source PDF metadata is not promoted
to a publication date.

The native output retains a linked-policy redirect hold and the existing
collector's conservative refusal of named AI/consecutive-agent robots groups.
Offline preparation does not remove those holds, enable a collector or confer
editorial approval. Draft workflows and unknown combined-coverage metadata remain
unpublishable through the normal acceptance flow. The three existing candidate
question references and candidate-record boundary holds are not rewritten.
