# Official state candidate records

## Enabled sources

These adapters read official public candidate lists for the November 3, 2026
general election. They do not reconstruct nominees from primary results, FEC
registration, campaign-finance filings, or third-party forecasts.

| State | Official source | Format | Scope and qualification evidence |
| --- | --- | --- | --- |
| Delaware | [Department of Elections](https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_2026.html) | HTML | Federal, statewide, legislative, and local records; source qualification/withdrawal status retained. |
| Florida | [Division of Elections candidate download](https://dos.elections.myflorida.com/candidates/downloadcanlist.asp) | Public form POST, TSV | State-filed federal, statewide, legislative, and other offices; explicit status retained. Unopposed, withdrawn, defeated, deceased, removed, and unrecognized statuses are not presented as active ballot candidates. |
| Maryland | [State Board of Elections](https://elections.maryland.gov/elections/2026/general_candidates/2026_GG_statewide_candidatelist.html) | CSV | Federal, statewide, legislative, and local records; joint tickets and source status retained. The publisher's trailing empty header and literal quotes in unquoted fields are handled only in this adapter. |
| Michigan | [Department of State official candidate report](https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=GEN&electionYear=2026) | HTML | Federal, statewide, legislative, and judicial records; withdrawal/disqualification flags retained. Report totals count running mates individually; joint tickets remain one ballot entry. |
| New Mexico | [Secretary of State candidate list](https://candidateportal.servis.sos.state.nm.us/CandidateList.aspx?cty=99) | HTML | Federal, statewide, legislative, and local records; qualification status retained. Paginated or changed table layouts fail closed. |
| North Carolina | [State Board of Elections candidate lists](https://www.ncsbe.gov/results-data/candidate-lists) | CSV | Federal, statewide, legislative, and local filings. Exact election date required; cross-county duplicates removed. Listing alone does not establish final ballot qualification. |
| Virginia | [Department of Elections federal candidate list](https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-federal-offices/) | HTML | Federal offices only. The adapter does not claim local/state legislative coverage or infer a qualification flag absent from the table. |
| Wyoming | [Secretary of State 2026 election information](https://sos.wyo.gov/Elections/2026ElectionInformation.aspx) | CSV | Federal, statewide, legislative, and other filings; withdrawal dates retained. At-large congressional contests are statewide. |

The transport endpoints and election dates are maintained in
`back-end/src/state-ballot-sources.ts`. No provider key is required. Sources are
enabled by default; `STATE_BALLOT_LOOKUP_ENABLED=false` disables their lookup
enrichment without changing any existing provider or reviewed-guide workflow.

## Lookup contract

- `POST /api/location` and `GET /api/location/active` add
  `ballotContentPreviews` with official-source URL, election date, retrieval
  timestamp, and source candidate status. These are source records, not a
  reviewed, complete personal ballot or a published guide.
- Only statewide contests and exact supported Census congressional/state-house/
  state-senate district matches are rendered. Local records are not assigned to
  voters without a reliable local-ballot mapping. ZIP/IP centroid districts do
  not establish district eligibility: those lookups show statewide contests only.
- A state feed never promotes `guideAvailability`, replaces a reviewed guide,
  or suppresses another existing ballot provider. Unknown statuses fail closed.
- Every available contest and candidate is rendered, without first-four or
  first-six truncation. Source provenance and consequential coverage limitations
  stay visible outside collapsed matching details.
- Browser storage still strips ballot/provider content and street addresses.
  Reloaded limited-coverage results restore previews from the signed server
  lookup cookie only when state, area, input type, selection, ZIP, and district
  matches agree. A different tab's or location's cookie cannot relabel a list.
- All 50 states and DC have election-office resources through the
  [EAC state/local directory](https://www.eac.gov/voters/register-and-vote-in-your-state).
  Existing Georgia and Utah direct voter tools are preserved. Directory links
  are navigation, not candidate ingestion or a claim of full national coverage.

## Refresh, limits, and privacy

Each state is fetched on demand and cached in process for four hours. Concurrent
lookups share a pending fetch. Failed/invalid fetches are cached for five minutes,
then retried; expired or invalid data is not silently reused. No new daemon,
database, provider credential, or scheduled external job is required.

Requests use HTTPS with certificate verification, public-IP validation and pinned
DNS, a source-host allowlist on every redirect, a 12 MiB body limit, two redirects,
and bounded timeouts. Sources must return valid UTF-8 and expected election/schema
markers. Form data contains only fixed public election filters, never the
visitor's address or identity. Parser output excludes home/mailing addresses,
phone numbers, email addresses, voter IDs, and confidential-address fields.
Source failure logs contain only the state code.

Snapshots include a SHA-256 of the retrieved UTF-8 body and retrieval timestamp.
The diagnostic command emits metadata/counts, not candidates' contact details:

```sh
npm run states:check
npm run states:check -- NC FL MD
```

The 2026 adapters stop serving records at November 5, 2026 00:00 UTC, after all
U.S. November 3 polling days. A new election requires verified official endpoints,
date/schema fixtures, district/status tests, and an explicit registry update.
Do not automatically increment years or reuse a portal's default election.

## Investigated but not enabled

Research and public export checks on October 20-21, 2026 found these additional
sources or limitations. These states retain official-office navigation rather
than speculative or partial imported ballot lists.

| State | Official entry point | Remaining work or observed limitation |
| --- | --- | --- |
| Alaska | [Election candidates](https://www.elections.alaska.gov/election-candidates/) | Public source retrieval encountered a TLS/availability problem. Certificate checks were not disabled. |
| California | [Candidates](https://www.sos.ca.gov/elections/candidate-statements/) | Certified candidate material is largely PDF; no validated structured adapter in this change. |
| Colorado | [General candidates](https://www.sos.state.co.us/pubs/elections/vote/generalCandidates.html) | Workbook ingestion requires a separately validated schema/parser. |
| Indiana | [Election Division](https://www.in.gov/sos/elections/) | Official general candidate list discovered; not enabled without export/schema validation. |
| Iowa | [General election](https://sos.iowa.gov/general-election) | Direct public retrieval returned HTTP 403. |
| Kentucky | [Candidate filings](https://web.sos.ky.gov/CandidateFilings/) | Public office-specific lists discovered; not yet validated end-to-end across offices. |
| Louisiana | [Voter portal](https://voterportal.sos.la.gov/) | Public results interface identified, but no validated future-ballot data contract. |
| Minnesota | [Candidate filings](https://candidates.sos.mn.gov/) | Normal public export redirected to an anti-bot challenge. No bypass attempted. |
| New York | [Candidate list](https://publicreporting.elections.ny.gov/CandidatesList/CandidatesList) | Election selectors worked; candidate-data POST returned HTTP 403. |
| Oregon | [Candidate filing](https://sos.oregon.gov/elections/Pages/candidate-filing.aspx) | No verified general-election bulk schema in this change; finance registrations are not ballot qualification. |
| Rhode Island | [Voter Information Center](https://vote.sos.ri.gov/Home/) | Public candidate summary discovered; direct retrieval returned HTTP 403. |
| South Carolina | [Election Commission](https://scvotes.gov/) | Voter portal requires personal information/reCAPTCHA; no automated voter lookup or bypass attempted. |
| Texas | [2026 November general election](https://www.sos.state.tx.us/elections/laws/2026-november-general-election.shtml) | Certification material discovered; structured extraction not validated. |
| Vermont | [Elections](https://sos.vermont.gov/elections/) | Official general candidate information identified; no structured adapter validated in this change. |
| Washington | [2026 candidate list](https://voter.votewa.gov/CandidateList.aspx?e=899) | Public list has 887 entries over nine pages; normal export retrieval returned HTTP 403. The first page is not imported as a complete list. Default portal year was 2027, so explicit election selection is necessary. |

CTCL direct feeds, Ballotpedia, and Democracy Works remain prospective licensed or
permissioned integrations. No access requests, accounts, subscriptions, external
messages, or Google Civic bulk collection were performed.
