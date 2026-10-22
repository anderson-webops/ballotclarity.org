# Runtime artifact contract

Ballot Clarity's two compiled services are accepted as one immutable runtime tree. The tracked contract is `deploy/runtime-artifact-contract.json`; it names both entrypoints, all independently required runtime paths, and the writable state that must remain outside a release.

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
