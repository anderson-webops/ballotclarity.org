# Ballot Clarity

Ballot Clarity is a nonpartisan civic-information platform built as an npm workspace monorepo. Fulton County, Georgia is the first real production launch jurisdiction, while the existing public ballot and dossier surfaces remain available as a reference archive until live county integrations and verified contest packaging are ready.

## Workspace layout

- `front-end/`: Nuxt 4 application based on the `antfu/vitesse-nuxt` stack and conventions
- `front-end/src/`: public pages, admin pages, layouts, components, composables, stores, and shared front-end types
- `front-end/public/source-files/`: reference source files that power the public source directory and evidence links
- `back-end/`: Express API for ballot content, public search, source records, and admin operations
- `back-end/src/coverage-data.ts`: seeded Ballot Clarity coverage data that can later be replaced with live providers or database reads
- `back-end/src/coverage-repository.ts`: runtime coverage loader that falls back to seeds or reads an imported live snapshot file
- `back-end/src/import-live-coverage.ts`: operator CLI that imports a vetted coverage snapshot from a file or URL
- `back-end/live-data-schema.sql`: draft Postgres schema scaffold for the future live-data read model
- `back-end/src/admin-store.ts`: SQLite-backed fallback admin persistence for users, content review, source monitoring, corrections, and activity
- `back-end/src/postgres-admin-store.ts`: Postgres-backed admin persistence for multi-instance production deployments
- `back-end/src/launch-profile.ts`: Fulton County, Georgia launch profile, official source links, and coverage-state metadata
- `back-end/admin-schema.sql`: schema for persisted admin and operations data
- `back-end/admin-schema.postgres.sql`: schema for Postgres-backed admin persistence
- `back-end/dist/admin-schema.sql` and `back-end/dist/admin-schema.postgres.sql`: runtime copies emitted during `npm run build` so compiled deployments can initialize the configured admin store
- `docs/fulton-county-ga-launch.md`: chosen official systems, provider stack, and manual provisioning inputs for the first real jurisdiction

## Install and run

Install dependencies from the repo root:

```bash
npm install
```

Copy the environment template:

```bash
npm run env:local
```

Bring up the local service stack:

```bash
npm run stack:up
```

This starts:

- local Postgres on `127.0.0.1:5432`
- local MinIO object storage on `127.0.0.1:9000`
- local MinIO console on `127.0.0.1:9001`

Write a local coverage snapshot so the API can run in snapshot mode instead of raw in-memory seed mode:

```bash
npm run coverage:seed-local
```

Bootstrap the first admin user before using `/admin`:

```bash
npm run bootstrap-admin
```

Run the API in one terminal:

```bash
npm run server
```

Run the Nuxt front-end in another terminal:

```bash
npm run dev
```

The front-end runs at `http://127.0.0.1:3333` and expects the API at `http://127.0.0.1:3001/api` by default.

For local Google Civic testing:

1. Open the generated `.env`
2. Paste your `GOOGLE_CIVIC_API_KEY`
3. Restart the backend
4. Submit a full street address in the lookup form

When the key is configured, Ballot Clarity will call Google Civic server-side for full-address verification and show any official links returned by the provider before continuing into the ballot guide. ZIP-only input remains approximate by design.

## Environment configuration

Public runtime variables:

- `NUXT_PUBLIC_SITE_URL`: canonical public origin used for metadata, schema, and canonical URLs
- `NUXT_PUBLIC_API_BASE`: public API base used by the front-end for ballot, search, sources, and content reads

Local infrastructure variables:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`: values used by the local Docker Postgres service and the derived `ADMIN_DATABASE_URL`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`: values used by the local MinIO service and bucket bootstrap

Server-only variables:

