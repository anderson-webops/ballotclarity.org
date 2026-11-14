# Recurring Union County ballot preparation

The Union worker discovers the publisher's current general-election edition and
every offered sample form. It collects at most 25 forms per batch and prepares
the candidate snapshot plus bilingual question evidence without per-election
dates, URLs or form numbers in its profile.

```json
{
  "schemaVersion": 1,
  "type": "union-ballot-automation",
  "directory": "/private/union-ballot-automation",
  "intervalMs": 86400000,
  "accessReview": {
    "unionRobots": "<reviewed policy fingerprint>",
    "unionPrivacy": "<reviewed policy fingerprint>",
    "countyRobots": "<reviewed policy fingerprint>",
    "countyPrivacy": "<reviewed policy fingerprint>"
  }
}
```

The compiled command is `back-end/dist/manage-union-ballot-automation.js`:

- `run PROFILE.json` discovers, collects and prepares the current offered edition.
- `inspect PROFILE.json` verifies stored output hashes and reports actual state.
- `prepare PROFILE.json CAPTURE-PINS.json` seeds preparation from a complete set
  of retained `{ "path": "/private/capture.json", "sha256": "..." }` pins with
  matching reviewed publisher policies. It makes no publisher requests.
- `enroll PROFILE.json IMPORT-POLICY.json` imports the exact reviewed baseline
  and records candidate-import enrollment.
- `sync PROFILE.json IMPORT-POLICY.json` collects and prepares the offered edition,
  then imports compatible candidate data under that enrollment.

## Candidate import enrollment

The external owner-private import policy binds the exact collection profile and
reviewed baseline snapshot. A separately approved future-election setting lets
the same profile and policy follow later offered editions:

```json
{
  "schemaVersion": 1,
  "type": "union-ballot-import-policy",
  "profileSha256": "<SHA-256 of the exact profile bytes>",
  "baselineSnapshotSha256": "<reviewed candidate snapshot SHA-256>",
  "dataDirectory": "/private/ballot-snapshots",
  "catalogPath": "/private/ballot-snapshots/union-cycles.json",
  "allowFutureElections": true
}
```

Candidate imports use the existing persistent snapshot format. The catalog
registers later source identities through `STATE_BALLOT_CYCLE_CATALOGS` with
family `nj-union-2026-11-03`; existing state, exact-source and family allowlists
still apply. Explicit historical selections remain readable after expiry, while
default/current selection honors the election cutoff. Public reads use stored
records and require neither publisher access nor native conversion.

Enrollment accepts only the exact baseline hash. Recurring imports retain all
accepted candidates and their fields within an election; candidate disappearance
or alteration requires review. Later compatible editions receive separate dated
snapshots when future elections are approved. Capture regressions, changed
approval/profile bytes, incomplete preparation and collection failures preserve
the accepted data. Imports retain original source clocks, keep immutable copies
of superseded snapshots, and reuse exact receipts on unchanged runs. A successful
import followed by a catalog/receipt persistence failure remains recoverable by
retrying the same verified preparation; existing snapshot copies remain retained.
An explicitly reviewed replacement baseline can be enrolled after an exception;
the prior snapshot and receipt stay in immutable import history.

Candidate enrollment leaves question evidence queued for independent substantive
review. Personal ballot matching stays disabled. The generic cycle-sync command
directs this family to the enrolled Union worker rather than starting a second
collection path.

Use one physical, external, owner-private profile directory for this Union worker. Process-held
ownership spans collection and preparation. A scheduled early invocation returns
the prior result without advancing its source-check clock. Profiles enforce a
six-hour minimum interval, fixed host/policy checks, the publisher's crawl delay,
bounded request/byte counts and at most 99 offered forms. Partial intakes remain
available for diagnosis. After interrupted ownership is released, collection
starts with an additional bounded cooldown and retains the previous complete
proposal.

Every batch must bind the same complete catalog. Candidate and question outputs
retain original capture clocks. Identical catalog/document bytes reuse the
previous prepared output without native reprocessing. Changes queue added,
removed or altered candidates, changed questions and newly offered elections.
Unchanged checks and collection failures preserve outstanding proposal reviews.
An older edition, changed access policy, denied response, incomplete catalog,
unknown layout or persistence failure retains the previous complete proposal.
Prepared-file tampering stops further collection rather than producing a healthy
empty result.

Storage is bounded at 512 MiB with a 160 MiB reservation before collection and
65,536 entries. Capacity requires retention review; originals are preserved.
Preparation creates no publication or import authority. The directory source
retains its externally prepared snapshot policy; candidate import requires the
separate explicit enrollment above. Scoped host scheduling, substantive question
review, geographic applicability and protected publication remain separate
acceptance steps.
