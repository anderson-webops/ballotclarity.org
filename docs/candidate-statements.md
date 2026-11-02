# Reviewed candidate statements

Official candidate details use `GET /api/state-records/:state/:id?source=SOURCE`.
The 24-character record ID resolves without a name hint or directory pagination.
The response contains the official record, its original source metadata and
separate `references`. Matching requires the same state, election, exact name,
office scope and district. Local records require an exact office and either
matching explicit jurisdictions or a reviewed exact official record binding when
both jurisdiction labels are absent. Ambiguous identities and different elections do not attach.
Reference storage failures preserve the official record and return a separate
`referencesUnavailable` flag. Existing record throttling and no-store apply.

Candidate pages combine substantive stored reference facts with available person
profiles. Provider matching metadata is omitted. Source attribution remains
attached to each fact group. Search suppresses a reference-only result only when
the displayed official result already exposes that exact matched background;
fact-only and different-seat results remain reachable.

## Offline preparation

`manage-election-references prepare-statements REVIEW.json` prepares a standard
reference snapshot without network requests or import. The review contains:

- `schemaVersion: 1`, `type: "candidate-statement-preparation"`, a configured
  candidate-statement `sourceId` and a current `reviewedAt`.
- Absolute `candidateFiles` pointing to validated official snapshots from the
  same state and election.
- `documents` in configured order, each with exact `url`, absolute `path`, raw
  `sha256`, original `capturedAt` and reviewed `contentSha256`. An optional exact
  `regionClass` or `regionId` identifies one reviewed content region when the
  page has no main. These selectors are mutually exclusive.
- `claims`, each with `officialSourceId`, `recordId`, `documentIndex` and one to
  six short, attributed, reviewed factual paraphrases.
- An absolute, physical, external `outputDirectory` that does not already exist.

`candidateStatementContentSha256` computes the meaningful content hash from the
main or exact reviewed region. Scripts, styles and forms are excluded; meaningful
text and link changes remain review triggers. Preparation preserves official
identity and office context. It adds no qualification, party or incumbency claim.

## Repeat collection

`manage-election-references collect-statements REVIEW.json COLLECTION.json`
combines that frozen content review with the existing bounded document collector.
`COLLECTION.json` uses the election-document collection contract, selects exactly
the relevant configured publishers, and includes current explicit access reviews.
It retains the approved facts and meaningful-content hashes while updating raw
capture hashes and dates. The new output is a separate preparation, never a live
import or publication.

Existing publisher rules, policy/link fingerprints, TLS checks, daily cache,
conditional requests, per-host spacing, backoff, election expiry and storage
locks continue to apply. A changed meaningful biography or identity creates a
durable review-specific hold; subsequent invocations stop before publisher
requests. A new review retains the prior hold and accepted output as evidence.
Transport and policy failures retain the collector's existing failure controls.

The Georgia governor collection is opt-in and candidate-provided. Its two
campaign sources use normal public HTML and reviewed policies. Rick Jackson's
robots layout explicitly permits two wildcard groups and a numeric preamble
crawl delay while preserving their combined restrictions. This exception is
scoped to that configured publisher; all other sources retain strict defaults.

Future cycles need configured official candidate identity, offered publication
URLs and current publisher/content reviews. This pipeline automates unchanged
approved content, not editorial judgments, future nominees or new reuse rights.

## Independent collections

Eleven additional Georgia statewide candidates have separate opt-in publication
definitions. A held publisher leaves the other candidates' accepted content
available. These campaign statements remain distinct from official ballot
qualification and current-office records.

`manage-election-references collect-statement-batch BATCH.json` processes up to 25
independent reviews. The exact contract is `schemaVersion: 1`,
`type: "candidate-statement-collection-batch"` and `entries`, each containing a
distinct configured `sourceId` plus absolute `reviewPath` and `collectionPath`.
Every collection shares one external cache and output root, preserving host
spacing, storage locks and evidence. Configuration errors stop before requests;
individual review or publisher holds are reported without blocking other entries.
The command exits unsuccessfully if any entry is held and performs no import or
publication.

Some reviewed publishers list several named robots agents followed by a wildcard
that shares the same directives. `robotsLayout.sharedWildcardAgents` supports only
that exact ordered, consecutive header block. Every restriction remains in force.
A separate agent group, changed header or unsupported directive still requires
review. This setting never changes the request identity or overrides a denial.

