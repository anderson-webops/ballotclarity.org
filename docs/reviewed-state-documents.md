# Reviewed ballot document refreshes

`manage-election-documents collect-reviewed REVIEW.json COLLECTION.json` connects
the bounded document collector to an already reviewed external candidate snapshot.
It supports configured manual PDF/image sources and produces machine-readable
outcomes for recurring jobs without treating OCR as candidate authority.

The review contains exactly:

```json
{
  "schemaVersion": 1,
  "type": "reviewed-state-document-collection",
  "sourceId": "ok-woodward-2026",
  "reviewedAt": "CURRENT_ISO_TIMESTAMP",
  "snapshotPath": "/external/data/oklahoma-woodward-2026.json",
  "snapshotSha256": "SHA256_OF_REVIEWED_SNAPSHOT"
}
```

`COLLECTION.json` uses the existing election-document collection contract.
Every reviewed snapshot document must belong to exactly one selected collector
for the same state and election. Review freshness, publisher policy fingerprints,
robots restrictions, pacing, transport limits, cache integrity and expiry apply
before candidate verification. The original snapshot must remain unchanged
throughout collection.

## Outcomes

- `verified-unchanged`: every publisher document matches its reviewed byte hash.
  An external, byte-identical snapshot copy is available for the existing reviewed
  import process. Original IDs, records, scope and capture dates stay intact.
- `review-required`: complete collection found changed or unexpected document
  bytes. The report identifies affected URLs and hashes; it produces no candidate
  snapshot and preserves accepted facts. Cached repeats retain this outcome.
- `unavailable`: collection could not verify the complete publication set.
  Existing publisher holds and outage recovery apply. This is not an empty or
  successful candidate import.

Only the first outcome exits successfully. `lastPublisherCheckAt` records the
oldest actual document check from the cache, separately from `collectedAt` and
`originalRetrievedAt`. A cache read does not invent a fresh publisher request or
fact capture. The result itself is not an importable candidate snapshot.

The command performs no import, publication, scheduling or production changes.
Routine verified runs need no retranscription. New scanned editions require a
reviewed snapshot and matching hashes. New election/source catalogs and access
reviews remain necessary; this command does not discover future elections or
authorize image-to-candidate inference.

## Woodward acceptance

Normal current downloads of the county's three November 3, 2026 samples match the
original reviewed documents. All forty candidate/retention records therefore
remain exact. Both general samples have two pages and the city-only proposition
has one. All are scans without embedded text/fonts. Local OCR misreads names and
mixes ballot columns; it remains a private review aid, never normalized data.
Straight-ticket choices, Yes/No choices and the city proposition do not become
candidates. Judicial electorate and personal ballot applicability remain
unverified rather than inferred.

Official index: [Woodward County election publications](https://woodward.okcounties.org/departments/election-board/voting-elections-links).
