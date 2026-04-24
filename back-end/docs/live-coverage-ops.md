# Live Coverage Snapshot Ops

## Snapshot files

- Set the active snapshot path with `LIVE_COVERAGE_FILE`.
- The snapshot payload lives at that JSON path.
- Provenance metadata lives beside it as:
  - `<snapshot>.meta.json`

## Provenance states

- `seed`: exported from built-in seed data for route wiring or local verification
- `reviewed`: imported snapshot that has been reviewed but is not yet production-approved
- `production_approved`: approved production snapshot
- `unknown`: snapshot file exists without a provenance sidecar, or the runtime is missing a configured snapshot

## Import a reviewed or approved snapshot

```bash
npm run -w back-end ingest:coverage:src -- \
  --from-file /path/to/reviewed-snapshot.json \
  --output "$LIVE_COVERAGE_FILE" \
  --status reviewed \
  --source-label "Reviewed Fulton coverage snapshot" \
  --source-origin "manual import"
```

For an approved production package, change `--status reviewed` to `--status production_approved`.

## Export a seed snapshot

```bash
npm run -w back-end export-seed-coverage:src -- \
  --output /path/to/seed-snapshot.json
```

Seed exports are for local verification or route wiring only. Their sidecar metadata marks them as non-production content.

## Export the reviewed Fulton official-logistics package

Use this when production should stop serving the built-in seed/reference package but verified Fulton-specific contest,
candidate, and measure records are not available yet.

```bash
npm run -w back-end export:fulton-reviewed-coverage:src -- \
  --output data/reviewed/fulton-county-2026-general.official-logistics-only.json \
  --status reviewed \
  --source-label "Reviewed Fulton County official-logistics-only coverage snapshot" \
  --source-origin "Ballot Clarity source/data pipeline"
```

Generated artifacts:

- `back-end/data/reviewed/fulton-county-2026-general.official-logistics-only.json`
- `back-end/data/reviewed/fulton-county-2026-general.official-logistics-only.json.meta.json`

The export validates that no staged/reference candidate names remain in the reviewed artifact and that production-approved
metadata cannot be paired with mixed or staged guide content. The reviewed Fulton export intentionally keeps the guide in
official-logistics-only mode: official election resources are published, while verified contest, candidate, and measure
records remain unavailable.

Ops handoff:

```bash
/usr/local/sbin/ballotclarity-coverage promote \
  --from /srv/ballotclarity.org/back-end/data/reviewed/fulton-county-2026-general.official-logistics-only.json \
  --target /srv/ballotclarity.org/back-end/data/live-coverage.active.json
```

## Promote a candidate snapshot to active

```bash
npm run -w back-end manage:coverage:src -- promote \
  --from /path/to/candidate-snapshot.json \
  --target "$LIVE_COVERAGE_FILE"
```

This automatically backs up the current active snapshot into a sibling `backups/` directory before replacement.

## List backups

```bash
npm run -w back-end manage:coverage:src -- list-backups \
  --target "$LIVE_COVERAGE_FILE"
```

## Roll back to a previous snapshot

```bash
npm run -w back-end manage:coverage:src -- rollback \
  --from /path/to/backup-snapshot.json \
  --target "$LIVE_COVERAGE_FILE"
```

Rollback also backs up the pre-rollback active snapshot first.

## Runtime checks

After a replacement or rollback, verify:

- `/health`
- `/api/coverage`
- `/api/elections`
- `/api/guide-packages/<id>`
- `/ballot/<slug>`
- ZIP lookup for `30022`

`/health`, `/api/coverage`, and `/api/status` should now expose snapshot provenance, including status, source label, and whether the configured snapshot path is missing.
