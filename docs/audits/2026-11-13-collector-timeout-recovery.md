# Collector Timeout Recovery

Reviewed November 13, 2026.

## Reproduced Failure

The pinned HTTPS transport used a socket inactivity timeout alongside an outer
promise deadline. A connection that had not reached the socket-timeout stage
could remain open after the caller received its timeout. The JSON body deadline
also rejected its caller without destroying an unfinished response reader.

Controlled request and stream fixtures reproduce both missing cleanup paths on
the preceding source. The correction adds an absolute request deadline, clears
it at response/error/close, and destroys a JSON response when its body deadline
expires. The existing socket inactivity limit remains active. Successful
requests cancel the absolute deadline; certificate errors retain their identity.

The change preserves public-address pinning, host/redirect allowlists, exact TLS
hostname validation, certificate rejection, importer identity, response bounds,
publisher access challenges, robots policies, cache clocks and source holds.
No retry, alternative address selection, CA change or publisher bypass is added.

## Current Publisher Probes

An ordinary compiled request for Alaska's configured robots URL now succeeds
with default Node TLS. This changes the earlier certificate-failure observation;
it does not verify the remaining policy/index/pamphlet documents. The November
3 collector's existing election-expiry gate still applies to new collection.

The first Wyoming robots request timed out through the configured Node transport.
A subsequent exact-host request succeeded in less than one second. Its observed
connection issue is intermittent; this small sample does not establish continuous
availability or attribute the successful connection to the correction.

Before correction, the four-second timeout left connection/socket resources
present at the next observation; the private process exited about one second
later. Controlled regression fixtures prove the corrected cleanup paths. Both
latest robots probes exit with no retained TCP/connection resources. These bounded
observations establish neither an indefinite leak nor the cause of the earlier
browser incident. The expired November collector remains held independently.

The separate Calcasieu lead remains held at its document host's robots HTTP 403.
Original captures and detailed before/after evidence remain private. These
diagnostics authorize no data import, publication or recurring host activation.