- `ADMIN_API_BASE`: server-side Nuxt proxy target for admin-only API requests; this should be private to the Nuxt server and never exposed as the browser's direct `/api/admin/*` target
- `ADMIN_API_KEY`: shared secret between the Nuxt admin proxy and the Express admin endpoints
- `ADMIN_SESSION_SECRET`: cookie-signing secret for Nuxt admin sessions
- `ADMIN_STORE_DRIVER`: `postgres` for production, or `sqlite` only as a fallback for single-instance local/dev use; when omitted, the backend will auto-select Postgres if `ADMIN_DATABASE_URL` or `DATABASE_URL` is present
- `ADMIN_DB_PATH`: SQLite database path for fallback persisted admin users and editorial operations data
- `ADMIN_DATABASE_URL`: Postgres connection string for the admin and editorial operations store
- `SOURCE_ASSET_BASE_URL`: optional public object-storage or CDN base URL for mirrored source files
- `LIVE_COVERAGE_FILE`: path to the imported coverage snapshot consumed by the public API
- `LIVE_COVERAGE_REQUIRED`: when `true`, fail startup if `LIVE_COVERAGE_FILE` is missing
- `TRUST_PROXY`: set to `true` when Express is behind a reverse proxy so request IP and forwarded headers are trusted
- `LOG_LEVEL`: structured backend log level, such as `info`, `warn`, or `error`
- `ADMIN_LOGIN_WINDOW_MS`, `ADMIN_LOGIN_MAX_ATTEMPTS`, `ADMIN_LOGIN_LOCKOUT_MS`: admin login-throttle controls for the backend auth endpoint

One-time bootstrap variables:

- `ADMIN_BOOTSTRAP_USERNAME`: username used by `npm run bootstrap-admin`
- `ADMIN_BOOTSTRAP_PASSWORD`: password used by `npm run bootstrap-admin`
- `ADMIN_BOOTSTRAP_DISPLAY_NAME`: display label for the initial admin user
- `ADMIN_BOOTSTRAP_ROLE`: initial role, usually `admin`

Runtime variable:

- `PORT`: Express API port

One-time or scheduled ingestion variables:

- `LIVE_COVERAGE_SOURCE_FILE`: local JSON file path consumed by `npm run ingest:coverage`
- `LIVE_COVERAGE_SOURCE_URL`: remote JSON URL consumed by `npm run ingest:coverage`

For production, use unique random values for `ADMIN_API_KEY`, `ADMIN_BOOTSTRAP_PASSWORD`, and `ADMIN_SESSION_SECRET`. The front-end and back-end must share the same `ADMIN_API_KEY`. Keep every `ADMIN_*` variable in the server environment only.
The public browser should call `/api/admin/*` on the Nuxt origin only. Those requests must terminate at the Nuxt server so the session cookie and server-held `ADMIN_API_KEY` stay inside the bridge layer.

## Useful npm commands

```bash
npm run dev
npm run server
npm run db:up
npm run env:local
npm run stack:up
npm run coverage:seed-local
npm run bootstrap-admin
npm run ingest:coverage -- --from-file ./ops/live-coverage.json
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run serve
npm run preview
```

## Public product structure

Canonical public discovery pages:

- `/`: homepage and address lookup entry
- `/about`
- `/help`
- `/coverage`
- `/status`
- `/corrections`
- `/methodology`
- `/neutrality`
- `/data-sources`
- `/accessibility`
- `/privacy`
- `/terms`
- `/contact`
- `/locations/:slug`
- `/elections/:slug`
- `/contest/:slug`
- `/candidate/:slug`
- `/measure/:slug`
- `/sources`
- `/sources/:id`

Public guide and utility pages:

- `/ballot/:slug`: printable ballot guide and contest-reading surface
- `/search`: full-site search across elections, candidates, measures, and source records
- `/compare`: side-by-side comparison surface
- `/plan`: saved ballot plan and print checklist

These guide and utility pages are public, but they are treated as app-like surfaces rather than canonical discovery pages. They are not included in the sitemap, and the Nuxt app marks them `noindex`.

Experimental public routes:

- None are shipped as standalone public routes in the current release.
- Future-analysis modules may appear inside public pages when clearly labeled, but unfinished features should not be exposed as top-level navigation targets.

## Admin and editorial operations

Internal operations routes:

- `/admin/login`
- `/admin`
- `/admin/review`
- `/admin/content`
- `/admin/corrections`
- `/admin/sources`
- `/admin/users`

How the admin model works:

