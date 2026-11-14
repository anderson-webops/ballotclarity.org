# Lafayette guide collection

The [managed preparation command](lafayette-guide-automation.md) combines this
collector with reviewed guide assembly, repeat handling and durable status.

`back-end/dist/collect-lafayette-guide-research.js PLAN.json` discovers the
elections hub actually linked by One Acadiana's advocacy page, then follows its
explicitly dated ballot-guide PDF. Compatible future editions use the same
index and source contract rather than guessed annual URLs.

The external JSON plan contains exactly `schemaVersion: 1`,
`type: "lafayette-guide-collection"`, `outputRoot`, `electionDate` and
`accessReview`. The latter pins normalized SHA-256 values for `robots`, `privacy`,
`governmentRobots` and `governmentPrivacy`, plus the reviewed `infoRobots: 404`
status. Obtain policy approval separately; collection does not grant reuse rights.
Policies are checked again on every run. New legal links, changed policy text or
new information-site robots rules stop preparation for review.

`electionDate: null` selects the earliest offered guide dated today or later,
using Lafayette's `America/Chicago` calendar date through local midnight and
daylight-saving transitions.
An explicitly offered current-year hub takes precedence over a newer-year hub;
an explicit ISO date selects its offered year for retained historical research.
Missing and expired
default guides produce a pending capture without a guessed edition or import.
The guide's visible link date, filename month/year and hub heading must agree.
Conflicting guide revisions for the same date require review.

The paired government source must be linked from the hub. The collector verifies
the existing Lafayette government policies and exact published millage-to-info
redirect chain before collecting the canonical question page. Changed publishers,
redirects or templates require review. This contract covers the current Lafayette
question-publication format, not arbitrary future government websites.

The maintained public-document transport enforces public-address HTTPS,
certificate validation, byte limits and access-challenge rejection. Collection
uses twelve requests at most, an eleven-second minimum request interval, a
twenty-second request timeout, a twelve-MiB PDF limit and a thirty-two-MiB total
limit. Each output root has process-held coordination. Use one shared output root
for this source. The command does not install a scheduler or activate a worker.

Each run creates a private external intake directory. Successful response bytes,
status, content type, exact redirect location, SHA-256 and acquisition time are
stored with durable writes. Raw headers, cookies and authentication material are
excluded. Failed runs preserve partial evidence and all earlier complete intakes.
Existing accepted data remains untouched. Retention requires separate planning.

A successful acquisition invokes the existing native
[Lafayette research preparer](lafayette-ballot-research.md), producing its pinned
plan, complete question reconciliation, fiscal facts and CSVs. Changed wording,
tax periods or malformed PDFs preserve captures and stop preparation. Source
capture clocks describe acquisition; they do not refresh editorial approval.

The output is research awaiting review. Final-ballot and amendment verification,
candidate qualification, geographic applicability, editorial review, publication,
automatic import and protected recurring activation remain separate. Existing
[measure-guide preparation](lafayette-measure-guides.md) can consume the resulting
pinned research plan after call documents and editorial review are supplied.
