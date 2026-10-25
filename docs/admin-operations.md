# Admin operations

The authenticated interface has three primary areas:

- Operations reads validated candidate and reference storage independently of
  manual editorial tables. Opening this page never fetches publisher data.
- Exceptions combines collector problems, pending editorial/publication reviews
  and unresolved reader corrections. Published content remains in the archive.
- Settings links account/MFA controls, users, source configuration/notices and
  audit history. Existing roles, MFA, origin/session checks and publication gates
  remain operative.

`GET /api/admin/operations` uses the same delegated authentication as other admin
routes. It reports persisted datasets, original source capture times, current
process observations and the external automation run receipt. Unknown collection,
import or scheduling times remain unknown. Reference data still requires reviewed
external import. An editorial source-note update never records a network check.

`back-end/dist/manage-state-ballot-automation.js` performs a serial refresh of
enabled, approved automatic candidate sources. `--watch` repeats it with
`STATE_BALLOT_REFRESH_INTERVAL_MS` (one minute through one day, default four hours).
The same source/state/family allowlists, cache, strict normalization, source-policy
holds and atomic external snapshot storage apply. Routine approved raw-fact imports
require no editorial clicks; interpretive content and ballot publication retain
their separate approval, rights and geographic checks.

The runner requires `STATE_BALLOT_DATA_DIR` outside the release. A per-directory
exclusive lock prevents overlapping jobs. A retained crash lock requires operator
review rather than speculative automatic takeover. `automation-run.json` is
written atomically with bounded typed results and source-neutral failure codes.
Last successful collection/import clocks advance only after a fresh successful
durable import, not an unchanged cached read. A watcher records its actual next
run and clears it when stopped; missing, invalid and overdue evidence are distinct
from success. A one-shot invocation makes no claim about an external scheduler.

Publication review selects from loaded elections that do not already have a
workflow. The authenticated package-list response includes `reviewOptions` with
election identifiers and human-readable election/jurisdiction names. Creating a
review assembles that election's publication workflow, not a candidate-data import.
The decision page shows current findings and review/publication controls. Its
separate `/admin/packages/rubric/:id` reference retains the complete rubric and
automated/reviewer evidence, with direct category anchors rather than collapsible
sections. Existing publication gates, revision history and immutable audit evidence
remain available.

Backend errors produce a retryable load error, never an empty or healthy queue.
Release publication ships these source contracts and executable artifacts; it
does not install a host job, approve held content or prove public activation.
