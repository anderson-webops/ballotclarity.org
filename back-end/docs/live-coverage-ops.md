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
