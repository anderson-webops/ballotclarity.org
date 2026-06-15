# Production Configuration Check

`npm run verify:production` is the deploy-time guardrail for Ballot Clarity's production environment.

It checks the environment values and active coverage snapshot that determine whether the public site is operating as a real civic-information service rather than a local or seeded development runtime.

## What It Checks

- Public origins use HTTPS and do not point at localhost.
- `NUXT_PUBLIC_API_BASE` points at the public `/api` path.
- `ADMIN_API_BASE` is configured as a private server-side target, not the same public API base used by browsers.
- `ADMIN_API_KEY` and `ADMIN_SESSION_SECRET` are present, long enough, and not obvious placeholder values.
- `CONTACT_ADDRESS` or `NUXT_CONTACT_ADDRESS` is configured as a valid support email for the protected public contact route.
- `CONTACT_ADDRESS_SESSION_SECRET` or `NUXT_CONTACT_ADDRESS_SESSION_SECRET` is present, long enough, and not an obvious placeholder value.
- Optional public feedback, public lookup, and admin login throttle values are positive integers when set.
- Optional ballot-content provider endpoint URLs use HTTPS, are valid absolute URLs, and do not point at localhost when set.
- Optional ballot-content provider keys and endpoints are paired where the connector would otherwise be ignored or incomplete.
- `ADMIN_STORE_DRIVER=postgres` and a Postgres `ADMIN_DATABASE_URL` or `DATABASE_URL` is configured.
- `LIVE_COVERAGE_REQUIRED=true` is enabled.
- `LIVE_COVERAGE_FILE` exists and has a matching `.meta.json` sidecar.
- Snapshot metadata is `reviewed` or `production_approved`, uses `sourceType: "imported"`, and includes the required review timestamps.
- `production_approved` snapshots include `approvedAt`.
- `reviewed` and `production_approved` snapshot payloads include the minimum public coverage shape: election, jurisdiction, location, summaries, source context, and official resources.
- `reviewed` and `production_approved` snapshot payloads do not contain known staged/reference candidate names, placeholder or internal public URLs, `seeded_demo` or `staged_reference` content markers, or `mixedContent: true`.

Reviewed-but-not-approved snapshots pass with a warning because Ballot Clarity may intentionally run an official-logistics-only reviewed package while public copy keeps that state visible. Seed, unknown, missing, or unreviewed snapshots fail.

## Usage

Use the active server environment:

```bash
npm run verify:production
```

Use a specific environment file during handoff review:

```bash
npm run verify:production -- --env-file /path/to/production.env
```

Emit machine-readable output:

```bash
npm run verify:production -- --json
```

## Scope

This check does not replace full editorial content validation. It does provide a deploy-time backstop for the most dangerous snapshot states: production-eligible packages that are only empty shells, still carry reference-archive candidates, contain placeholder or internal URLs, contain staged guide markers, or expose mixed-content flags.

This check verifies the runtime contract around that content: public origins, admin persistence, protected contact configuration, secret posture, throttle configuration, optional ballot-content provider endpoint safety, live snapshot requirement, and snapshot provenance.
