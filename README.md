# Ballot Clarity

Ballot Clarity is a nonpartisan civic-information MVP built as an npm workspace monorepo. It presents a demo ballot guide that helps voters review who is on the ballot, what candidates and measures mean, which public sources support each summary, and how to move between jurisdiction hubs, election overview pages, and detailed contest records.

## Workspace layout

- `front-end/`: Nuxt 4 app based on the `antfu/vitesse-nuxt` stack and conventions
- `back-end/`: Express mock API that serves realistic demo ballot, candidate, measure, and source data
- `front-end/src/`: Pages, layouts, components, composables, stores, and shared front-end types
- `front-end/public/demo-sources/`: Demo source documents referenced by the UI
- `back-end/src/demo-data.ts`: Mock civic data that can be replaced later with real providers

## Run locally

Install dependencies from the repo root:

```bash
npm install
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

Copy the root example file and set real credentials before using the internal admin portal:

```bash
cp .env.example .env
```

Important variables:

- `NUXT_PUBLIC_API_BASE`: public front-end API base for ballot and content reads
- `ADMIN_API_BASE`: server-side Nuxt proxy target for admin-only API requests
- `ADMIN_API_KEY`: shared internal secret between the Nuxt admin proxy and the Express admin endpoints
- `ADMIN_USERNAME`: username for the admin login
- `ADMIN_PASSWORD`: password for the admin login
- `ADMIN_SESSION_SECRET`: cookie-signing secret for Nuxt admin sessions
- `PORT`: Express API port

For production, use unique random values for `ADMIN_API_KEY`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`. The front-end and back-end must share the same `ADMIN_API_KEY`.

## Useful npm commands

```bash
npm run lint
npm run lint-fix
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run serve
npm run preview
npm run server:once
```

## Architecture choices

- Front-end stack: Nuxt 4, Vite, TypeScript, UnoCSS, Pinia, file-based routing, layouts, composables, and `<script setup>`
- Back-end stack: Express with typed mock endpoints under `back-end/src/server.ts`
- Data flow: the front-end consumes the back-end API instead of hardcoding ballot content into page components
- State: global civic selection state lives in `front-end/src/stores/civic.ts`
- Shared front-end models: civic data types live in `front-end/src/types/civic.ts`
- Demo data: realistic but clearly labeled mock records live in `back-end/src/demo-data.ts`
- Search/trust layer: major pages now use canonical tags and JSON-LD, while the printable ballot guide is treated as a follow-on reading surface rather than the primary indexable election landing page
- Automated verification: unit tests cover frontend config and backend API behavior, and an end-to-end smoke test validates the built front-end against the built API
- Admin operations: Nuxt server routes provide cookie-based admin auth and proxy protected review, correction, and source-health data from the backend without exposing the backend admin key to the browser

## Mock API endpoints

- `GET /api/location`
- `GET /api/elections`
- `GET /api/jurisdictions`
- `GET /api/jurisdictions/:slug`
- `GET /api/ballot`
- `GET /api/candidates/:slug`
- `GET /api/measures/:slug`
- `GET /api/compare`
- `GET /api/admin/overview` (protected by `x-admin-api-key`)
- `GET /api/admin/corrections` (protected by `x-admin-api-key`)
- `GET /api/admin/review` (protected by `x-admin-api-key`)
- `GET /api/admin/sources` (protected by `x-admin-api-key`)

## Admin portal

Internal operations routes are available when the admin environment variables are configured:

- `/admin/login`
- `/admin`
- `/admin/review`
- `/admin/corrections`
- `/admin/sources`

The admin UI is intentionally not linked from the public navigation. It is protected by a same-origin session cookie at the Nuxt layer, while the Nuxt server proxies admin data to the backend using the private `ADMIN_API_KEY`.

## Swapping mock data for real civic APIs later

1. Replace the fixture objects and lookup helpers in `back-end/src/demo-data.ts` with live civic data adapters or database reads.
2. Keep the response contracts stable in the back-end so the Nuxt composables and pages do not need to change.
3. Update `back-end/src/server.ts` to normalize external provider payloads into the existing frontend-facing shapes.
4. Replace the demo source documents in `front-end/public/demo-sources/` with real public URLs or mirrored source records.
5. Override `NUXT_PUBLIC_API_BASE` when the front-end should call a deployed API instead of the local dev server.

## Notes

- All ballot, candidate, measure, and funding content is demo data and is labeled in the UI.
- The product is informational only and does not recommend candidates or ballot positions.
- Light mode is the default, dark mode is supported, and ballot pages are designed to print cleanly.
- GitHub automation includes npm workspace CI, Dependabot updates, and an optional Qodana workflow.
