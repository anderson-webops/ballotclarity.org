# Repeatable Open States collection

The management CLI now accepts `collect-openstates PLAN.json` in source and
compiled builds. It downloads into an external cache, validates data, and runs
the existing reference preparer. It does not import into the active data store,
install a scheduler, change service configuration, or publish anything.

This extends the [service-data integration](2026-10-22-openstates-service-data.md),
not the list of nominees or the set of personally applicable ballots. The
[publisher's documented downloads](https://open.pluralpolicy.com/data/legislator-csv/)
remain the only CSV targets. URLs, credentials, redirects and mirrors cannot be
supplied in the collection plan.

## Plan contract

A version-1 `openstates-collection` plan has exactly these fields:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1` |
| `type` | `openstates-collection` |
| `sourceIds` | Explicit unique configured service-collection IDs |
| `cacheDirectory` | Absolute persistent path outside the application/release |
| `outputRoot` | Absolute external directory for unique preparation runs |
| `candidateFiles` | Absolute paths to reviewed candidate snapshots or normal source-bound storage envelopes |
| `allowedCandidateSourceIds` | Explicit reviewed official-source selection |
| `accessReview` | `reviewedAt` and `termsTextSha256` |

The review expires after 30 days. The fingerprint covers the publisher's Terms
of Service and Privacy Policy sections, including their links, but not unrelated
navigation or scripts. `openStatesPolicyFingerprint` computes the fingerprint
from a reviewed capture. It does not decide whether changed terms are acceptable.
An unreadable or changed policy stops collection for review before CSV requests.
These election-specific collections also stop after their configured election
window; later elections require explicit source/election configuration.

Normal stored candidate envelopes are accepted only when their exact source
fingerprint matches current configuration and the explicit source selection.
This lets a protected job consume updated existing candidate-cache files without
inventing a separate export script or reading unreviewed sources. Bare reviewed
snapshots remain supported.

## Download and storage behavior

- Successful captures and request attempts have a one-day minimum interval.
  Actual network requests are sequential with a one-second delay, a 15-second
  timeout, and a 2 MiB decoded per-state limit. Policy pages have a 256 KiB limit.
- Valid captures are immutable, content-addressed files. Metadata is written
  atomically, binds the exact source configuration, and is checked against the
  retained bytes before reuse. Linked content directories are rejected.
- Conditional requests use ETag or a valid Last-Modified value. HTTP 304 retains
  the original bytes, digest and capture date, advancing only the check date,
  consistent with [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5).
  A 304 without an existing validated conditional representation is held.
- Authentication failures, access denials, rate limits, redirects, policy changes
  and unexpected source formats create a persistent review hold. There are no
  automatic identity changes, challenges, mirrors, bypasses or hold-clearing.
- Temporary transport/HTTP failures leave accepted captures untouched. Healthy
  states can still be prepared; unavailable states are identified explicitly,
  not relabelled fresh or represented by empty replacement profiles. A single
  source's 404 does not suppress every other state.
- An exclusive ownership-checked lock prevents overlapping collectors. A changed
  owner is never overwritten or unlinked. A leftover lock requires inspection,
  not automatic deletion based on its age alone.

`seedOpenStatesCollection` supports reviewed existing captures without requesting
them again. It validates policy, source selection, schema and capture provenance,
then refuses to overwrite an existing cache or access hold. Raw downloads and
policy evidence stay external and are not code-release assets.

## Output and activation boundary

Each successful invocation creates a new output directory containing its exact
preparation plan, result metadata and prepared reference files. `complete` and
per-source observations distinguish a full capture set from partial availability.
`imported` remains false. Failed, unreviewed and missing sources do not overwrite
active reference collections. The existing separate importer remains the data
activation boundary; code publication, runtime acceptance and production-data
activation are distinct steps.

No new interface copy or frontend behavior is needed. Current candidates are
still matched exactly by state, name, chamber and district; serving officeholders
are not used to guess ballot qualification.

## Local verification

Source and compiled commands both consumed the reviewed 51-state cache without
publisher requests. Each produced 35 files byte-for-byte identical to the
accepted service-data preparation, including all 1,495 matches. Capture dates
were preserved. This is reuse of already collected evidence, not a claim of
additional profiles or a new publisher download.

The same checks also pass using all 50 normal source-fingerprinted candidate
cache envelopes, in both source and compiled modes. Tampered source fingerprints
are rejected before collection. Existing automatic candidate refreshes can feed
this preparation path without a new exporter or manual envelope editing.

Collector output was imported only into an isolated local fixture. Checks cover
all 51 reference API jurisdictions, all 50 retained official candidate sources,
all 94 populated reference collections, and 76 mobile/desktop rendered views.
The active local/production data stores were not imported into or reconfigured.

Lint, typecheck, 845 unit passes with two optional PostgreSQL skips, build,
21 integration tests, 48 core accessibility cases and 15 native-binding entries
pass. Network refresh, conditional-response, denied-access, timeout/transport,
schema/size, policy-change, ownership and partial-state paths use controlled
test responses. No production scheduler, private transfer, source publication
or deployment is part of this local milestone.
