# Official document collection review

Date: October 23, 2026. Status: locally validated source, not published or scheduled.

## Source contract

The new `manage-election-documents` CLI supports `catalog`, `seed` and `collect`.
Its catalog binds each permitted index, policy document, publisher host, election
date, date marker and PDF path family. Plans select catalog IDs, separate absolute
cache/output directories outside the application checkout or release, and explicit
current access reviews. No credentials, arbitrary request headers or unpublished
URLs come from a plan.

The first eligible source is North Dakota's November 3, 2026 statewide measure
index. It currently links seven in-scope PDFs: two ballot descriptions, two
analyses, the referred resolution, the initiated measure text and its fiscal
impact statement. This is the configured document family, not a completeness
claim about all state or local ballots.

Official index: [North Dakota statewide ballot measures](https://www.sos.nd.gov/elections/voter/ballot-measures/measures-ballot).
Reviewed site policies: [Disclaimer](https://www.sos.nd.gov/disclaimer),
[Privacy](https://www.sos.nd.gov/privacy-policy),
[Security](https://www.sos.nd.gov/security-policy) and
[robots rules](https://www.sos.nd.gov/robots.txt).
These observations permit this bounded raw-source collection review; they do not
establish an open republication license or approve extracted editorial content.

## Storage and collection behavior

- Original binary bytes are kept under content-addressed SHA256 names, outside
  source/runtime releases. Capture metadata binds the configured source and URL.
- Existing data can be seeded only from explicitly supplied, hash-verified local
  captures with their original timestamps. Seeding refuses existing caches/holds.
- A 24-hour cache and conditional ETag requests avoid repeated full downloads.
  An unchanged response does not acquire a new original capture date.
- New PDFs are discovered only within the reviewed link families and current
  election index. No alternative publisher, mirror, arbitrary crawl or automatic
  cycle rollover is attempted.
- Public HTTPS resolution is pinned, TLS is verified, redirects are not followed,
  PDF bodies are bounded to 12 MiB, HTML to 2 MiB, and document/node counts are
  bounded. Binary transport does not require PDF bytes to be valid UTF-8.
- Publisher policy/link/footer changes, robots exclusions, access denials,
  redirects, invalid PDF content, TLS/size violations and cache-integrity failures
  persist a hold. Temporary failures retain last-good bytes and use cooldowns.
- Exclusive owner-bound locks prevent overlapping runs. Linked cache subfolders
  and linked/nonregular capture inputs are refused.
- Collection receipts explicitly mark material unreviewed, unimported and
  unpublished. The CLI is not an ingestion, certification or scheduling service.

The shared bounded storage reader now exposes a byte-preserving form while
preserving the existing text-reader contract. Its external-directory check also
rejects in-checkout names beginning with two dots rather than mistaking those
names for parent-directory traversal.

## Findings during validation

The first real collection reused ten existing policy/index/PDF captures and made
only two new requests for the official North Dakota analyses. Both succeeded with
valid PDF bytes and retained ETags. The first request-start interval was 10,992 ms,
eight milliseconds below the intended minimum. Validation caught this rather than
claiming that check passed. The collector now records completion as well as
attempt time and spaces subsequent attempts from completion. A regression test
models differing DNS/body latency; source/compiled cache replays after the fix
made zero additional publisher requests. No repeat download was used to mask the
initial observation.

Alabama was excluded from the maintained automatic catalog after inspection found
its official footer's **Statements & Policies** link pointing to the legacy
external HTTP address `http://isd.alabama.gov/isd/statements.aspx`. The linked
policy was not retrievable with the current research tool. This is an unverified
policy, not a confirmed publisher denial or a claim that collection is forbidden.
Previously retained Alabama captures and research remain unchanged. This finding
qualifies the earlier review's assumption that no relevant policy link was present.

The pending source-release candidate remains separate. Current registry metadata
still advertised the `unimport@7.0.2` attestation endpoint, which returned 404.
No signature/provenance gate, publisher hold or protected release check was relaxed.

## Local verification

- Lint, frontend/backend types, frontend build and 102-module backend build pass.
- 911 unit tests pass; two optional PostgreSQL cases skip.
- 23 focused document/transport/runtime-exclusion tests pass, including missing
  collector modules, recently seeded captures and early timer wakeups.
- 21 built-application browser tests and 48 core accessibility cases pass.
- All 50 retained native candidate captures preserve 25,031 exact stored rows.
  The 95 reference collections preserve 2,040 profiles and 4,235 facts; all public
  reference records were checked through local APIs across 50 states and DC.
- Sixteen additional actual-data directory/profile renders pass accessibility and
  overflow checks at 320px dark and 1280px light. Two screenshots were inspected.
- Fifteen required native runtime entries pass their checks.
- Source and compiled collector replays preserve all 12 policy/index/PDF capture
  hashes and dates. Four source/compiled importer attempts reject raw collection
  output without changing the accepted candidate/reference caches.

Retained candidate snapshots use an explicitly historical test clock only to
verify wiring. This does not recertify their current election accuracy or change
production TTL/clock rules. No new website copy, navigation, disclosure control or
published measure content is added. Existing concise labels and necessary source,
freshness and ballot-limit disclosures remain unchanged.

The new CLI and its modules are independently required by the runtime build and
artifact contract. Local builds are not acceptance of a clean, immutable release
artifact. No source commit/push/tag/release, production action, private transfer,
active import, host scheduler, permission or saved-configuration change occurred.
