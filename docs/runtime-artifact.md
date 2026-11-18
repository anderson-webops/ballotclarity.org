# Runtime artifact contract

Ballot Clarity's two compiled services are accepted as one immutable runtime tree. The tracked contract is `deploy/runtime-artifact-contract.json`; it names both entrypoints, all independently required runtime paths, and the writable state that must remain outside a release.

Current builds require Node 26.13.1 and the locked npm 12.2.2 build-only profile.
Use `npm run toolchain:prepare` to obtain its verified executable directory and
select that directory before installation. CI verifies the profile's exact lock
and payload digests; both digests accompany the runtime manifest and receipt.
Existing releases retain their original source-bound verifiers and requirements.
Qualification of a new runtime leaves previous artifacts and custody receipts intact.

The backend uses the native TypeScript 7 compiler. Vue's language service and
TypeScript ESLint retain the TypeScript 6 API required by their published peer
contracts. The frontend directly selects stable H3 2.0.8. Nuxt 4/Nitro 2 and
the listener retain their separately resolved H3 1 dependencies under the
parents' supported contracts. Built-app administration tests and unpacked runtime
guest-session, origin, bounded-body and cookie checks qualify these graphs
together. Parent dependency boundaries are reviewed when their upstream adopts
the successor API; a global override does not substitute for that migration.

The auto-import compiler is reproduced from its signed upstream 7.0.3 source
using the canonical template's qualified recipe. CI retains registry signature
checks for registry packages, independently verifies the local compiler archive,
and exercises it without source or development-dependency access.

After `npm run build`, run:

```bash
npm run verify:runtime-artifact
```

The verifier refuses a dirty source checkout, creates a detached temporary Git worktree at the exact source commit, performs a clean locked install and both production builds there, and packages only those newly built outputs. The manifest binds both the commit and Git tree identity to SHA-256 hashes for every runtime file. It then copies the artifact again to model unpacking and verifies the copied inventory. It also:

- rejects a deliberately removed backend runtime asset;
- rejects a compiled service entrypoint modified after the isolated build;
- starts the compiled Express and Nuxt entrypoints without access to the source checkout or development dependencies;
- checks the minimal `GET` and `HEAD` health/readiness contract and a rendered public page;
- uses only synthetic local fixtures and does not contact real providers;
- sends `SIGTERM` to both services and requires a clean bounded shutdown;
- verifies the artifact hashes again so runtime startup cannot mutate the release tree.

The clean build embeds the same public `{version, commit}` identity in the
frontend `/deployment.json` and backend `/api/release` responses. The two
identity files are required hashed artifact members, and acceptance checks both
responses without a checkout. Both responses use `no-store`.
The ARM64 release job also stops its disposable PostgreSQL 17 service after
opening idle connections, requires liveness with failed readiness, restarts
PostgreSQL, and verifies readiness recovery, authorization, unchanged synthetic
data/schema, graceful shutdown and retained-artifact restart.

The artifact never contains environment files, credentials, databases, logs, queues, live coverage state or public election bulk datasets. `STATE_BALLOT_DATA_DIR`, `ADMIN_DB_PATH`, `LIVE_COVERAGE_FILE`, and `BALLOTCLARITY_ZIP_LOOKUP_LOG_PATH` must resolve outside immutable releases and be preserved independently during both promotion and rollback. Production Postgres state likewise remains external.

All reviewed candidate sources need validated external imports before their data
can appear; code artifacts do not bootstrap them. Automatic sources download only
through their reviewed adapters. The copier removes obsolete generated candidate
bundles, and independent build/artifact inspection rejects their reintroduction.
The external-storage migration preserves source fingerprints and cache envelopes;
it does not authorize changing host paths, importing test fixtures or weakening
activation checks. See `state-ballot-sources.md` for data commands and provenance.

This contract does not prescribe server paths, ports, users, reverse-proxy settings, or deployment topology. The existing direct Node and Nginx topology remains authoritative, and the local Compose stack remains development-only.

## Off-server release preparation

The tag-triggered CI workflow builds the same contract on Linux ARM64, exercises the exact unpacked artifact and both compiled services, then publishes the verified archive, `runtime-manifest.json`, `acceptance-receipt.json`, `SHA256SUMS`, and a GitHub Actions attestation bundle as one immutable release. It accepts only an annotated `vX.Y.Z` tag whose commit belongs to `main`; all CI jobs must pass before the draft release becomes public. The runtime archive is not rebuilt after acceptance or replaced to retry a failure.

This GitHub-attested path is an alternative to a Mac-signed builder for this repository. It does not change the production adapter by itself. The protected server operator must verify the exact tag, archive checksum, attestation, complete runtime inventory, source contract, native Linux ARM64 identity, configuration and retained-runtime rollback compatibility before opting into artifact-only promotion. The server must preserve its existing environment, Nginx/systemd policy, database and external writable state, and must not silently fall back to compilation if an archive or host capability is missing. No source agent connects to or deploys on the server.
