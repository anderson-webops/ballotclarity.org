# Fulton education-tax notice preparation

`collect-fulton-education-notice.js` acquires the reviewed policy inputs, county
index and explicitly offered notice, then prepares CSV/JSON in an external data
directory. A stable plan can select `latest-published` across compatible future
editions; explicit ISO dates retain a particular edition.

```sh
node back-end/dist/collect-fulton-education-notice.js /external-data/notice-collection.json
```

```json
{
  "schemaVersion": 1,
  "type": "fulton-education-notice-collection",
  "directory": "/external-data/fulton-education-notices",
  "electionDate": "latest-published"
}
```

Collection uses the existing public-address-pinned HTTPS transport, exact
reviewed policies, four requests, eleven-second request pacing and a six-hour
minimum refresh/retry interval. A process-held external lock and fsynced attempt
journal preserve retry bounds through interruption. Captures, research and prior
current pointers remain outside Git and runtime releases. Identical documents
retain original capture clocks; successful checks have a separate timestamp.
Policy changes, publisher denial/redirects, malformed documents, date regression,
changed fiscal facts or disappearing projects retain the prior current evidence
for review. Archive limits are 256 captures and 128 MiB, with capacity reserved
before publisher access; retention review preserves existing evidence.

The current pointer becomes available only after pinned offline validation and
CSV/JSON persistence. These outputs remain research, with import/publication
approval false. Host scheduling and substantive adoption retain their separate
approval boundaries. Latest-published can select a historical notice; it does
not establish that its election is current or that its proposal passed.

The maintained `prepare-fulton-education-notice.js` command discovers explicitly
offered ESPLOST notice editions from the county election index and prepares
hash-pinned original captures offline. Discovery retains the literal published
PDF address and election date, including future editions, without constructing
yearly filenames. Unknown policy links, ambiguous editions and changed document
structure require review.

```sh
node back-end/dist/prepare-fulton-education-notice.js discover /external-data/election-index.html
node back-end/dist/prepare-fulton-education-notice.js prepare /external-data/notice-plan.json
```

```json
{
  "schemaVersion": 1,
  "type": "fulton-education-notice-preparation",
  "capturePath": "/external-data/capture/capture.json",
  "captureSha256": "<original complete capture SHA-256>",
  "outputRoot": "/external-data/prepared",
  "electionDate": "latest-published"
}
```

An explicit ISO election date can replace `latest-published`. Latest means the
newest explicitly offered edition, including a historical edition when no later
notice is published. It makes no claim about current ballot availability.

The original capture has type `fulton-education-notice-original-capture`, with
the reviewed robots/privacy inputs, the exact county index, and one offered PDF
in that order. Each document retains its content-addressed relative filename,
URL, original capture clock, status, content type, byte count and SHA-256. The
capture manifest also retains `sourceIndexUrl`, `publisherRequests: 4`,
`reviewedPolicyDigestsMatched: true`, `publicationApproved: false` and
`importApproved: false`. Preparation independently verifies those inputs against
the unchanged county policy receipts, current offered-link selection and robots
permissions. The capture's assertions alone do not establish those properties.
The collection command supplies this capture format directly; the offline
command remains network-free. Recurring scheduling retains separate approval.

`STATE_BALLOT_PDFTOTEXT` identifies the maintained native Poppler executable.
Extraction is bounded to twenty pages, 4 MiB of text and the existing twelve-second
worker timeout. Four captured inputs remain within 24 MiB together. Preparation
uses an external process-held output lock and writes separate immutable result
folders; prior captures and results remain intact.

`notice-research.json` retains tax timing, collection/project-cost ceilings,
maximum bond principal and interest, and printed annual principal limits. Integer
cents reconcile the two school-system cost ceilings and every principal year.
The named-project subset includes replacement planning regions, critical-system
schools and explicitly numbered Atlanta reconfiguration priorities. Conditions
remain attached to those records. Broad, conditional facility-eligibility lists
remain in the original PDF, so `projectInventoryComplete` stays false.
`notice-research.csv` supplies those named projects and annual principal limits
with source pages, URL, original hash and clock.

Maximum interest is an authorization ceiling, distinct from an actual borrowing
rate. Listed projects carry `fundingGuaranteed: false`. Election results,
implementation, personal applicability, publication and import approval remain
separate. Supplementary notice facts preserve the consolidated sample's existing
literal wording and original source identity.

[Fiscal supplementation](fulton-education-measure-supplement.md) connects the
captured notice to an existing unpublished measure draft and the maintained
measure-guide preparation workflow, preserving the original draft and clocks.

The source-policy receipts and calendar publication configuration now live in
dependency-light modules. Existing exports and the calendar configuration digest
remain compatible, while independently started workers avoid import-order
initialization failures.
