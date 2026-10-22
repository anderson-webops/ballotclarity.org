# Washington County, Arkansas publications

Local source/data review for November 3, 2026. No publication, deployment,
server transfer, credentials, permissions or saved configuration change.

## Source and access

The [county election page](https://www.washingtoncountyar.gov/government/departments-a-e/election-commission/november-3-2026-general-election-information)
contains federal/state/county, municipal, judicial-runoff and school-runoff
tables. The earlier normal public capture returned HTTP 200 at
2026-10-21T22:12:19.526Z, SHA-256
`4d02468d25908dd5faa9ae8c7a69eb5a128c4d5d39bea602915066e5c77987c1`.
Its full table contents and surrounding source legends were inspected.

The generic robots policy excludes scripts, administration and ASMX paths,
not this public publication. The page/link inventory disclosed no applicable
separate reuse policy. Original website design and contact columns are not
republished. This does not assert unrestricted downstream licensing.

One attempted refresh through the maintained, pinned, certificate-verifying
standard downloader returned HTTP 403. It was not retried, proxied or bypassed;
no User-Agent change, browser impersonation, private voter lookup or export
endpoint was used. The denial's cause is not inferred. Automatic retrieval is
disabled in the registry. The earlier permitted capture is reviewed and imported
with its original timestamp, not relabeled as a fresh live download.

## Reconciled records

All 182 named records are retained: 81 federal/state/county, 97 municipal,
two judicial-runoff and two school-runoff records. Scopes are sixteen statewide,
three Congress, four Senate, sixteen House and 143 local/regional. Thirteen
municipal blank separator rows and three main section headers are not people.
The municipal list contains fourteen jurisdiction labels, including the Beaver
Water District; its director is not reclassified as a city council member.

The main and municipal lists explicitly remain unofficial. The August 21 update
and passage of the August 20 certification deadline do not prove certification.
All records therefore remain listed, not qualified or elected. Printed honorifics
are retained in names, not converted into inferred incumbency. The 101 missing
party fields remain absent rather than becoming an invented party. Filing
numbers are raw source identifiers, not globally unique person identities;
the source reuses `260245` across different offices. County time-of-day values
under the same column are not misrepresented as identifiers.

The source's Office-Elect legend means unopposed in this election, not an outcome.
All 79 explicitly unopposed records remain available as listed records:

- Twenty have a source rule stating they are printed: eleven state offices,
  the Circuit Clerk and eight mayors.
- Fifty-eight have a source rule stating they are not printed: ten other county
  offices and 48 municipal clerk/attorney/council offices.
- One water-board director has no stated ballot-appearance rule. It remains
  unspecified; the city-office rule is not generalized to it.

Single-name numeric-order offices are not inferred unopposed. Ballot appearance
annotations are source facts, not personal voter eligibility. County, municipal,
ward, judicial and school records remain outside address-matched previews.
The judicial District 4/Division 2 runoff is not Senate District 4; Elkins school
District 10/Zone 2 is not House District 10 or 2. Four Springdale special-vacancy
records retain the printed special-election office without an invented term.

Literal `Pos.1`/`Pos. 1` and `Councill` variants remain visible source fields.
Only internal duplicate/order checks normalize those observed variants, not
candidate names, source labels or voter geography. Source-office label groups
are not represented as a verified count of distinct legal offices.

## Parser and persistence

The parser requires the configured election date, election-stage headings,
current-year certification notice, all four exact table schemas, all three main
sections, unofficial/unopposed/ballot-appearance legends and complete positive
ballot orders. Unknown parties/status annotations, missing names, duplicates,
filters, pagination, merged cells and empty/incomplete tables fail closed.
Only public facts are emitted; home addresses, email, postal contact fields and
private voter identifiers are excluded.

The reviewed snapshot binds its single document's URL, raw hash, original capture
time and contribution count. Its combined provenance fingerprint is
`aa86091f2b8cd4db54de74fa17d779056ede966f8f4951184dfb4b57eac3eddc`.
It requires import into the external `STATE_BALLOT_DATA_DIR`; no bundled fallback
or on-demand publisher request is permitted. Invalid imports cannot overwrite
accepted data. A reviewed future date/URL can use the same parser layout, but
that does not enable automatic updates or authorize bypassing publisher denial.

Ignored `back-end/data/state-ballots/arkansas-2026*` files contain the snapshot,
candidate export, source-row claims, inventory companion, manifest, archive and
checksums. Eight election-type inventory lines include three named local issue
topics; they are not complete question texts, application measures, legal
interpretations or voter assignments. Raw HTML stays only in ignored evidence,
not the factual archive or code release. Existing datasets remain unchanged.

## Validation and remaining work

Synthetic regressions cover every table/stage, literal data, source legends,
unopposed appearance exceptions, typed eligibility isolation, future-date
configuration, corrupt layouts, private-field rejection and external import
provenance. Final build/API/browser/import/roundtrip and preservation evidence
is retained in `.ai-work/runs/20261021-arkansas-public-tables/`.

Louisiana, Oklahoma and Rhode Island still lack integrated candidate datasets.
Maine remains municipal-only. Broader profiles/news, local eligibility, application
measures and legacy bundled-data migration remain unfinished. Final server-AI
operating instructions are still conditional, not an activation-ready handoff.
