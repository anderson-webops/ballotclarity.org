# Fulton education-tax notice preparation

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
Acquisition and separately approved recurring scheduling remain outside this
offline command; use the existing reviewed, paced HTTPS transport for acquisition.

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

The source-policy receipts and calendar publication configuration now live in
dependency-light modules. Existing exports and the calendar configuration digest
remain compatible, while independently started workers avoid import-order
initialization failures.
