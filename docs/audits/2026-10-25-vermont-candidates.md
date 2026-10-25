# Vermont candidate workbook

Reviewed October 25, 2026 using normal pinned HTTPS. This is a candidacy source,
not complete town/school coverage or a personalized ballot.

## Official evidence

The [Secretary of State index](https://sos.vermont.gov/elections/election-info-resources/candidates)
explicitly names November 3, 2026 and links its
[qualified-candidate workbook](https://outside.vermont.gov/dept/sos/Elections_Division/election_info_resources/candidates/2026_general_election_qualified_candidates.xlsx).
The 286,268-byte original has SHA-256
`f646b3960ea5a305ad24122a6e4023b5a93fcd14eb46400952c8e68e0037e5fc`.
Candidate Listing has 16 columns and 2,619 candidacy rows; Selection Criteria
states September 23, 2026. Retrieval does not imply a later publisher revision.

There are 23 statewide/at-large records, 55 Senate, 241 House and 2,300 local
records, including 2,197 justices of the peace. These count candidacies, not unique
people or offices. All 58 retained South Burlington names also occur in this
workbook. Those older facts, IDs, files and direct source selection remain intact.

Literal compound party labels, terms and vote limits are preserved. Ten UNKNOWN
party entries become unset parties, not political classifications. Governor/LG
remain separate offices. No unopposed outcome or primary-result nomination is
inferred. Named/abbreviated legislative codes are not converted to Census numbers;
county/town records are not assigned to voters using residence columns.

The published Vote for Count becomes `voteLimit`, displayed as Vote limit, not an
inferred number of seats. Existing sources' explicitly reported `seats` retain
their original meaning.

The website column has 35 values: two emails are excluded and 33 public links
pass the existing public-link validator, preserving path case. Residential towns,
addresses, phones, emails and financial disclosures are excluded from normalized
facts. Raw/intermediate workbooks remain outside Git and runtime releases.

## Access and use

[SOS robots](https://sos.vermont.gov/robots.txt) and
[policy-host robots](https://www.vermont.gov/robots.txt) permit the relevant
wildcard paths, distinguish blocked training agents from permitted user-initiated
fetches, and specify one-second spacing for the latter. The
[document-host robots](https://outside.vermont.gov/robots.txt) request returns an
empty 404. Exact reviewed statuses and hashes are checked during discovery.

The linked [privacy notice](https://www.vermont.gov/policies/privacy) and
[policy index](https://www.vermont.gov/policies) were read in full; no additional
factual-record acquisition restriction was found. Photo and material-specific
rights remain separate. This adapter acquires no photographs, statements, tax
returns or financial disclosures and claims no blanket state-work license.

## Automation

`vt-sos-2026` binds the active, explicit general date and actually offered workbook,
not a guessed future filename or computed election date. Date-bound future source
IDs retain exact state/source allowlists. Same-date default priority favors the
statewide list; fallback/direct access preserves the narrower sample source.

The packaged Node reader runs in a bounded child process. ZIP metadata and actual
expanded lengths/CRCs, XML, dimensions, cells and output are checked. Formulas,
entities, active content, encryption, corruption and changed columns fail. Public
API reads use persisted facts without an external spreadsheet application.

Failures/cached reuse preserve successful import clocks. Changed unexpired
identities require review; validated empty future workbooks enter waiting, not a
successful empty import. Future tests are synthetic. Unfamiliar future offices
and presidential tickets require separate evidence-based review.

## Other source findings

- Massachusetts: normal homepage/election-index requests return the same 212-byte
  Incapsula protection document. No challenge script, candidate page or alternate
  identity was requested afterward.
- New Hampshire: the normal [robots request](https://www.sos.nh.gov/robots.txt)
  returns 403. No candidate page/workbook was requested afterward.
- Idaho: public general-election/filing pages link `https://run.voteidaho.gov/search`.
  That host's robots URL returns a 200 HTML application shell with no robots
  groups. Unattended-source policy review remains unresolved. No search/roster,
  account, voter, CAPTCHA or private endpoint was accessed afterward.

These findings preserve existing reviewed data and independent local sources.