- Admin and editor accounts are persisted in the configured operational database, not hardcoded deployment credentials.
- The browser authenticates against Nuxt server routes, which issue a same-origin session cookie.
- Nuxt proxies protected admin requests to the Express API using `ADMIN_API_KEY`, so the backend key never reaches the browser.
- Browser traffic for `/api/admin/*` is expected to terminate at Nuxt. The Express admin endpoints are internal API surfaces behind `ADMIN_API_BASE`, not public browser routes.
- Admin data includes content publish state, persisted public-summary overrides, correction intake, source-health monitoring, activity logs, and user management.

## API surface

Public API endpoints:

- `POST /api/location`
- `GET /api/elections`
- `GET /api/jurisdictions`
- `GET /api/jurisdictions/:slug`
- `GET /api/ballot`
- `GET /api/coverage`
- `GET /api/status`
- `GET /api/corrections`
- `GET /api/contests/:slug`
- `GET /api/candidates/:slug`
- `GET /api/measures/:slug`
- `GET /api/compare`
- `GET /api/search`
- `GET /api/sources`
- `GET /api/sources/:id`
- `POST /api/feedback`
- `GET /api/data-sources`

Protected admin API endpoints:

These endpoints live on the Express service, but they are intended to be reached by the Nuxt admin bridge, not by the public browser directly.

- `POST /api/admin/auth/login`
- `GET /api/admin/overview`
- `GET /api/admin/review`
- `GET /api/admin/content`
- `PATCH /api/admin/content/:id`
- `GET /api/admin/corrections`
- `PATCH /api/admin/corrections/:id`
- `GET /api/admin/sources`
- `PATCH /api/admin/sources/:id`
- `GET /api/admin/users`
- `POST /api/admin/users`

## Architecture choices

- Front-end stack: Nuxt 4, Vite, TypeScript, UnoCSS, Pinia, file-based routing, layouts, composables, and `<script setup>`
- Back-end stack: Express plus a Postgres-first operations layer with a SQLite fallback
- Back-end persistence: Postgres for production and multi-instance deployments, with SQLite available only as a fallback for constrained local/dev setups
- State model: public civic state lives in `front-end/src/stores/civic.ts`, including selected location, election context, compare list, and saved ballot plan
- Content flow: public pages consume the Express API instead of embedding content directly in page files
- Search and sourcing: every major reading surface links to the source directory and source detail pages
- Trust layer: freshness, methodology, corrections, neutrality, and source authority are modeled explicitly in the data layer and rendered in the UI
- Admin model: persisted users, content status, correction queue, and source-health tracking all live behind a protected internal surface
- Coverage runtime: the public API serves the seed dataset by default, but can switch to an imported live snapshot file without changing route contracts
- Launch strategy: Fulton County, Georgia is the first real production jurisdiction, and the public site now exposes explicit coverage, status, corrections, and contest-level canonical pages around that rollout
- Asset delivery: mirrored source-document URLs can be rewritten to object storage or a CDN via `SOURCE_ASSET_BASE_URL`
- Observability: the backend emits structured request logs, health metadata, and admin-auth throttle events
- Production roadmap: see `docs/production-readiness-roadmap.md` for the staged path from seeded coverage to a real operated civic-information service
- Live-data sequence: see `docs/live-data-implementation-sequence.md` for the concrete schema, env, provider, and rollout order for replacing seeded coverage with real civic data
- Launch brief: see `docs/fulton-county-ga-launch.md` for the selected official systems and provider stack

## Production mode

- Set `NUXT_PUBLIC_SITE_URL` to the final public origin so metadata, schema, and canonical URLs match the deployed domain.
- Set `NUXT_PUBLIC_API_BASE` to the public API origin used by the browser.
- Set `ADMIN_API_BASE` to the server-side admin API origin the Nuxt server can reach privately.
- Set `ADMIN_API_KEY` and `ADMIN_SESSION_SECRET` in the server environments only.
- Use `ADMIN_STORE_DRIVER=postgres` together with `ADMIN_DATABASE_URL` for production. SQLite should only be used as a fallback for constrained local or temporary environments.
- Set `SOURCE_ASSET_BASE_URL` when mirrored source documents should resolve to object storage or a CDN instead of files bundled under `front-end/public/source-files/`.
- Import a vetted snapshot with `npm run ingest:coverage` and set `LIVE_COVERAGE_REQUIRED=true` once production should refuse to start without current snapshot data.
- Run `npm run bootstrap-admin` once on the server, then remove the bootstrap password from routine shell history and secrets tooling if a different operational process is preferred.
- Keep the public reverse proxy pointed at Nuxt for `/api/admin/*`; do not route those browser requests straight to the Express backend.

