# Franklin County reusable candidate collection

## Source and scope

The [Board of Elections navigation](https://www.vote.franklincountyohio.gov/home)
offers separate year pages. Its [2026 general-election section](https://www.vote.franklincountyohio.gov/election-info/2026)
links both required publications:

- [General candidates, revised October 16](https://www.vote.franklincountyohio.gov/getmedia/e0a4ca45-6893-45c1-8190-87696f8804b4/2026-General-Candidate-List-5),
  two pages, SHA-256 `9e5bf3d402e67499caa918f900e35e3950beb6bd169ebb6cf1e7fb1ae7c4b62d`.
- [Updated 46-day FWAB notice](https://www.vote.franklincountyohio.gov/getmedia/352b644d-b348-447e-b60d-aa9b9193a297/2026-General-Form-No-120-FWAB-Notice-46-Day),
  thirteen pages, SHA-256 `dc69b2b2243507bc84e4dda490d77b8a1f2f96f61b7a90aeaa8f5a8c869bce29`.

Normal pinned HTTPS acquisition retains the previously reviewed bytes. The new
automatic source preserves all 78 accepted record IDs and fields: 26 statewide,
seven congressional, seven Senate, 25 House and thirteen local records. Eleven
registered write-ins, six printed governor/lieutenant-governor tickets, distinct
judicial terms, the Senate's unexpired term and 26 campaign websites remain exact.
No nominee, party, winner or personalized local eligibility is inferred.

## Independent completeness

The FWAB name column is enumerated independently of the candidate list. It
contains 79 named claims. All 78 active entries match the main list, while
Davide Cugini is explicitly marked withdrawn and remains separate supporting
evidence, not a new active record. Every main-list entry must match exactly once;
missing pages, unknown ordinary candidates, duplicate names and contradictory
withdrawals require review. Questions and the notice's later instructions are
outside candidate enumeration.

Two literal variants have reviewed, election/office-bound reconciliation:
`Meredith R. Lawson-Rowe` versus the notice's `Meredith Lawson-Rowe`, and
`Eboney C. Eldridge` versus `Ebony C. Eldridge`, both House District 5. The
main-list spelling remains canonical. Typographic apostrophes and the quoted
`"nonparty"` label do not create new people or inferred affiliations. New name
discrepancies remain review gates rather than guessed aliases.

The notice also supplies the main list's blank Gary Josephson write-in status
and Greg Levy's unclipped Other-party label. Source attribution remains 76 records
to the main list and two to the supplement. This count is computed from actual
supplemented fields, not fixed for future elections. Agency and candidate contact
columns are excluded from normalized candidate facts.

## Policy and transport

The county's robots endpoint has a reviewed 404 response, not a 200 policy file.
Only that exact reviewed absence is supported; redirects, denials, throttling,
server errors and newly returned rules stop for review. This source-specific
contract leaves the separate raw-document collector's stricter policy gate and
all other publisher holds intact.

Each discovery run validates the complete footer text/link inventory and every
privacy, legal, terms, copyright and accessibility link. Only the opaque fragments
on the two exact same-host contact controls are volatile. Their content is neither
decoded nor requested. Altered labels, contact paths, hosts, footer content or legal
controls fail review. No blanket reuse license is asserted.

Acquisition uses bounded same-host HTTPS, pinned public addresses, ordinary TLS,
zero redirects and serial completion-based spacing. Only actually offered general
controls are used; primary reports, private voter services and guessed year paths
are excluded. The worker uses an explicitly configured maintained Poppler
`pdftotext`. Persisted API reads remain converter-independent.

## Actual future publication and persistence

The [2027 index](https://www.vote.franklincountyohio.gov/election-info/2027)
offers a [twelve-page general schedule](https://www.vote.franklincountyohio.gov/getmedia/1d97d096-1d6c-4d47-83b6-92e41fcbd186/2027-GENERAL-SCHEDULE).
Its first page explicitly dates General Election Day as November 2, 2027, and all
page-number headings are validated. It supplies no candidate roster. Names in
office descriptions are never promoted into future candidates.

The reusable `oh-franklin-2026` family records this election as awaiting both
required candidate publications. Actual dates and links drive later collection;
synthetic 2028 fixtures are compatibility evidence only. Complete future reports
can become available without an annual source edit. Unsupported office/layout
changes and source disagreements preserve accepted data for review.

Catalogs and snapshots remain in external durable storage. The document-index
digest binds both URLs and original PDF hashes, so same-URL revisions invalidate
fresh caches. Cached reads preserve capture/import clocks. Missing accepted
publications preserve the prior catalog; pending data never replaces accepted
records. The first automatic replacement saves the exact reviewed envelope, and
backup or persistence failures retain accepted data without claiming an import.
Older-runtime compatibility depends on that retained reviewed data contract.

The registry now has 64 source definitions and 33 reusable families across 27
states. These are configuration/collection counts, not complete ballot coverage.
Originals, source comparisons and future-date evidence remain outside Git and
runtime release assets. Source delivery, private-data transfer, scheduling and
production acceptance remain separate outcomes.
