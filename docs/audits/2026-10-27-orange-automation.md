# Orange County automated qualified-candidate collection

## Source and access

The [county candidate page](https://ocvote.gov/candidates) links its canonical
[printable filing log](https://ocvote.gov/candidates/candidate-filing-log-printable-version).
The offered `2026 General Election` selector and reviewed script map to
`GEN2026/candlog.pdf`. The collector reads the mapping without executing page
scripts or fetching jQuery. Future years require the same reviewed mapping
and an original PDF whose explicit election date agrees with that context.
It never probes unoffered years or follows the legacy HTTP downgrade.
Expired reports remain in retained snapshots rather than being recollected on
each future run. Current offers are evaluated at the capture's own timestamp.

Ordinary public-address-pinned HTTPS requests on October 27 returned 200 for
robots, the root, candidates, the selector and the PDF. Reviewed robots and
footer/legal-link fingerprints are checked before document collection. A new
legal notice or changed access/layout/mapping requires review. The independently
blocked statewide California source remains held; this county source does not
replace or bypass it. The factual-reuse review and original-source digest are
documented in `2026-10-27-orange-candidate-proof.md`.

## Facts and applicability

The accepted report names the November 3, 2026 general election and qualified
candidates. All 430 named entries in 169 contests reconcile with the original
188-page native verification. `Num Cands` sums to 449 while qualified counts
and enumerated entries sum to 430. The difference produces no invented names.
Contextual incumbent rows and filing-extension asterisks do not create candidate
or incumbency facts. Ballot designations remain attributed source wording,
not independently verified biography. Qualification does not become a claim of
party nomination.

The original office and complete category heading must agree before mapping
congressional, state-senate or assembly numbers. Statewide offices use an explicit
reviewed set. Other local or district-limited offices remain available as
references without voter matching. The 43 clipped right-column district labels
are omitted from public records and never establish eligibility. Full source
headings remain in retained provenance and search, not repeated in public rows.

Candidate IDs are scoped to the source contest. Printed page clocks remain civil
values, including the distinct first-page clock. The maximum printed clock is
stored as source-as-of context without a timezone or invented publication date;
the retrieval timestamp remains separate. Retained claims include each original
qualification date and PDF page citation.

## Future collection and recovery

The `ca-orange-2026` family participates in the existing external catalog map,
cycle synchronization, document fingerprints and durable snapshot storage.
An explicitly offered future report returning 404 creates an awaiting-records
state, not candidate facts. Incompatible, denied or unavailable requests do not
fall back to archives or change a source's identity. Already accepted candidates
or a newer source clock cannot disappear silently. Changed policies, malformed
native proof, missing glyphs and contradictory counts preserve accepted data
for review. Unchanged document fingerprints avoid duplicate imports.

The bounded worker uses maintained absolute `STATE_BALLOT_PDFTOHTML`,
`STATE_BALLOT_PDFTOCAIRO` and `STATE_BALLOT_QPDF` paths. Native verification checks
actual font outlines, all rendered pages, painting order and meaningful
visibility. Persisted proofs distinguish rendered, visible and original
characters only for the reviewed clipped metadata column. Every other character
must reconcile exactly. Existing workers keep their prior bounds.

Public API and page reads use durable normalized facts after cache refresh and
restart, without publisher access or native tools. Raw pages, document artwork,
fonts and operator handoffs remain outside Git and release assets. The local
server packet contains normalized facts and provenance only. Receiving-host
receipt, approved recurring collection and public activation are separate
acceptance requirements, with existing privacy and recovery gates preserved.
