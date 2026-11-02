# Boulder County candidate collection

## Official publication and scope

The [county directory](https://bouldercounty.gov/elections/information/2026-general-election-candidates-and-ballot-measures/)
publishes candidates, joint tickets, campaign links and explicit certified
write-ins. The separately retained November 2 original yields 84 candidate/office
entries: 27 statewide, three congressional, four state-senate, eight state-house
and 42 local/regional records. Seventy-three entries have campaign links; three
are explicitly certified write-ins. Party affiliation is absent from this
publication and remains absent from its normalized records.

The parser retains names, offices, printed districts, local jurisdictions and
candidate links. Public contact columns, addresses, email addresses, unrelated
site text, measure prose and judicial retention questions are not candidate
records. Joint tickets remain one printed choice. Municipalities remain distinct
even when two candidates share a name and office. Regent and transit records do
not establish congressional or personal ballot eligibility.

## Reusable collection

The [rolling election-information page](https://bouldercounty.gov/elections/information/)
supplies the election date. Its offered
[ballot-information page](https://bouldercounty.gov/elections/ballot-information/)
supplies the candidate publication. The source never derives an election merely
from a guessed filename or candidate year. Discovery and collection share one
bounded capture rather than downloading the same directory twice.

The fixed 2026 source is `co-boulder-2026`; future sources use
`co-boulder-general-YYYY-MM-DD`. Synthetic 2028 and 2030 publications exercise
printed-date discovery, offered-link validation and matching source creation.
Explicit future elections without a candidate publication are pending, not
empty accepted rosters. An accepted publication or candidate disappearing is a
review condition, not silent deletion.

The [privacy and use notice](https://bouldercounty.gov/privacy-policy/) and
[robots policy](https://bouldercounty.gov/robots.txt) were reviewed before
candidate acquisition. No automated-collection prohibition was observed in the
reviewed notice. This is not a blanket republication-license claim: the dataset
normalizes public factual names, offices and links rather than copying analyses,
arguments, biographies or the site's explanatory prose. Policy/link fingerprints
must continue to match. New terms, restrictions or publication formats require
review. Requests use ordinary HTTPS, the reviewed hostname, zero redirects,
one-MiB page limits and at least twenty seconds between requests.

Snapshots retain the actual candidate page, original capture time, content hash,
record count and matching collection-index hash. The server's existing external
data store holds accepted snapshots outside Git. Visitor reads do not acquire
publisher pages. The independent Colorado Secretary of State hold remains in
force; adding this county source does not approve another source or municipality.

## Acceptance boundaries

Tests cover candidate/table layouts, contact exclusion, explicit write-ins,
unprovided parties, same-name municipalities, date/URL/hash agreement, new legal
links, future discovery, pending publication, import/restart, offline stale reads
and accepted-state retention. Real-data/API/rendering acceptance and exact source
delivery evidence remain separate from protected host import, publication and
recurring scheduling. No source change itself activates a production collector.
