# Repository Guidelines

## Project Structure & Module Organization

- `front-end/` hosts the Nuxt application. Pages are organized under `src/pages`, shared UI under `src/components`,
  common logic under `src/composables` and `src/stores`, and Nuxt-specific runtime code under `plugins/` and
  `nuxt.config.ts`.
- `back-end/` contains the Express API and supporting TypeScript types/tests. Keep application code in `src/`, Node
  tests in `test/`, and compiled output in `dist/`.
- Root workspace configuration owns shared install, build, lint, typecheck, and test flows. Treat the repository root
  as the source of truth for monorepo automation.

## Build, Test, and Development Commands

- `npm install` at the repository root installs the full monorepo. Keep the root and back-end lockfiles in sync.
- `npm run dev`, `npm run serve`, and `npm run preview` run the Nuxt front-end in local, LAN, and preview modes.
- `npm run server` starts the API in watch mode; `npm run server:once` runs it without the watcher and is the better
  choice for IDE stop/start behavior.
- `npm run build` builds both front-end and back-end bundles.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:unit`, and `npm run test:e2e` are the expected
  validation commands before shipping changes.

## Coding Style & Naming Conventions

- Follow the shared ESLint + TypeScript setup already wired through the root config and `front-end/eslint.config.js`.
  Use `npm run lint-fix` instead of hand-formatting.
- Keep Vue component filenames in PascalCase, route files lowercase, and store/composable names descriptive.
- Keep API route and payload logic explicit and typed. Put server-only logic in the back-end or Nuxt server layers
  rather than leaking it into client code.
- Favor small, feature-local helpers over broad utility dumping grounds.

## Testing Guidelines

- Front-end tests live under `front-end/test/` and currently include configuration/runtime checks. Add new unit tests
  there when changing Nuxt config or shared client logic.
- Back-end tests live under `back-end/test/` and run with Node’s built-in test runner plus `tsx`.
- `test/e2e-smoke.test.ts` at the repo root is the smoke path for integrated build/runtime validation. Keep it working
  when changing routing, server startup, or API wiring.
- When touching API contracts or election-data behavior, update tests in the same change set.
- After every code change, run a local verification pass against the locally retrieved API-backed data already available
  in the workspace or `.env`-driven provider flow, and confirm that every affected route, page, and connected system
  still populates and hooks up to the correct data rather than only passing static/unit checks.

## Commit & Pull Request Guidelines

- Use concise, present-tense commit subjects. Keep unrelated work in separate commits.
- Note the validation commands you actually ran, especially when a change affects both Nuxt and Express behavior.
- Call out deployment or environment consequences in the PR body when a change affects runtime configuration or public
  API behavior.

## Security & Configuration Tips

- The front-end expects `NUXT_PUBLIC_API_BASE` for API wiring, and the back-end defaults to `PORT=3001` when unset.
  Keep environment values outside version control.
- Never commit production endpoints, credentials, or copied election-source secrets.
- Re-check both the front-end and back-end test paths when changing public API routing or runtime config defaults.

## Agent Delivery Workflow
- Do not leave completed work uncommitted. After each coherent, validated change set, create a commit and push it in the same session.
- Use multiple commits and pushes when that keeps unrelated changes, partial validations, or follow-up fixes clearly separated. Prefer small, logically grouped commits over one mixed commit.
- Keep both `package-lock.json` and `back-end/package-lock.json` synchronized before every commit or push.
- Treat local API-backed route verification as part of validation, not as an optional follow-up. If a change affects
  lookup, routing, route payloads, or rendered civic data, verify the affected pages with the locally available real
  data before committing.
- Use lowercase annotated semver tags only. Do not invent ad-hoc labels such as `V1`, `torca-r07`, `pre-lfs-migration-*`, or similar one-off names.
- This repo follows the stable `v1.x` line. Stay on `v1` for routine work; only cut `v2` for an intentional breaking product, API-contract, or deployment change.
- Before creating a new tag, check the latest tag in the active semver line and decide whether the new commit is still the same release milestone. If it is, move that existing tag forward to the new validated commit instead of minting a new version number.
- Keep the GitHub release aligned with that decision: when the commit still belongs to the same milestone, update or recreate the existing release so it points at the moved tag/current commit; only create a brand-new release when the change creates a genuinely new milestone.
- Cut a fresh semver tag and release only when the work crosses a real release boundary, such as a new deployable milestone, a materially different operator/user-facing state, or a version-line change that deserves its own notes and rollback point.
- Create an annotated tag when ballot lookup behavior, candidate/measure/election content, API contracts, dependency/security posture, or health/deploy behavior materially changes.
- Create a GitHub release when that tag represents a real production milestone for voters, operators, or rollback/reference needs. Release notes should summarize scope, validation, rollout notes, and any migration or recovery steps.
- If the existing tag or release history contains stale drafts, redundant entries, or ad-hoc labels, clean that history up instead of preserving clutter.
- Skip tags and releases for trivial doc-only edits, formatting-only changes, or routine housekeeping unless they change deployment, operations, or a consumer-facing contract.
