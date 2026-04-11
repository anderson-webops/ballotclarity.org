# Ballot Clarity

Ballot Clarity is a nonpartisan civic-information platform built as an npm workspace monorepo. The current coverage area is Metro County, Franklin, and the product is structured to feel like a real public-interest ballot guide: source-linked election pages, candidate and measure explainers, searchable records, and an internal editorial workspace for review, corrections, and publish control.

## Workspace layout

- `front-end/`: Nuxt 4 application based on the `antfu/vitesse-nuxt` stack and conventions
- `front-end/src/`: public pages, admin pages, layouts, components, composables, stores, and shared front-end types
- `front-end/public/source-files/`: reference source files that power the public source directory and evidence links
- `back-end/`: Express API for ballot content, public search, source records, and admin operations
- `back-end/src/demo-data.ts`: seeded Ballot Clarity coverage data that can later be replaced with live providers or database reads
- `back-end/src/admin-store.ts`: SQLite-backed admin persistence for users, content review, source monitoring, corrections, and activity
- `back-end/admin-schema.sql`: schema for persisted admin and operations data

## Install and run

Install dependencies from the repo root:

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env
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

## Environment configuration

Important variables in `.env`:

- `NUXT_PUBLIC_API_BASE`: public API base used by the front-end for ballot, search, sources, and content reads
- `ADMIN_API_BASE`: server-side Nuxt proxy target for admin-only API requests
- `ADMIN_API_KEY`: shared secret between the Nuxt admin proxy and the Express admin endpoints
- `ADMIN_SESSION_SECRET`: cookie-signing secret for Nuxt admin sessions
- `ADMIN_DB_PATH`: SQLite database path for persisted admin users and editorial operations data
- `ADMIN_BOOTSTRAP_USERNAME`: username used by `npm run bootstrap-admin`
- `ADMIN_BOOTSTRAP_PASSWORD`: password used by `npm run bootstrap-admin`
- `ADMIN_BOOTSTRAP_DISPLAY_NAME`: display label for the initial admin user
- `ADMIN_BOOTSTRAP_ROLE`: initial role, usually `admin`
- `PORT`: Express API port

For production, use unique random values for `ADMIN_API_KEY`, `ADMIN_BOOTSTRAP_PASSWORD`, and `ADMIN_SESSION_SECRET`. The front-end and back-end must share the same `ADMIN_API_KEY`.

## Useful npm commands

```bash
npm run dev
npm run server
npm run bootstrap-admin
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run serve
npm run preview
```

## Public product structure

Key public routes:

- `/`: homepage and address lookup entry
- `/ballot/:slug`: printable ballot guide and contest-reading surface
- `/elections/:slug`: indexable election overview page
- `/locations/:slug`: jurisdiction hub
- `/candidate/:slug`: candidate dossier with evidence links and trust framing
- `/measure/:slug`: ballot-measure explainer with mirrored YES / NO outcomes
- `/compare`: side-by-side comparison surface
- `/search`: full-site search across elections, candidates, measures, and source records
- `/sources`: source directory
- `/sources/:id`: citation-ready source detail page
- `/methodology`, `/neutrality`, `/data-sources`, `/help`, `/about`, `/privacy`, `/terms`, `/contact`

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

- Admin and editor accounts are persisted in SQLite, not hardcoded deployment credentials.
- The browser authenticates against Nuxt server routes, which issue a same-origin session cookie.
- Nuxt proxies protected admin requests to the Express API using `ADMIN_API_KEY`, so the backend key never reaches the browser.
- Admin data includes content publish state, correction intake, source-health monitoring, activity logs, and user management.

## API surface

Public API endpoints:

- `POST /api/location`
- `GET /api/elections`
- `GET /api/jurisdictions`
- `GET /api/jurisdictions/:slug`
- `GET /api/ballot`
- `GET /api/candidates/:slug`
- `GET /api/measures/:slug`
- `GET /api/compare`
- `GET /api/search`
- `GET /api/sources`
- `GET /api/sources/:id`
- `POST /api/feedback`
- `GET /api/data-sources`

Protected admin API endpoints:

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
- Back-end stack: Express plus a small SQLite-backed operations layer
- State model: public civic state lives in `front-end/src/stores/civic.ts`, including selected location, election context, compare list, and saved ballot plan
- Content flow: public pages consume the Express API instead of embedding content directly in page files
- Search and sourcing: every major reading surface links to the source directory and source detail pages
- Trust layer: freshness, methodology, corrections, neutrality, and source authority are modeled explicitly in the data layer and rendered in the UI
- Admin model: persisted users, content status, correction queue, and source-health tracking all live behind a protected internal surface

## Swapping staged coverage for live civic data later

1. Replace the seeded objects and lookup helpers in `back-end/src/demo-data.ts` with live civic adapters or database reads.
2. Keep the response contracts stable in the backend so the Nuxt composables and pages do not need to change.
3. Update `back-end/src/server.ts` to normalize provider payloads into the existing public response shapes.
4. Replace the mirrored source files in `front-end/public/source-files/` with direct public URLs, mirrored records, or provider-backed source storage.
5. Keep `back-end/admin-schema.sql` and `back-end/src/admin-store.ts` as the operational layer for publish status, corrections, and source monitoring even after the read-side data becomes live.

## Notes

- Ballot Clarity is informational only. It does not recommend candidates, measures, or voting choices.
- The current public coverage is limited to Metro County, Franklin, and should be treated as staged reference coverage rather than live nationwide election data.
- Time-sensitive election logistics should always be checked against official election-office notices.
- Light mode is the default, dark mode is supported, and ballot pages are designed to print cleanly.
