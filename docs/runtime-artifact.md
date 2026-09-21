# Runtime artifact contract

Ballot Clarity's two compiled services are accepted as one immutable runtime tree. The tracked contract is `deploy/runtime-artifact-contract.json`; it names both entrypoints, all independently required runtime paths, and the writable state that must remain outside a release.

After `npm run build`, run:

```bash
npm run verify:runtime-artifact
```

The verifier builds the artifact in a clean temporary directory, installs only the backend's locked production dependencies, writes SHA-256 hashes for every file, copies the artifact again to model unpacking, and verifies the copied inventory. It then:

- rejects a deliberately removed backend runtime asset;
- starts the compiled Express and Nuxt entrypoints without access to the source checkout or development dependencies;
- checks the minimal `GET` and `HEAD` health/readiness contract and a rendered public page;
- uses only synthetic local fixtures and does not contact real providers;
- sends `SIGTERM` to both services and requires a clean bounded shutdown;
- verifies the artifact hashes again so runtime startup cannot mutate the release tree.

The artifact never contains environment files, credentials, databases, logs, queues, or live coverage state. `ADMIN_DB_PATH`, `LIVE_COVERAGE_FILE`, and `BALLOTCLARITY_ZIP_LOOKUP_LOG_PATH` must resolve outside immutable releases and be preserved independently during both promotion and rollback. Production Postgres state likewise remains external.

This contract does not prescribe server paths, ports, users, reverse-proxy settings, or deployment topology. The existing direct Node and Nginx topology remains authoritative, and the local Compose stack remains development-only.
