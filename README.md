# Ballot Clarity

Ballot Clarity is a nonpartisan civic-information MVP built as an npm workspace monorepo. It presents a demo ballot guide that helps voters review who is on the ballot, what candidates and measures mean, and which public sources support each summary.

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
- Automated verification: unit tests cover frontend config and backend API behavior, and an end-to-end smoke test validates the built front-end against the built API

## Mock API endpoints

- `GET /api/location`
- `GET /api/elections`
- `GET /api/ballot`
- `GET /api/candidates/:slug`
- `GET /api/measures/:slug`
- `GET /api/compare`

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