## Local operator runbook

1. `npm run env:local`
2. Fill `GOOGLE_CIVIC_API_KEY` in `.env` if you want live address verification.
3. `npm run stack:up`
4. `npm run coverage:seed-local`
5. `npm run bootstrap-admin`
6. `npm run server`
7. `npm run dev`

Useful local URLs:

- public site: `http://127.0.0.1:3333`
- API health: `http://127.0.0.1:3001/health`
- local source-file bucket: `http://127.0.0.1:9000/source-files`
- MinIO console: `http://127.0.0.1:9001`

Local stack notes:

- Postgres is the actual local admin/editor persistence layer.
- MinIO is only needed when you want to test `SOURCE_ASSET_BASE_URL` against object-storage-style URLs. If you leave `SOURCE_ASSET_BASE_URL` blank, the app will continue using bundled static files under `front-end/public/source-files/`.
- Monitoring and scheduled imports are not separate local services yet because the current repo does not have a runtime monitor/worker subsystem to stand up. Health and provider readiness are exposed through `/health`, and coverage imports are still operator-triggered CLI commands.

## Swapping seeded coverage for live civic data later

1. Normalize upstream civic data into the snapshot shape used by `back-end/src/coverage-repository.ts`.
2. Run `npm run ingest:coverage -- --from-file <path>` or `--from-url <url>` from a trusted operator environment to write `LIVE_COVERAGE_FILE`.
3. Keep the public response contracts stable in the backend so the Nuxt composables and pages do not need to change.
4. Replace bundled source files with object storage or CDN delivery behind `SOURCE_ASSET_BASE_URL`.
5. Keep the admin store as the operational layer for publish status, corrections, source monitoring, and editorial overrides even after the read-side data becomes live.

## Server-side provisioning after merge

1. Provision separate public and admin-capable server environments for the Nuxt front end and Express API.
2. Set `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_BASE`, `ADMIN_API_BASE`, `ADMIN_API_KEY`, `ADMIN_SESSION_SECRET`, and either `ADMIN_DATABASE_URL` or `ADMIN_DB_PATH`.
3. Choose the admin store mode:
   Set `ADMIN_STORE_DRIVER=postgres` plus `ADMIN_DATABASE_URL` for managed Postgres. Use SQLite only if there is a deliberate single-instance fallback reason, and then create the directory that will hold the SQLite file referenced by `ADMIN_DB_PATH`, with backup and restore procedures in place.
4. Run `npm run bootstrap-admin` once to create the first persisted admin account.
5. Import the first vetted coverage snapshot with `npm run ingest:coverage`, then enable `LIVE_COVERAGE_REQUIRED=true` when the environment should fail closed without current snapshot data.
6. Configure `SOURCE_ASSET_BASE_URL` when source files should resolve to object storage or a CDN instead of bundled static files.
7. Put the API behind HTTPS and a reverse proxy or platform ingress that sends public `/api/admin/*` traffic to Nuxt, while the Nuxt server reaches the Express admin API over `ADMIN_API_BASE`.
8. Ensure the backend deploy artifact includes `dist/admin-schema.sql` and `dist/admin-schema.postgres.sql`; the build now copies both automatically, but the deployed runtime should still be checked once after merge.
9. Configure log drains, alerts, and request-ID propagation in the platform so structured backend logs are actually usable during incidents.

## Notes

- Ballot Clarity is informational only. It does not recommend candidates, measures, or voting choices.
- Fulton County, Georgia is the current launch jurisdiction. The existing public archive should still be treated as reference coverage until verified Fulton contest packaging and district lookup are live.
- Time-sensitive election logistics should always be checked against official election-office notices.
- Light mode is the default, dark mode is supported, and ballot pages are designed to print cleanly.
