# Private release handoff contract

This optional, standalone worker receives private release handoffs. It is separate
from the voter API, admin accounts and application deployment. It starts only with
explicit receiver configuration and binds to loopback. The host supplies HTTPS.

## Authentication and transport

`POST /api/private-release-handoffs` uses a restricted
[RFC 9421 HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421.html)
profile with Ed25519. The exact covered components, in order, are `@method`,
`@path`, `content-digest`, `x-handoff-id` and `x-handoff-audience`.
The `handoff` signature label carries `created`, `expires`, `keyid` and
`alg="ed25519"` parameters. Validity is at most 300 seconds, with at most
30 seconds of future clock skew. The request ID is a UUIDv4 and the key ID is the
SHA-256 fingerprint of the public key's DER SPKI encoding.

Only explicitly enrolled Ed25519 public keys authenticate. Each deployment has an
explicit audience; keys and audiences are not shared across unrelated services.
The signature authenticates the claimed SHA-256 content digest before body intake.
The received body must match that digest. Other signature profiles, altered
components, expired signatures, unknown keys and content encodings are rejected.
The sender requires HTTPS and rejects redirects, URL credentials and query strings.

## Packet and receipt

The JSON envelope has `schemaVersion: 1`, `type: "ballot-private-release-handoff"`,
`audience`, `release` and `files`. `release` contains the immutable `tag`, exact
`commit` and accepted runtime `archiveSha256`. Each file carries `name`, `bytes`,
`sha256` and canonical `contentBase64`.

Required files are `CURRENT-SERVER-HANDOFF.md`, `DATA-DELTA.json`,
`PENDING-DELIVERY.json`, `SERVER-DATA-BASELINE.json` and
`SERVER-RECEIVED-DATA-BASELINE.json`. The only optional files are
`PENDING-CONTENT.zip`, its `.sha256` companion and
`OPERATOR-REPORTED-RECEIPT.json`. No paths or arbitrary filenames are accepted.
Current release metadata and pending-file counts must agree. A pending ZIP must
match its checksum and delta; zero pending content requires no ZIP.

Limits are 16 MiB for the encoded request, 8 MiB per file and eight files. Archives
are stored as opaque files, never extracted by this worker. A receipt verifies
transport custody, not the safety, applicability, approval or import of contents.

After all fixed-name files, the original envelope, authentication evidence and receipt are written and
synced, an atomic directory promotion makes the packet visible. Files are 0600
inside an owner-only directory outside the application artifact and webroot.
The receiver never serves stored files, changes deployment pointers, imports
data, executes instructions, deletes accepted packets or selects a live release.
The protected consumer matches the exact tag, commit and runtime digest.

An exact retry of the same ID, key and body returns the same durable receipt
with HTTP 200. New custody returns 201; conflicting reuse returns 409. Stored
contents are verified again before duplicate acknowledgement. Requests have
bounded concurrency, header/body timeouts and connection counts. The inbox has
an exclusive writer lock, a default 64 MiB quota and a default 256-packet limit.
Capacity exhaustion and abandoned writer locks require explicit owner recovery;
last accepted packets remain intact. Keys are revoked by removing enrollment
and restarting the worker. Existing permission requirements remain in force.

## Independent stored-signature verification

New packets retain `authentication.json` alongside the unchanged schema-1 envelope
and receipt. Its evidence schema is 1, with type
`ballot-private-handoff-authentication`, method `POST`, the exact intake path,
`authenticatedAt`, and the six original headers: `content-type`, `content-digest`,
`signature-input`, `signature`, `x-handoff-id` and `x-handoff-audience`.
The sidecar is private and committed atomically with its packet. Retries preserve
the first evidence and receipt instead of replacing them with later signatures.

The standalone verifier accepts an exact release identity and independently
enrolled public keys:

```sh
node back-end/dist/manage-private-handoff.js verify \
  ABSOLUTE_PACKET_DIRECTORY ABSOLUTE_TRUST_CONFIG TAG COMMIT ARCHIVE_SHA256
```

The external, invoking-owner-only trust file contains `schemaVersion: 1`,
`audience` and `publicKeys` (PEM Ed25519 public keys). Receiver configuration is
also accepted when owned by the invoking account. Packet content and receipt key
assertions never establish trust. Verification checks the original signature,
exact body digest and requested release, every stored file, the complete private
inventory and receipt binding. Successful output contains aggregate metadata only.

Archived signature validity is evaluated at the recorded authentication time, so
independent verification survives expiry of the ingress window and worker restart.
The signed body proves enrolled-key provenance, not an independently trusted
arrival timestamp. `authenticatedAt` and receipt time remain custody metadata.
Protected consumers verify an admitted, access-controlled copy before using it;
verification does not make a concurrently writable original directory immutable.

Legacy packets without original evidence remain custody-only. Their exact retries
continue to return the original receipt without manufacturing missing evidence.
The offline verifier reports `legacy-custody-unverifiable` and exits 76 for absent
evidence, whether legacy or removed. Other verification failures exit 1. A fresh
packet received by an evidence-capable worker is necessary for independent proof.
Keeping a separate persistent source receipt namespace permits that new delivery
while preserving earlier retry identities. Mandatory host receipt enforcement
requires separate protected acceptance of the verifier, trusted enrollment and
fresh delivery; this capability alone changes no deployment policy.

## Compiled worker configuration

`node back-end/dist/manage-private-handoff.js contract` emits the versioned,
machine-readable optional capability contract, including its separate writable
state and preservation boundary.

`back-end/dist/private-handoff-receiver.js` reads the owner-only JSON file named
by `PRIVATE_HANDOFF_RECEIVER_CONFIG`. Required configuration is `schemaVersion: 1`,
`audience`, `publicKeys` (one to sixteen PEM public keys), `inboxDirectory`
(canonical owner-only external storage) and `port` (host-selected loopback port).
Optional `maximumBytes` accepts 32 through 256 MiB; `maximumEntries` accepts one
through 1,024. Existing directory permissions are checked, never relaxed.
`GET /healthz` returns liveness only; it does not disclose stored content or imply
deployment/data acceptance. This worker is not added to the default two-service
runtime contract and requires independent host enrollment and resource controls.

## Source-side finalization

`back-end/dist/manage-private-handoff.js init ABSOLUTE_PRIVATE_DIRECTORY AUDIENCE`
creates a dedicated owner-only signing key, public key and disabled sender profile.
Existing material is preserved. Signing material belongs outside repositories,
AI working folders, handoff packets and release assets.

`scripts/finalize-release-handoff.mjs` accepts `--assets`, `--active`, `--receipts`,
`--tag`, `--commit` and optional `--profile`. It verifies the ARM64 acceptance
receipt, published release and exact bundled GitHub provenance before signing or
sending private content. The profile defaults to
`~/Library/Application Support/BallotClarity/release-handoff/profile.json`.
The profile contains `schemaVersion: 1`, `audience`, exact HTTPS `endpoint` and
absolute `privateKeyPath`. Enrollment is complete only after the host accepts the
public key and the endpoint is configured.

Finalization persists the packet identity before transmission and retries bounded
transient failures with the same ID, including after restarting the sender. A
matching durable receipt is required before reporting delivery; unknown outcomes
remain pending rather than being inferred from HTTP transmission. The local
receipt is saved outside the active packet, and verified repeat finalizations reuse
that receipt without retransmission. No credentials or private files are
supplied to GitHub Actions. An unenrolled endpoint is an explicit handoff blocker,
not permission to use administrative access or bypass deployment/import gates.
