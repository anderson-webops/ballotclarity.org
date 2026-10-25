# Washington initiative document contract

`wa-measure-documents-2026` configures the official November 3, 2026 statewide
initiative publications. It extends the shared election-document collector, not
the separate candidate-export adapter or a personal-ballot lookup.

## Reviewed scope

The [Secretary of State index](https://www.sos.wa.gov/elections/voters/proposed-ballot-measure-information)
links the certification and government publications for IP26-645, IL26-001 and
IL26-638. The configuration includes fourteen exact PDFs: certification, three
ballot-title letters, three initiative texts, three Attorney General explanatory
statements, three Office of Financial Management fiscal statements and the
IP26-645 public-investment impact disclosure. Advocate arguments and rebuttals
are not included.

Collection pins the publisher, election, index markers, original document URLs,
robots rules, homepage policy links and privacy/reuse policy region. The
[publisher policy](https://www.sos.wa.gov/web-sites-privacy-policy) permits reuse
of most site information with attribution but excludes some third-party material.
This review is not blanket permission to reproduce campaign arguments, candidate
statements, photographs, other hosts or separately restricted downloads.

## Filename and completeness checks

The optional `encodedDocumentPaths` field contains exact reviewed URL pathnames.
Only `%20` and `%26` are supported, for published spaces and ampersands. Paths
must remain canonical and on the configured HTTPS publisher, without credentials,
query strings, fragments or ports. Encoded separators, traversal, double encoding,
unreviewed encoded paths and different hosts remain errors. URLs are neither
decoded nor rewritten before collection.

`minimumDocuments` is an optional reviewed completeness floor, bounded by
`maximumDocuments`; both must be positive safe integers no greater than 100.
Washington requires exactly fourteen documents. A missing government section
therefore cannot produce a successful collection merely because another PDF
remains. The existing seven source configurations retain their previous objects
and behavior. Unconfigured percent-encoded document paths remain blocked.

Future elections require a separately reviewed source configuration and access
review. Changed policy fingerprints, index links, election markers, paths or
document counts stop collection for review. Successful downloading does not
approve new facts or public visibility.

## Native data boundary

The existing state-measure preparation contract consumes an unpublished draft
with explicit document hashes, original capture times and reviewed page numbers.
It produces one statewide guide containing three measures in certified order:
IP26-645, IL26-001, IL26-638. Ballot choices are Yes and No, not a ranking or a
site recommendation. Short original summaries distinguish government explanations
from fiscal forecasts; no advocate argument is invented.

The income-tax forecast is approximately $11.4 billion in reduced revenue and
$150.5 million in administrative savings over SFY 2027–2031, not annual amounts.
The childcare-account loss is included in the revenue total, not added again.
The fiscal statement assumes only the scheduled income tax is affected. Other
taxes are not represented as automatically repealed.

Unresolved source inconsistencies remain explicit review holds: the sports
statement labels a one-time approximately $21,000 cost SFY 2026 despite assuming
a December 3, 2026 effective date; the income statement's federal savings table
and narrative differ by $8,000; and one explanatory introduction uses IL26-645
where the certification identifies IP26-645. Neither source bytes nor fiscal
years are silently corrected. Some local implementation costs remain unknown.

Raw documents and generated data remain outside Git and deployable source
archives. The review packet contains prepared data and checksums, not raw PDFs
or server-AI instructions. Import, publication, personal-ballot assignment and
production scheduling remain independent guarded operations. Statewide coverage
does not establish county, school-district, municipal or candidate coverage.
