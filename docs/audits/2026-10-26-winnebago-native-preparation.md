# Winnebago County native candidate preparation

## Verified publication

On October 26, 2026, the independently published [county election page](https://wincoil.gov/departments/clerks-office/election-information)
offered a September 25 candidate list and a separate valid-write-in list for the
November 3 general election. The page offers a newer candidate list than the May
copy returned by search. Discovery must use the actual page, not a search-result
URL or a guessed filename.

Normal certificate-verified, public-IP-pinned requests returned the index and both
documents successfully. The county's `robots.txt` permits these paths. The
reviewed index/footer contains a copyright notice and a candidate-filing
legal-advice disclaimer, but no linked automated-access or factual-republication
restriction. This assessment is specific to county-published candidate facts. It
does not change the separate Illinois State Board of Elections crawling hold.

The five-page candidate PDF has SHA-256
`8c4af8e59fe422ed305c56b0c9a73035deb0122b2e2e6b7bb927b27886e58167`.
The one-page write-in PDF has SHA-256
`2bba9efff38d871ecc30c39ff87aca8ab7698ad7aad7156400500c4e8cf57383`.
All six rendered pages were reviewed against their native text.

## Reader checkpoint

`readWinnebagoCandidateDocument` accepts bounded local Poppler `pdftohtml -xml`
output at its default 1.5 scale. It prepares 58 regular candidate records from
60 printed people, combining only the two explicitly printed governor tickets.
The five pages contribute 20, 12, 8, 10 and 8 records. Scopes are 12 statewide,
4 congressional, 4 state-senate, 7 state-house and 31 regional/local records.

Party column labels, the independent-sheriff override, nonpartisan section,
vacancy labels, the unexpired county-board term, judicial retention and page
evidence remain distinct. Each judge has a separate named retention question,
not a shared competitive contest. Regional school and judicial boundaries remain local
descriptions, not statewide or verified address eligibility. Blank and
`NO CANDIDATE` cells do not become candidates or inferred vacancies. Contact
addresses, phone numbers and email addresses are excluded from prepared records.

The reader requires matching election/publication dates, printed page totals,
reviewed office vocabulary, column geometry and candidate styling. Unknown
layouts, missing ticket partners, malformed dates, duplicated identities and
unclassified text require review. Synthetic 2028 tests establish matching-date
parser reuse, not the existence of a future publication.

## Remaining collection work

This is an offline reader checkpoint, not a configured source, unattended import,
new public coverage, or an additional reusable collection family. The current
canonical data and data handoff remain unchanged. The separate write-in list
contains fourteen people and has not been imported. Its two explicit pairs must
not be generalized to unpaired governor/lieutenant-governor rows.

Collection integration still needs actual offered-election/link discovery,
reviewed policy fingerprints, bounded local XML extraction with original-PDF
checks, revision/disappearance handling, durable storage, and connected acceptance.
Page rendering and source review remain necessary; native text alone is not proof
of publication fidelity. Raw publications and source-recovery material stay out
of Git and release assets.

Other independent leads were assessed separately: Chicago offers a dated full
general-election list as well as a newer *filing* report, which must not be
substituted for that list. Honolulu's robots policy denies GPTBot at the root, so
its candidate pages were not fetched. Neither lead is enabled by this checkpoint.
