# Configured Open States profile collection

This source milestone connects the existing exact-match state CSV collector to
the reviewed People archive and member-attributed profile preparation. It does
not install a scheduler, import active data, expand candidate qualification or
claim a deployed runtime. The independent Louisiana/security release candidate
is unchanged.

## Source and access review

The public GitHub API identified `openstates/people`, its `main` branch and commit
`5aad164685d03e48fdc221390817f27d2d7516b7` during this review. This matches the
retained October22 archive; no duplicate live archive download was necessary.
[GitHub's repository archive contract](https://docs.github.com/en/rest/repos/contents#download-a-repository-archive-tar)
documents the archive redirect and unauthenticated access to public resources.
The [API terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms)
require respecting usage limits. The collection is low-frequency, credential-free
and has no token rotation, identity change or publisher-denial workaround.

Only the explicit302 from the commit-pinned repository archive API to the exact
same commit's `codeload.github.com/openstates/people/legacy.tar.gz/COMMIT` is
accepted. Arbitrary hosts, paths, queries and subsequent redirects are rejected.
No original state publisher, biography URL or denied source is fetched through
this independent dataset.

## Maintained command contract

`collect-openstates-profiles PLAN.json` is supported by the existing source and
compiled election-reference management entrypoint. Its version1 plan has exactly:

- `schemaVersion: 1`, `type: "openstates-profile-collection"`.
- `collection`: the existing strict `openstates-collection` plan, including its
  explicit candidate-source selection, permitted CSV sources, reviewed terms,
  external directories and candidate input files.
- `archiveCacheDirectory`: an absolute external archive cache, separate from the
  state CSV cache.
- `accessReview`: `reviewedAt`, `collectionPolicySha256` and `readmeSha256`.
  The first must be current within30days. The policy digest binds the maintained
  repository/API/refresh contract, not a claim of continuous live terms monitoring.
  The README digest binds the exact independently reviewed dedication. Neither
  digest is automatically updated when publisher terms or dedication change.

The command composes CSV collection, source-fingerprint-checked manifest reads,
commit discovery, bounded archive collection and existing strict profile
enrichment. It returns a unique prepared directory and a structured result.
There is no active-store import. Incomplete source/member coverage is explicit
and causes an unsuccessful CLI exit; partial output is not an accepted update.

GitHub commit checks are at most daily, with conditional requests and daily
failure cooldowns. A304 or unchanged commit advances only `checkedAt`; it never
relabels archive capture time, source bytes or member capture dates. Archive
bodies are immutable and content-addressed outside Git. The32MiB compressed,
128MiB expanded,50,000-member and selected-member bounds remain in force.

The collection retains last accepted cache metadata after transient failures.
Denials, rate limits, unexpected redirects, invalid repository identity, format
changes and a different dedication create a persistent review hold. Integrity
errors in an existing cache fail locally rather than trigger a replacement fetch.
Ownership locks prevent overlapping writers without assuming an old lock means
the process stopped. An access hold is never automatically cleared.

Preparation now evaluates role eligibility at preparation time, separately from
body capture time. This prevents an unchanged cached archive from retaining a
role after its recorded end date. Missing or conflicting members remain holds;
historical roles, missing statements and absent professional fields are not
invented. Candidate IDs, source configuration fingerprints and public provenance
contracts are unchanged.

## Local evidence

The focused collector/enrichment/legacy-collection suite passes64tests, including
daily caching, exact redirect binding, malformed/oversized bodies, source denial,
transient failure, immutable prior bodies, missing validators, ownership locks,
corrupt/symlinked caches, review expiry, partial CLI failure and ended cached roles.

The source CLI replay uses51retained CSV captures,50native candidate caches and
the retained pinned archive, with network requests disabled. It prepares the same
32state/1,495profile cohort and1,589additional facts. All35prepared files match
the accepted canonical bytes; original capture dates remain unchanged. No new
coverage count, new candidate certification or fresh publisher capture is claimed.
The compiled CLI produces the same35files with the same disabled-network
guarantee. Full lint/typecheck/build,887unitpasses/twooptionalPostgreSQLskips,
21integrated browser checks,48core accessibility cases and15native-binding checks
pass. The99-module backend build is complete. Connected verification imports the
actual collections into isolated storage and checks every member citation through
the API, then76light/desktop and dark/mobile renders with no axeA/AA findings,
overflow or browser errors. Three representative detail images were visually
reviewed. The existing deployment/provenance gates are not relaxed.

The connected candidate-data check uses the retained archive's historical fixture
clock and preserves all50captures/25,031records. It is not current candidate
recertification; production TTL, clocks, source settings and publisher access
remain unchanged. All owned runtime resources are stopped/removed. The prior
507canonical files and private data packets are unchanged; no duplicate public
data payload or new coverage total is introduced.
