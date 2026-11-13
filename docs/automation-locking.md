# Recurring worker coordination

The approved candidate worker holds one SQLite exclusive transaction for its
external data directory. The operating system releases the lock when the
connection or process closes, including after a forced stop. A later invocation
uses the same coordination file without deleting it or guessing whether a PID
has expired. This applies to both one-pass and `--watch` invocations, independently
of source family, election year or publication format.

`automation.lock` is a small, versioned SQLite database containing only a format
marker. Initialization publishes a complete private file without replacing an
existing path. A second owner fails before refreshing data or changing the run
receipt. Canonical directory aliases share ownership. Unrecognized versions,
legacy PID text, unsafe file types and permissions remain protected review cases.
The file is kept outside application releases with the existing external state.

The supported Node runtime already supplies `node:sqlite`; no additional package,
conversion tool, network listener or database service is introduced. The lock
uses SQLite's rollback-journal locking model, separately from application/admin
storage. See [SQLite locking](https://www.sqlite.org/lockingv3.html).

## Compatibility

This changes transient worker-coordination state, not the API, source catalogs,
candidate snapshots, approvals or publication rules. A stopped legacy worker
normally removes its PID file; an existing legacy or ambiguous file is preserved
for operator review. The new worker never guesses its owner or silently converts
such a file.

Earlier workers use exclusive file creation and therefore refuse the persistent
SQLite marker. A worker rollback includes the corresponding coordination state,
with every worker stopped and recoverable retained evidence. Voter-service
rollback remains separate because public requests do not acquire this lock.
Protected transition/recovery acceptance and recurring-job activation remain
separate from source publication.

## Verification

Tests exercise contention, aliases, normal shutdown, forced process termination,
cold restart and unchanged lock bytes. Legacy, malformed, oversized, symlinked,
unprivate and unknown-version files remain unchanged on refusal. Source allowlists,
publisher holds, capture clocks and atomic dataset persistence retain their
existing contracts. Crash recovery does not turn an interrupted collection into
a successful import or change any content/publication decision.
