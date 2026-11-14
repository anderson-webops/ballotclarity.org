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
Preparation creates no publication or import authority. The current Union
directory source remains a reviewed manual import, with personal previews
disabled; the recurring candidate-family count is unchanged. The worker supplies
repeatable collection and preparation for that review path. Scoped scheduling,
substantive review, geographic applicability and protected import/publication
remain separate acceptance steps.
