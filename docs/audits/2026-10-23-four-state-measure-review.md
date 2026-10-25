# Four-state ballot-question review

This local cohort prepares thirteen questions for November 3, 2026. The five
guide drafts remain unpublished and unapproved for automatic import. They do not
establish a complete personal ballot, candidate coverage or production activation.

| Scope | Questions | Printed choices | Official evidence |
| --- | ---: | --- | --- |
| Wisconsin statewide | 3 | Yes / No | Town of Dane sample ballot, page 1 |
| North Carolina statewide | 3 | For / Against | Brunswick County House District 17 and 19 samples, page 2 |
| Rhode Island statewide | 5 | Approve / Reject | East Greenwich precinct 0901 sample, page 2 |
| Iowa statewide | 1 | YES / NO | Story County sample-ballot back and dated election index |
| Brunswick County, North Carolina | 1 | Yes / No | Both Brunswick County samples, page 2 |

The CSV has eighteen measure/source rows, not eighteen questions. Source and
compiled preparation retain document hashes, original capture times, page links
and unknown publication/update dates. The review archive contains five native
drafts and six prepared files, without raw ballot PDFs or private configuration.
Prepared data remains outside Git and application releases.

## Source fidelity

- Wisconsin's three state questions concern partial-veto tax authority, emergency
  restrictions on worship gatherings, and governmental discrimination/preferences.
  Four school-district questions on the retained sample remain unmapped. The Town
  of Dane publication is distinct from Sauk County's restricted website.
- North Carolina's amendments have no official amendment numbers on the samples.
  Source positions are not promoted into numbers. The 3.5% figure is a proposed
  constitutional ceiling, not an asserted current tax rate. The property-tax
  question supplies no numerical limit or implementation rules.
- Rhode Island authorizations are $275 million, $120 million, $100 million,
  $50 million and $55 million. Those amounts are principal authorizations, not
  total repayment costs. The housing allocation remains **at least** $25 million
  for homeownership production and **up to** $10 million for public housing.
- Iowa's two-thirds threshold covers the specified income/reserve-tax bills,
  not all taxes, and excludes local-option taxes. Its one-year challenge period
  concerns proper enactment. The dated official index binds the otherwise
  undated ballot back to this election. The new evidence resolves the old
  response-label gap without rewriting the earlier held companion.
- Brunswick County's $349,600,000 principal plus $196,167,552 estimated interest
  equals $545,767,552 estimated lifetime repayment. The $54.66 figure is an annual
  estimate per $100,000 of property value. The sample's highest-similar-debt-rate
  assumption over the prior twenty years remains attached to these estimates.
  No actual future borrowing rate or bond term is invented.

Only brief, original factual summaries are prepared. Ballot graphics, full
documents, campaign statements and arguments are not republished. General
copyright notices are not treated as blanket open licenses. Story County's
disclaimer wording is not treated as licensing every document on its site.

## Contract and validation

An optional `ballotOptions` pair retains printed labels while keeping compatible
internal `yes`, `no` and `review` decisions. Unknown, reversed, duplicate and
non-binary mappings are rejected. Measure headings/buttons and saved/printed
decisions use the same labels. Legacy drafts without explicit labels retain
their original sixteen-column CSV; new explicit-label exports add two quoted
columns. Geography and publication gates are unchanged.

The full unit suite passes 990 tests with two optional PostgreSQL skips. Lint,
type checks and both production builds pass. The initial sandbox-only unit run
could not open its loopback listeners; the accepted run uses the normal local
test permission boundary. No dependency, lockfile or release-candidate changes
are part of this cohort.

Connected verification covers four independent publication configurations,
twenty-four ZIP geography cases, all thirteen public measure payloads, the
unchanged primary and nine previous guides, and fifty retained candidate caches
with 25,031 rows. Twelve source/compiled standalone outputs are byte-identical.
The historical cache clock does not recertify old candidate data.

Twenty keyboard/save/reload/overview/print journeys pass in light/dark themes at
320/1280 widths. The 132 connected render/accessibility cases, twelve additional
long-location header cases at six widths, 48 core accessibility cases and 21
built-app checks pass. Ordinary content has no dropdowns. A genuine header
overflow exposed by the Brunswick County name is fixed by allowing the location
control to shrink within its existing layout, not by shrinking text or hiding
content. A regression test preserves the fixed-size theme control.

The first connected check expected internal statewide review wording rather than
the existing concise public limitation; the assertion now checks that actual
limitation. The next check exposed the real header overflow. Both diagnostics
remain retained with passing successors. No publication, live data import,
provider request during offline/connected replay, or production action occurred.

## Official publications

- [Town of Dane sample ballot](https://cdn.townweb.com/townofdane.gov/wp-content/uploads/2026/09/Sample-Nov-3-Ballot-Sauk.pdf)
- [Brunswick County House District 17 sample](https://brunswickcountync.gov/DocumentCenter/View/7771/House-District-17-PDF?bidId=)
- [Brunswick County House District 19 sample](https://brunswickcountync.gov/DocumentCenter/View/7772/House-District-19-PDF?bidId=)
- [East Greenwich precinct 0901 sample](https://www.eastgreenwichri.gov/DocumentCenter/View/9035/General-Election-Precinct-0901-Sample-Ballot-PDF)
- [Story County sample-ballot back](https://storycountyiowa.gov/DocumentCenter/View/18210/A_Back-of-Sample-Ballots)
- [Story County election index](https://storycountyiowa.gov/1754/General-Election-11032026)
