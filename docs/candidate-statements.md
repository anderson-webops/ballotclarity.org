# Reviewed candidate statements

Official candidate details use `GET /api/state-records/:state/:id?source=SOURCE`.
The 24-character record ID resolves without a name hint or directory pagination.
The response contains the official record, its original source metadata and
separate `references`. Matching requires the same state, election, exact name,
office scope and district. Local records also require an exact office and
jurisdiction. Ambiguous identities and different elections do not attach.
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
  `regionClass` identifies a reviewed content region when the page has no main.
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
