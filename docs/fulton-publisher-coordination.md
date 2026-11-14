# Shared Fulton publisher requests

Native requests to `fultoncountyga.gov` and `www.fultoncountyga.gov` share the
external `FULTON_PUBLISHER_REQUEST_DIRECTORY`. This applies to candidate/cycle,
municipal, calendar, notice, officeholder and court collection through the
maintained text/document request functions. Other publishers retain their
independent request policies. Stored public reads and offline preparation use
neither this directory nor publisher access.

Requests wait at least eleven seconds after the previous response completes
across independent processes and both hostname forms. This also bounds start
spacing when DNS or body delivery is slow. Process-held ownership covers the complete bounded
response; contention waits up to thirty seconds before preserving a collection
failure. An owner-only journal is fsynced before network access and retains only
publisher identity, attempt count and start/completion times. It stores no URLs or responses.
Failed requests still consume their slot. Process exit releases ownership, while
the journal preserves completed-request timing after restart. An interrupted
request requires a fresh full interval after ownership recovery.

The directory is private, external and explicitly configured once for all workers.
Missing configuration, unsafe metadata, a clock rollback, malformed journals or
exhausted storage hold new requests. Existing permissions and saved state remain
unchanged. Individual collectors retain their source policies, longer refresh
intervals, original captures, last-good snapshots and substantive review gates.

This journal is separate from candidate/measure records, source-specific locks
and capture history. Matching external-state preservation belongs to the runtime
contract. Publisher-policy approval, data import/publication and host scheduling
remain independent of request coordination.
