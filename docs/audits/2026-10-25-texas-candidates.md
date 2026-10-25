# Texas candidate certification automation

Reviewed October 25, 2026 through normal pinned HTTPS. The
[election index](https://www.sos.state.tx.us/elections/index.shtml) offers the
[November 3 general-election page](https://www.sos.state.tx.us/elections/laws/2026-november-general-election.shtml),
which separately links the final certification, declared write-ins and two
special elections. Only the regular-general certification set enters this family.
Future dates and document links must actually be published; yearly filenames and
election dates are not guessed.

## Reconciliation

The [main certification](https://www.sos.state.tx.us/elections/forms/2026-ballot-cert.pdf)
has one cover and 1,395 numbered report pages. Its SHA-256 is
`c13ffb4ebeee389fa9818d47b31f77b4e260ea6e6f5389cb7bf0f36d9b44d87c`.
All 17,918 repeated candidate claims reconcile across 254 county sections into
3,823 records. Each report page must retain its complete sequential numbering,
explicit election identity, county and common publisher revision. An unknown row,
party, office/ticket layout or incomplete county set requires review.

The [declared-write-in certification](https://www.sos.state.tx.us/elections/forms/2026-write-In-ballot-cert.pdf)
has SHA-256 `eece7f9fa38c65eef150d62ba0a142672dc187b7feb2f90bc330f9c5a226aa24`
and contributes seventeen separate records. The current original's OCR renders
the printed 31st Judicial District incorrectly and joins one candidate's initials
to the surname. The previously visually reviewed corrections apply only to this
exact document hash. New ambiguous OCR requires review rather than an inferred
candidate name or district.

All 3,840 existing facts and IDs remain exact, with both original PDF hashes.
These are source candidacy/context records, not unique people or complete personal
ballots. County contexts remain separate; repetition in every county does not
turn a county judge into a statewide office. The Fifteenth Court of Appeals is
kept distinct from regional appeals courts, with every statewide candidate checked
against every county. Named judicial district 1A is not converted into district1;
its original three county-context identities remain unchanged and unmatched to
voters. Local/regional labels do not establish personal eligibility. No single
candidate is inferred unopposed, elected or incumbent.

The publisher's August 28 report revision remains distinct from retrieval time.
The separate Senate District 22 and House District 93 special elections remain
outside this regular-general family. Later cycles use a general scope notice
rather than carrying those dated 2026 exclusions forward.

Texas's [official redistricting page](https://redistricting.capitol.texas.gov/apportionment)
identifies PlanC2333 for the 2026 congressional election while current officeholders
continue under PlanC2193 until January 2027. The lookup's district matches do not
carry a verified congressional-map vintage. Congressional records therefore remain
available in the directory but are withheld from address-based ballot previews
until mapping is independently verified. The latest configured safety restrictions
also apply to retained manual snapshots without rewriting their bytes. Later Texas
families inherit this boundary hold; candidate collection does not guess geography.

The [Census session-specific guidance](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html)
also identifies eight other states with changed 2026 congressional boundaries and
describes Missouri's corrected block-equivalency files separately from still-due
TIGER file regeneration. Broader election-versus-officeholder boundary provenance
remains follow-up work, not evidence of complete national personal-ballot matching.

## Acquisition boundary

The SOS robots URL returns an empty 200. The linked
[policy index](https://www.sos.state.tx.us/policies.shtml),
[privacy policy](https://www.sos.state.tx.us/privacy.shtml),
[disclaimer](https://www.sos.state.tx.us/disclaimer.shtml),
[link policy](https://www.sos.state.tx.us/linkpolicy.shtml) and
[public-records policy](https://www.sos.state.tx.us/records.shtml) were read in
full. Their exact relevant content and policy-link inventory are checked during
discovery. No additional factual-record acquisition prohibition was found on
those SOS pages. This is not a blanket license to reproduce photographs, seals,
other protected material or complete publisher documents.

The linking policy also refers to separate DIR agency guidance. That host's
robots excludes ChatGPT-User; the linked route returned an empty 404 during policy
investigation and supplies no accepted content or permission grant. The collector
uses only the SOS host, never DIR content. The separate Civix public-candidate
portal offers a JavaScript shell with reference-use content signals; it is not
used as this family's backend and no private API, account or voter endpoint is
queried.

Raw PDFs, intermediate text, page renderings and capture bodies remain external
to Git and release assets. The optional maintained Poppler worker retains the
12 MiB input, 4 MiB output and twelve-second bounds. Only the explicitly reviewed
Texas invocation accepts up to 2,000 pages; every other PDF source retains the
50-page default. Public persisted-data reads need no extractor. Original reviewed
Texas files remain readable without acquisition; accepting a replacement retains
a compatible original runtime/configuration/data recovery target.

## Future scope and other findings

Published regular even-year general pages and their actual certification links
support future cycles. Unknown presidential-ticket layouts, changed document sets
for an unexpired election and unfamiliar/empty certifications require review.
Future tests are synthetic, not observed future elections. Collection and cached
reuse preserve truthful import clocks; failures remain intervention evidence.

Ohio's ordinary SOS robots request returns 403, so no candidate page or document
was fetched from that host. Alabama's ordinary candidate index is available, but
its linked statewide policy host repeatedly resets the HTTPS robots connection;
no new certification PDF is acquired and no automatic Alabama family is enabled.
Existing reviewed facts and all earlier source holds remain intact.
