# Clark County candidate automation

## Source and scope

The [elections landing page](https://www.clarkcountynv.gov/government/departments/elections/)
provides the current election's explicit date, information-index link and fall
newsletter. The offered [2026 information index](https://www.clarkcountynv.gov/government/departments/elections/26g-info)
provides the independent candidate-table PDF. Discovery follows those actual
controls rather than requesting guessed future-year filenames or private APIs.

Seven serial normal HTTPS requests on October 25 recheck robots, homepage policy
links and the linked [county policy](https://www.clarkcountynv.gov/government/privacy-policy),
then retrieve the offered pages and two original PDFs. The original document
hashes remain those in the [table-reader audit](2026-10-25-clark-candidate-tables.md).
All 254 candidate rows independently reconcile across both publications, including
political labels, offices, terms and local sections. Eight nonperson ballot
options remain separate from candidates.

This is Clark County publication coverage, not all Nevada ballots, personalized
eligibility, statewide completeness or a guarantee of ballot qualification.
County document graphics and unrelated personal data remain outside source and
release artifacts. Factual regression fixtures are not runtime bootstrap data.

## Collection and persistence

The `nv-clark-2026` family supports explicitly offered regular November general
elections using the same reviewed controls and page structure. A printed date,
same-origin information index and two distinct allowed PDF links bind each
capture. Unknown controls, policies, geometry, party codes, office patterns or
cross-publication disagreements remain review exceptions. An offered election
without both publications records an awaiting-publication state, not an empty
ballot. A fresh discovered publication index invalidates that pending cache.

The optional bounded worker uses maintained absolute `STATE_BALLOT_PDFTOTEXT`
and `STATE_BALLOT_PDFTOCAIRO` paths. Requests are serial, paced by at least eleven
seconds and use the existing validating pinned public HTTPS transport. Converter
execution retains document, process, page, byte and geometry bounds. Public API
reads from accepted external snapshots need neither converters nor publisher
access.

Migration recognizes the exact earlier manual source configuration and preserves
its original hash-addressed envelope before replacing it. Candidate identity
matching retains every previously accepted ID and field; fourteen records also
retain explicit multi-vote limits. New identities are deterministic within their
source and election. Printed city, township, school, water-district and judicial
context never establishes a visitor's eligibility on its own.

Document URLs, hashes and capture times remain in external snapshots with a
document-index digest. Cached runs preserve the successful import and capture
clocks. Publication of source does not establish receiving-host activation,
scheduled collection, data acceptance or production recovery.

## Verification boundary

The observed 2026 originals establish current collection and reconciliation.
Synthetic 2028 tests exercise explicit future discovery, waiting for documents,
durable import, source separation and repeated cached reads. They do not claim
that any future publication or candidate has been observed. The original
acknowledged data files remain unchanged by source-side acceptance testing.