## Local candidate identity

New local preparations retain `officialCandidate: { sourceId, recordId }` from
the validated official input. This internal binding allows an exact association
when an official publisher omits a separate jurisdiction label. It never creates
a jurisdiction or personal ballot match. Name, office, scope, election, source
and district checks still apply; conflicting known jurisdictions and duplicate
official identities remain held. Unbound references still require explicit
matching jurisdictions.

The field is bounded and accepted only for local candidate-statement records.
Public reference responses omit it. Legacy snapshots remain readable unchanged;
new bound local snapshots require a compatible reader before import/publication.
Five Fulton campaign collections use this association without changing any
official candidate fields or source capture dates.
# Official filing context

`manage-election-references prepare-fulton-filings REVIEW.json` prepares an optional
`ga-fulton-filing-context-2026` reference snapshot from the two reviewed county PDFs
and an existing official candidate snapshot. `collect-fulton-filings REVIEW.json
COLLECTION.json` refreshes those PDFs through the existing bounded document
collector before preparation. Configure maintained Poppler with
`STATE_BALLOT_PDFTOTEXT` only in the collection worker.

The review has `schemaVersion: 1`, `type: "fulton-filing-context-preparation"`,
`reviewedAt`, an absolute `candidateFile`, `documents`, `bindings` and an external
`outputDirectory`. Each document contains its configured `url`, absolute `path`,
original-byte `sha256` and `capturedAt`. Each binding contains `documentIndex`, the
exact filing `name` and official `recordId`. Every published row must be reviewed.
Only reported occupations become dated facts. Party, incumbency, qualification,
addresses and contact information are not imported from filing context.

Review freshness, exact candidates/offices, complete documents, bounded extraction,
changed-format holds and retained output apply independently of publication.
Future elections require newly offered URLs and reviewed candidate associations;
the parser's explicit date parameter does not enroll future sources automatically.

## Official biographies

`manage-election-references prepare-official-biographies REVIEW.json` and
`collect-official-biographies REVIEW.json COLLECTION.json` reuse the reviewed
context pipeline for explicitly enrolled official-biography collections.
The review uses `type: "official-biography-preparation"`; its remaining fields
match candidate-statement reviews. Output retains `official-biography` attribution,
not campaign attribution. The collection must explicitly permit exact official
candidate bindings. Ordinary biography catalogs and campaign sources cannot be
reclassified by changing a review label.

The existing candidate-statement command, review, output and durable-hold formats
are preserved. Both modes retain original captures, enforce meaningful-content
hashes and exact current candidate identities, and hold changed content for review.
They prepare independent external snapshots, with import, publication and recurring
activation remaining separate. New cycles require newly reviewed source identity,
content, access policy and candidate associations.

Reviewed single-page HTML publications may opt into `indexIsDocument: true` with
explicit one-document bounds and the exact publisher URL. The document remains
subject to both index and document markers, link-policy fingerprints, publisher
policies and meaningful-content review. This mode requests neither discovery
links nor related articles, and remains off for existing sources.

A single PDF may use the same exact singleton configuration with empty HTML
`dateMarkers`. Its access review uses `indexPdf`, the SHA-256 of the original
PDF, instead of `indexLinks`. MIME type, PDF signature, publisher policies and
all existing transport bounds remain enforced. Changed PDF bytes hold collection
before they can replace accepted evidence.

An official reference document can declare `pdfMaximumPages` from 1 to 25.
The preparation review retains its original-byte hash and `contentSha256`,
computed by `candidatePdfContentSha256` from bounded Poppler layout text.
This fingerprint preserves page boundaries. PDF documents omit HTML region
selectors. The existing official-biography commands use the maintained
`STATE_BALLOT_PDFTOTEXT` worker; public readers require no native tool or
publisher request. Facts and exact candidate associations still require review.

Publishers with separately grouped crawler restrictions can use an explicit
`robotsLayout.restrictiveGroups` review. The worker intersects all applicable
groups with the wildcard rules, uses the maximum reviewed crawl delay and holds
changed layouts or policies. Only five recognized unrelated crawler identities
may be excluded from path matching; their syntax and delays are still validated.
AI, wildcard and unknown identities cannot be excluded. Existing sources keep
their original layout behavior unless explicitly enrolled.
