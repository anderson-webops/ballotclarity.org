# Official state candidate records

## Enabled sources

These adapters read official public candidate lists for the November 3, 2026
general election. Raw primary vote totals, FEC registration, campaign-finance
filings and third-party forecasts are not used to guess nominees. Explicit
nomination flags in an official general-election database are checked alongside
its filing method, withdrawal and inactive-status fields.

| State | Official source | Format | Scope and qualification evidence |
| --- | --- | --- | --- |
| Arkansas | [Washington County general-election and runoff lists](https://www.washingtoncountyar.gov/government/departments-a-e/election-commission/november-3-2026-general-election-information) | Reviewed public HTML; external import only | 182 records across all four tables: sixteen statewide, three Congress, four Senate, sixteen House and 143 local/regional. The first two lists are explicitly unofficial. Office-Elect is unopposed shorthand, never an election outcome. All 79 explicitly unopposed records remain listed; the source says twenty are printed, 58 are not printed and one water-board record has no stated ballot-appearance rule. No single-name office is inferred unopposed. Judicial/school runoffs and four municipal special-vacancy records remain distinct. Literal honorifics, party omissions, source-label variants and filing identifiers are preserved without inferring incumbency, party or personal eligibility. The standard pinned downloader returned HTTP 403; no retry or identity change bypasses it. The earlier permitted dated capture supplies this reviewed import, not a fresh automatic fetch. |
| Georgia | [Fulton County general-election publications](https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/sample-ballots) and [PSC election scope](https://georgia.gov/organization/public-service-commission) | Two reviewed PDFs and a supporting official scope page; external import only | 98 records in 51 offices: 22 statewide, six Congress, sixteen Senate, 37 House and seventeen local, including two explicitly qualified county write-ins. All six PDF pages were visually reviewed. PSC districts are residency labels; their elections are statewide. The District 4 unexpired term and literal incumbency/party labels are retained without inventing a remaining term, party, unopposed outcome or local eligibility. State/federal write-in names are not included; the state host's denied policy entry is not bypassed. Seven question texts remain external companion material, not application measures. |
| Idaho | [Cassia County general-election samples](https://www.cassia.gov/sample-ballots) | Three reviewed PDFs; external import only | 39 records in nineteen offices: 22 statewide, five Congress, two Senate, two House and eight local. All four pages were visually reviewed. House District 27 seats A/B remain distinct; one named magistrate retention question remains local, and Yes/No are not people. Pro-Life is one printed candidate with a former-name annotation. County terms and literal party codes are retained; blank write-in spaces and single-name offices do not create candidates or unopposed outcomes. Six question texts with ten source occurrences remain external companion material; school/fire precinct labels do not establish eligibility. |
| Washington | [Selected general-election public candidate list](https://voter.votewa.gov/CandidateList.aspx?e=899) | Automatic, bounded HTML pagination | All 887 records across nine normal public pages: ten statewide Supreme Court choices, twenty Congress, 41 Senate, 184 House and 632 local/regional records. Active is retained as filed, not qualification, an outcome or retention. Literal party preferences, positions, general-election markers, terms, ballot order and public record identifiers are preserved. All filters, form targets, election/date identity, headers, page order/counts and complete totals are checked; no denied export is retried. Some local district labels are only County or otherwise incomplete, so no personal local match is inferred. |
| Wisconsin | [Town of Dane general-election publications](https://townofdane.gov/2026/09/16/november-3-2026-general-election-information/) | Three reviewed sample PDFs and a Type B notice; external import only | Fifteen candidate/ticket records across nine offices, reconciled from 45 repeated choices and all eight pages. Nine statewide, one CD 2, one Senate 27, two Assembly 81 and two Dane County records. Joint governor/LG tickets and literal party labels are retained. Single-candidate offices are not inferred unopposed. Seven question texts, including four school questions, are retained externally rather than assigned to voters. Overlapping ward labels do not establish school eligibility. |
| Arizona | [Pima Elections](https://www.pima.gov/elections), [Yavapai public ballots](https://www.yavapaivotes.gov/Elections/Sample-Ballots-Voter-Guides) and [2026 court roster](https://www.azcourts.gov/Portals/2/148/documents/2026RetentionJudges.pdf?ver=0M7pj20luCy11f9iYgrtnw%3D%3D) | Six reviewed, dated/supporting PDFs; external import only | 207 records in 94 offices: 23 statewide, ten congressional, sixteen Senate, thirty House and 128 local/regional. Eighteen official write-ins and three explicit withdrawals are preserved. Four visible governor/LG tickets retain mixed party codes; two incomplete write-in tickets stay outside application choices. Fourteen dated Pima retention records have explicit year-only roster corroboration; no extra regional judge is imported with an invented date. The clipped South Tucson vote limit is omitted. Twenty-seven question extracts remain review-required companion material, not application measures. |
| Tennessee | [Williamson County general-election sample ballot](https://www.williamsoncounty-tn.gov/2173/Sample-Ballots) | Reviewed, dated four-page image-only PDF; external import only | 55 records in fourteen offices: 25 statewide, eight congressional, two Senate, eight House and twelve municipal. All four pages were visually reviewed; OCR alone misses names and is not accepted provenance. The sample explicitly prints November 3, 2026. Preserves the two congressional districts as 5 and 9, literal party/independent labels, quoted names and municipal vote limits. Congressional address matching is withheld pending verification of the May 2026 redistricting against the provider's boundary vintage. Three constitutional-amendment identifiers and YES/NO choices are retained separately, not application measures. Local eligibility and later amendments remain unverified. |
| Montana | [State public general-election filings](https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx?e=450002987) | Automatic, selected public CSV export | 272 records: 269 FILED and three WITHDRAWN, including seven statewide, seven congressional, fifty Senate, 191 House and seventeen regional judicial/commission records. Covers both congressional districts, all 100 House districts and the 25 Senate districts in this published general list. The exact general election, state jurisdiction, public export control, complete page/export count and incumbent legend are validated. Ninety incumbent markers do not imply winners or unopposed outcomes. Mailing addresses, emails, phones and ambiguous email/web columns are excluded. One judicial entry is UNEXPIRED with a listed nominal six-year term; no remaining term is calculated. |
| Kansas | [Johnson County current general-election candidates](https://www.jocoelection.org/events-elections/november-3-2026-general-election) | Automatic, bounded public HTML; explicit election ID 6023 | 98 records: 23 statewide, three CD 3, 45 House and 27 local/regional. All twenty result groups are checked, including paired governor/LG tickets and eighteen distinct judicial retention seats. Exact general-election selection, unfiltered controls and complete non-paginated results are required. Preserves 31 incumbent markers and 48 explicitly published campaign links; personal contacts and residential cities are not imported. The portal's Tara A. Combs spelling is retained with a local note that the revised notice says Tara A. Combes. |
| Nevada | [Clark County current general-election publications](https://www.clarkcountynv.gov/government/departments/elections/26g-info) | Two reviewed PDFs; external import only | 254 records in 142 offices, reconciled from all ten candidate-list pages and all nine candidate pages in the newer fall newsletter. Includes eighteen statewide, eleven congressional, twelve Senate, 57 Assembly and 156 local/regional records. Governor/LG are separate elections. Ordinary judicial elections are not retention or inferred unopposed outcomes. Eight non-person "None of these candidates" options remain factual companion records, never people. Printed terms, unexpired terms, multi-seat limits and regional/local jurisdictions are retained. |
| Minnesota | [City of Independence general-election samples](https://www.ci.independence.mn.us/government/elections) | Four reviewed, dated PDFs; external import only | 78 candidate/ballot-area records from 261 printed claims across all eight pages. Includes 23 statewide, two congressional, two Senate, two House and 49 local records. Preserves three governor/LG tickets, ordinary judicial elections and school vote limits. House 37A is not bare district 37. The Westonka sample repeats common candidates and contributes zero new records; its full provenance remains required. School, park, county and district-court records are not assigned to voters. One constitutional question is retained in a separate factual companion, not yet application measures. |
| Iowa | [Story County certified general-election candidate list](https://storycountyiowa.gov/1754/General-Election-11032026) | Reviewed, dated ten-page PDF; external import only | 102 certified records: eighteen statewide, two congressional, two Senate, eight House and 72 local/regional. Keeps governor/LG tickets together and each judge's retention question separate. Printed incumbent/appointed markers do not imply election outcomes; incumbent supervisors were elected at-large, not to the new districts. Four empty office blocks do not create candidates. Visible 2026 headings govern, not stale 2022 PDF metadata. One constitutional question remains in a separate factual companion. Residential addresses, phones and emails are excluded. |
| New Hampshire | [Bristol](https://www.bristolnh.gov/m/newsflash/home/detail/116), [Goffstown](https://www.goffstownnh.gov/325/Elections) and [Alton](https://alton.nh.gov/absentee-sample-ballot-november-3-2026-state-general-election/) official town sample ballots | Three reviewed, dated PDFs; external import only | 76 candidate/ballot-area records from 92 printed party lines across all six pages. Includes six statewide, seven unmapped congressional, six unmapped Senate, twenty-two House and thirty-five local/regional records. Preserve four Republican/Democratic fusion records and multi-seat House vote limits. Five county-named House districts are not converted into bare Census numbers. Unprinted regional districts remain unmatched. Four ballot questions are retained in a separate external factual companion, not yet application measures. The directory links all three original documents. |
| Maine, selected towns | [Orono election publications](https://www.orono.org/304/Elections-Voting-Information), [Winthrop samples](https://www.winthropmaine.gov/m/calendar/event/detail/1249), [Bangor municipal sample](https://www.bangormaine.gov/204/Sample-Ballots) | Reviewed, dated image/PDF set; external import only | 63 records: five statewide, two CD 2, four Senate, five House and 47 local/regional. The fifteen earlier Bangor records and IDs are preserved. Senate and Congress retain ranked-choice designation. Two Orono House styles, Winthrop's separate partial school term and library seats remain distinct. No party, unopposed status or local eligibility is inferred. The composite source identity requires a new import; original Bangor files remain unchanged. |
| Oklahoma, Woodward County | [County general-election samples](https://woodward.okcounties.org/departments/election-board/voting-elections-links) | Reviewed, dated PDF set; external import only | 40 records: 25 statewide, two CD 3, two House 58, two county assessor and nine judicial retention. The second general sample adds House 58; the city document contributes a proposition, not candidates. Retention names remain non-address-matched pending independent electorate verification. No April filing-book qualification or straight-ticket placeholder is imported. |
| Rhode Island, East Greenwich | [Five precinct sample ballots](https://www.eastgreenwichri.gov/192/Voter-Registration-Elections) | Reviewed, dated PDF set; external import only | 33 records: fifteen statewide, two CD 2, one Senate 35, two House 24/30 and thirteen municipal. Precinct 0903 supplies House 24; other precincts supply House 30. All five originals are required despite repeated candidates and zero-contribution documents. The literal Micholas A. Credle spelling and multi-seat limits are retained without inferring unopposed outcomes. |
| Vermont | [South Burlington official general-election sample ballots](https://www.southburlingtonvt.gov/211/Elections-Voting) | Five reviewed, dated PDFs; external import only | 58 candidate/contest records in 19 contests, reconciled from 266 printed rows across all ten pages. Includes 23 statewide candidates, including the at-large U.S. House race; six House candidates in five named districts; six Senate and 23 local candidates. Named House districts are not converted into Census numbers. Senate/local eligibility is withheld without an authoritative mapping. Printed combined party labels and separate governor/LG offices are preserved. Two constitutional proposals are retained in an external factual companion, not yet in the application. |
| New York | [Monroe County Board of Elections certification](https://www.monroecounty.gov/elections) | Reviewed, dated PDF; external import only | 106 candidate/contest records across 61 contests, reconciled from 194 printed party lines on all eight candidate pages. Eight statewide, two congressional, eight Senate, eighteen Assembly and seventy local records. Preserves 80 fusion records, separate governor/LG sections and distinct council/trustee terms. County publication is not statewide completeness. No bundled dataset or automatic OCR/crawl fallback is used. |
| Ohio | [Franklin County Board of Elections general candidate list and FWAB notice](https://www.vote.franklincountyohio.gov/election-info/2026) | Reviewed, dated county PDF snapshot | 78 records: 26 statewide, seven congressional, seven Senate, 25 House and thirteen local. Reconciles eleven registered write-ins: ten marked in the October 16 list plus Gary Josephson's explicit FWAB designation despite the list's blank cell. The notice also supplies Greg Levy's unclipped Other-party label. Preserves six governor tickets, distinct judicial term dates, the US Senate unexpired term and 26 published campaign links. District coverage is limited to Franklin County; county/appellate courts are not assigned to voters. Other blank or uncertain party cells are not guessed. |
| Massachusetts | [Cambridge Election Commission candidate list](https://www.cambridgema.gov/departments/electioncommission/news/2026/10/november32026stateelectionvotingoptions) | Reviewed, dated municipal PDF snapshot | 32 records: fifteen statewide, two congressional, four Senate, six House and five council/county records. Preserves printed joint-ticket labels and full named legislative districts, including the distinct Middlesex & Suffolk and Suffolk & Middlesex districts. No numeric district conversion or statewide district completeness is inferred. Other districts, local contests and complete write-in coverage remain missing. |
| Oregon | [Secretary of State directive and Multnomah County ballot reports](https://multco.us/info/november-3-2026-general-election) | Reviewed, dated state/county PDF snapshot | 279 records from the full state-filed general-election ballot statement and both Multnomah candidate reports. Reconciles 338 claims and 59 exact overlaps without replacing conflicting evidence. All six congressional districts, fifteen Senate contests and all sixty House districts are represented. Preserves 63 fusion records, four judicial incumbent designations and 112 regional/local records. Other counties' county-filed contests are absent; regional/local records stay out of voter previews until jurisdiction mapping exists. The separate state search blocks access; no access/CSRF/identity workaround is enabled. |
| Connecticut | [Secretary of the State town sample ballots](https://portal.ct.gov/sots/election-services/town-ballots/2026-november-town-election-ballots) | Reviewed, dated PDF-grid snapshot | 709 candidacy/context records from 134 published town PDFs and all 509 pages. Retains 15,517 printed party-line claims separately, coalesces fusion endorsements and keeps governor tickets paired. Covers all five congressional districts, all 36 Senate districts and 139 of 151 House districts. Town probate, registrar, school-board and town-meeting entries remain local and are not assigned to voters. Some towns and declared write-ins are missing; the rolling index is not statewide completeness. |
| Alaska | [Division of Elections general candidates](https://www.elections.alaska.gov/candidates/?election=26genr) | Reviewed, dated three-page HTML snapshot | 155 certified candidacy/retention records, including six certified write-ins, all forty House districts and ten Senate districts. Forty-two identical repeated judicial claims are reconciled. The state Supreme Court retention is statewide; twenty lower-court questions remain regional. Tickets and declared registration labels are preserved. Default Node TLS validation fails, so no automatic retrieval or trust override is enabled. |
| South Carolina | [State Election Commission public candidate search](https://vrems.scvotes.sc.gov/Candidate/CandidateSearch?electionId=22596) | Anonymous public HTML search | 1,443 general-election filing records, including 1,175 active claims. The unfiltered result also contains primary defeats, withdrawals, disqualifications and deaths, which are retained as evidence but withheld from previews. Four active governor/running-mate tickets remain paired. Original candidate IDs, official detail links and race counties are preserved. This is separate from the private voter/CAPTCHA portal. |
| Pennsylvania | [Department of State candidate database](https://www.pavoterservices.pa.gov/ElectionInfo/ElectionInfo.aspx) | Reviewed, dated HTML snapshot | 442 nomination records, including five withdrawals and one inactive cross-filing. The full selected general-election database also contains primary losers and party committee records; these are excluded using explicit nomination flags and filing types, not reconstructed vote totals. A primary write-in nomination is not mislabeled a general-election write-in. The normal importer receives a wrapper without election controls, so automatic retrieval is disabled. |
| West Virginia | [Secretary of State candidate portal](https://candidates.wvsos.gov/regular) | Reviewed, dated JSON snapshot | 564 exact November 3 general-election records, including twelve write-ins, twelve nonpartisan records, 311 local records and 108 safe source-published website links. Both complete anonymous public result sets are reviewed; primary and earlier municipal elections are excluded. State-filed judicial races remain regional. Default Node TLS validation fails on the publisher chain, so no automatic retrieval or trust override is enabled. |
| California | [Secretary of State certified general candidates](https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026) | Reviewed, dated PDF snapshot | 388 records: 324 candidates with their certified ballot designations and 64 individual judicial-retention questions. Only the two Supreme Court questions apply statewide; appellate and equalization districts remain local. The four single-candidate Assembly contests are preserved. |
| Indiana | [Election Division general-election workbook](https://www.in.gov/sos/elections/) | Reviewed, dated XLSX snapshot | 7,392 records from 7,394 candidate rows, including 19 declared write-ins and 19 rows without filing dates. Only two identical source-row repeats are removed. Unknown party fields remain unset. Filings are not promoted to certified ballot access; county, township, town, school and other local records are retained for export without inferred voter eligibility. |
| Texas | [Secretary of State general certification and declared write-ins](https://www.sos.state.tx.us/elections/laws/2026-november-general-election.shtml) | Reviewed, dated PDF snapshot | 3,840 records, including 17 declared write-ins. All 1,395 report pages and 254 counties are reconciled; repeated state/district entries are deduplicated without collapsing county jurisdictions. The statewide Fifteenth Court of Appeals is distinguished from regional courts. Separate Senate District 22 and House District 93 special elections are not included. |
| Alabama | [Secretary of State certifications and amendments](https://www.sos.alabama.gov/alabama-votes/voter/election-information/2026) | Reviewed, dated PDF snapshot | 300 records: 114 Democratic, 180 Republican and six independent. Reconciles the August 28 and September 2 amendments, including House 51, Senate 25 and special-primary congressional nominees. Party executive-committee elections and superseded attachments are excluded. Late amendments do not establish what was printed on a ballot. |
| District of Columbia | [Board of Elections general, ANC and write-in lists](https://dcboe.org/elections/2026-elections) | Reviewed, dated PDF snapshot | 436 records, including 44 registered write-ins and two explicitly withdrawn ANC candidates. Districtwide, ward and ANC-SMD jurisdictions remain separate. Federal and shadow-delegation contests require U.S. citizenship; ward/ANC eligibility is not inferred from ZIP or legislative districts. |
| Colorado | [Secretary of State official general list](https://www.sos.state.co.us/pubs/elections/vote/generalCandidates.html) | HTML | Federal, statewide, legislative, judicial, and other official records; strike-through withdrawals and certified write-ins retained. Education/regent district numbers are not assumed to establish voter eligibility. |
| Delaware | [Department of Elections](https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_2026.html) | HTML | Federal, statewide, legislative, and local records; source qualification/withdrawal status retained. |
| Florida | [Division of Elections candidate download](https://dos.elections.myflorida.com/candidates/downloadcanlist.asp) | Public form POST, TSV | State-filed federal, statewide, legislative, and other offices; explicit status retained. Unopposed, withdrawn, defeated, deceased, removed, and unrecognized statuses are not presented as active ballot candidates. |
| Hawaii | [Office of Elections candidate reports](https://elections.hawaii.gov/candidates/candidate-reports/) | Public CSV export | The complete selected 2026 report is checked against its declared row count. Only explicit `In General` records are assigned to November 3; issued, primary, withdrawn, void, already-elected, and merely filed records are not promoted into general-election claims. Safe source-published campaign sites are retained. |
| Illinois | [State Board of Elections candidate filings](https://www.elections.il.gov/ElectionOperations/CandidateFilingSearch.aspx?ID=sejIrI%2BQmww%3D) | Bundled dated snapshot from public TSV | Publisher robots rules disallow crawling, so automatic retrieval is disabled. The captured retrieval time/hash remain unchanged on reload. Exact general date/type, explicit joint-ticket brackets, ordinal legislative districts and inactive statuses are preserved. Regional judicial districts never become statewide eligibility. |
| Kentucky | [Secretary of State candidate filings](https://web.sos.ky.gov/CandidateFilings/) | Five linked HTML pages | Federal and state legislative offices, plus the published closed-status list. All pages must select the same 2026 general election; incomplete document sets fail closed. |
| Maryland | [State Board of Elections](https://elections.maryland.gov/elections/2026/general_candidates/2026_GG_statewide_candidatelist.html) | CSV | Federal, statewide, legislative, and local records; joint tickets and source status retained. The publisher's trailing empty header and literal quotes in unquoted fields are handled only in this adapter. |
| Michigan | [Department of State official candidate report](https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=GEN&electionYear=2026) | HTML | Federal, statewide, legislative, and judicial records; withdrawal/disqualification flags retained. Report totals count running mates individually; joint tickets remain one ballot entry. |
| Mississippi | [Secretary of State qualifying list](https://www.sos.ms.gov/content/CandidateQualifying/default.aspx) | Public CSV export | Federal, judicial, and legislative special-election records explicitly dated November 3. Judicial places remain separate. Six State Senate 34 entries have no election date in either the page section or export and are withheld pending separate dated evidence. |
| Missouri | [Secretary of State certified general candidates](https://www.sos.mo.gov/CMSImages/ElectionCandidates/2026GeneralElectionCertifiedCandidates.pdf) | Reviewed, dated PDF snapshot | 425 certified records. Retention candidates are individual questions; appellate regions, judicial circuits and divisions remain local. Only the Supreme Court retention and statewide auditor contest apply statewide. |
| Nebraska | [Secretary of State final general and retention lists](https://sos.nebraska.gov/elections) | Reviewed, dated PDF snapshot | 569 records: 521 candidate rows plus 48 retention filings. The unicameral Legislature maps to state-senate geography. Only explicitly statewide judicial retention is statewide; education, power, natural-resource and judicial districts remain local. |
| New Jersey | [Division of Elections official general candidates](https://www.nj.gov/state/elections/election-information-2026.shtml) | Reviewed, dated PDF snapshot | Federal only: four Senate candidates and 35 House candidates. The September 4 District 7 amendment replaces that district's earlier entries rather than duplicating them. Separate special-election and primary lists are excluded. |
| New Mexico | [Secretary of State candidate list](https://candidateportal.servis.sos.state.nm.us/CandidateList.aspx?cty=99) | HTML | Federal, statewide, legislative, and local records; qualification status retained. Paginated or changed table layouts fail closed. |
| North Carolina | [State Board of Elections candidate lists](https://www.ncsbe.gov/results-data/candidate-lists) | CSV | Federal, statewide, legislative, and local filings. Exact election date required; cross-county statewide/district duplicates removed while local county identities remain distinct. Listing alone does not establish final ballot qualification. |
| North Dakota | [Secretary of State contest/candidate list](https://vip.sos.nd.gov/candidatelist.aspx?eid=348) | Public search form, HTML | Federal, statewide, legislative, and local records. The normal unfiltered search is posted with its observed public form tokens. Unnamed vacancies are not candidates; source county jurisdiction is retained for local records. |
| South Dakota | [Secretary of State general candidate list](https://vip.sdsos.gov/candidatelist.aspx?eid=774) | Public CSV export | Full export count must match the paginated report total. Withdrawal annotations are retained, at-large Congress is statewide, and local county identities remain distinct. Missing local ballot order is recorded, not treated as proof of ballot qualification or an inferred unopposed outcome. |
| Utah | [Lieutenant Governor candidate filings](https://vote.utah.gov/2026-candidate-filings/) | HTML | All five federal/legislative/school/judicial tables are required. Only `Election Candidate` and `Write-In` records are used for the general election. Primary/convention losers and other inactive filing history are excluded. School and local judicial districts are not legislative eligibility; statewide appellate/supreme retention questions remain statewide. |
| Virginia | [Department of Elections federal candidate list](https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-federal-offices/) | HTML | Federal offices only. The adapter does not claim local/state legislative coverage or infer a qualification flag absent from the table. |
| Wyoming | [Secretary of State 2026 election information](https://sos.wyo.gov/Elections/2026ElectionInformation.aspx) | CSV | Federal, statewide, legislative, and other filings; withdrawal dates retained. At-large congressional contests are statewide. |

Primary transport endpoints and election dates remain in
`back-end/src/state-ballot-sources.ts`; additive county sources and the combined
registry are in `back-end/src/state-ballot-registry.ts`. No provider key is required. Sources are
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
- California's `ballotDesignation` is the short description on the certified
  candidate list, not an independently verified biography. It is rendered as
  "Ballot designation" and retained in the factual transfer.
- West Virginia's public candidate identifier and raw district/division/area
  labels are retained for reconciliation. They are not Census eligibility or
  residential-address fields. The source's broad `STATEWIDE` category denotes
  state-filed offices and is never used to make regional courts statewide.
- Browser storage still strips ballot/provider content and street addresses.
  Reloaded limited-coverage results restore previews from the signed server
  lookup cookie only when state, area, input type, selection, ZIP, and district
  matches agree. A different tab's or location's cookie cannot relabel a list.
- All 50 states and DC have election-office resources through the
  [EAC state/local directory](https://www.eac.gov/voters/register-and-vote-in-your-state).
  Existing Georgia and Utah direct voter tools are preserved. Directory links
  are navigation, not candidate ingestion or a claim of full national coverage.

## Refresh, limits, and privacy

Automatic sources are fetched on demand and cached for four hours. Concurrent
lookups share a pending fetch. Failed/invalid fetches are cached for five minutes,
then retried; expired or invalid data is not silently reused. No new daemon,
database, provider credential, or scheduled external job is required.

### Persistent server data

`STATE_BALLOT_DATA_DIR` enables an absolute local directory outside the application
checkout/release. Automatic fetches save only validated public candidate facts and
source fingerprints, never the downloaded contact-bearing response or credentials.
Atomic replacement preserves the previous file if an update fails. Restarted
services reuse unexpired records with their original capture time. Invalid,
future-dated, expired or configuration-mismatched files are not presented as fresh.
Without this setting, automatic sources retain only their in-memory cache and
reviewed sources remain unavailable. All thirty-three reviewed sources require an
explicit external import; there is no bundled fallback. Storage failures are
logged without hiding otherwise valid fresh automatic data.

`STATE_BALLOT_CACHE_TTL_MS` controls automatic-source freshness (default 14,400,000;
maximum one day). Reviewed imports are reread on request, so new, corrected or
restored imports appear without a restart or a cache-clock advance. Their original
capture dates and the existing post-election expiry still apply.
`STATE_BALLOT_ENABLED_STATES=UT,HI` optionally limits the enabled registry entries;
leave it unset for every configured state. `STATE_BALLOT_ENABLED_SOURCES` is an
optional comma-separated allowlist of exact source IDs. It intersects with the
state allowlist; unknown IDs, empty entries and sources outside enabled states
fail at startup. Unset both for all fifty-two configured sources. To use only the
reviewed county material without requesting either primary host, select
`nc-brunswick-samples-2026,nm-santa-fe-samples-2026` explicitly.
The reviewed registry retains election dates, URLs, parser formats and publisher
restrictions. A new election, publisher format or changed automation policy still
requires review; this is not unrestricted discovery or automatic OCR approval.

With the service's protected environment already supplied, the compiled command is:

```bash
node back-end/dist/manage-state-ballot-data.js refresh WA MT KS SC UT MS SD HI CO KY ND VA MI WY MD FL DE
node back-end/dist/manage-state-ballot-data.js import /path/to/reviewed-snapshot.json
```

`refresh` considers configured automatic sources and respects the freshness
window; it does not discover or reassess publisher policies. Use an explicit
reviewed state list, not an unqualified all-source refresh. It continues across
unavailable states and exits unsuccessfully if a source or persistence fails.
Protected host automation may invoke permitted sources on a schedule to populate
data without waiting for a visitor. This source change does not install a
scheduler or configure the hosted service.

### Consolidated local factual package

`back-end/data/state-ballots/national-state-candidates-2026-20261022-manifest.json`
indexes 48 official datasets and 25,483 records, with per-file hashes, source
configuration fingerprints and original capture times. Its JSONL transfer and
50-member archive remain outside Git and code artifacts. Thirty-one reviewed
datasets retain their earlier captures. Seventeen automatic feeds were retrieved
again through the existing adapters; their 7,906 normalized records survive a
cold cache restart without another publisher request.

The manifest distinguishes reviewed `import` inputs from automatic factual
reference files. Do not import those automatic files to bypass fresh download,
cache TTL, source validation or publisher review. Use the supported explicit
`refresh` command for permitted automatic sources. The archive is not a runtime
release, a protected deployment artifact or a complete personalized ballot.

Two configured automatic sources are omitted from this AI collection: New
Mexico's current candidate-host robots policy explicitly excludes OpenAI agents,
and the configured North Carolina distribution host returned HTTP 403 for its
policy request. Neither source dataset was requested, and no identity, alternate
host or cached-policy workaround was used. Their adapters remain configured;
that does not establish permission for an AI to collect them. Publisher-cleared
material or an independently permitted official source is still needed.
Louisiana has separately attributed reporting, not an accepted official candidate
dataset. Other local coverage, candidate profiles and application measures remain
incomplete. See `docs/audits/2026-10-21-automatic-source-persistence.md` for this
package's collection and runtime review.

### Independently published county companions

The ignored `independent-county-candidates-2026` CSV/JSONL package adds reviewed
facts from two independently published official county sources, not alternate
access to the restricted state hosts: Brunswick County NC's two printed sample
ballots and Santa Fe County NM's master list plus a supporting generic sample.
There are 85 records, 155 source claims and four separately retained Brunswick
question texts. Six New Mexico judicial retention choices remain distinct;
joint governor tickets, printed party labels and unknown party omissions remain
intact. Countywide `ALL` is not statewide eligibility, and blank write-ins or
single-name offices do not invent candidates, qualification or outcomes.

Both source IDs are registered additively, preserving every primary adapter and
its source-configuration fingerprint. They require ordinary reviewed imports into
external persistent storage. Default state selection tries enabled sources in
registry order, primary first, and returns the first valid snapshot with its own
identity, dates and documents. It never merges sources or relabels county data as
the primary feed. Explicit selection never falls back to a different source.

`/api/state-records` lists enabled source options without loading providers.
`/api/state-records/NC?source=nc-brunswick-samples-2026` selects one exact source;
unknown, repeated, malformed and cross-state IDs are rejected before a read.
The directory offers a native Source control only when the state has multiple
enabled sources. Search, office/status filters, pagination and copied links retain
that choice; changing states resets it. Attribution follows the returned source,
including automatic fallback. Local records remain browsable, but all new
district/local matching is withheld in lookup previews.

Compiled operations, with an already configured external data directory:

```bash
node back-end/dist/manage-state-ballot-data.js import /path/to/north-carolina-brunswick-2026.json /path/to/new-mexico-santa-fe-2026.json
node back-end/dist/check-state-ballot-sources.js NC --source nc-brunswick-samples-2026
node back-end/dist/export-state-ballot-sources.js NC --source nc-brunswick-samples-2026 --output /path/to/new-transfer.jsonl
```

The check command assesses each selected source independently; automatic refresh
also uses exact IDs so a county fallback cannot disguise a failed primary refresh.
Export without source flags keeps one selected source per state. Repeated
`--source` selects exact sources. Without a source filter, `--all-sources` requires
every enabled source in the requested states to be available. Missing sources abort before writing, and
existing output files are never overwritten. Exports with one source per state
remain byte-compatible schema 1. Multiple sources for one state use schema 2 with
a `sources` manifest and `sourceId` on every candidate row, without merging names
or implying that repeated people are distinct individuals.

The historical 48-dataset package and the factual county-review package remain
unchanged, including their original integration-status annotations. The later
application integration is recorded separately. See
`docs/audits/2026-10-21-independent-local-gaps.md` for source review and
`docs/audits/2026-10-22-source-aware-counties.md` for the integration contract.

`import` validates a supplied reviewed snapshot against its enabled source and
atomically stores it without retrieving that publisher. It does not invent a new
capture time. Invalid or future-dated files fail closed without a bundled fallback;
a restored valid import becomes available immediately. All reviewed production
datasets and factual transfers remain outside Git and code artifacts. The sixteen
former bootstrap snapshots now reside in the ignored `back-end/data/state-ballots/`
directory; eleven transfers retain their exact original bytes under its
`reviewed-transfers/` subdirectory. The migration manifest, checksums and archive
bind all 27 original files. Existing Git history is not rewritten. Source
configuration fingerprints are unchanged, preserving the existing cache format.

The Fulton and Cassia source sets require reviewed imports, not automatic PDF
extraction. Each import binds ordered document URLs, capture times, content hashes
and contribution counts, including zero-candidate supporting or question-only
documents. Their `georgia-2026` and `idaho-2026` data packages remain under the
ignored `back-end/data/state-ballots/` directory with factual JSON/JSONL,
manifests, checksums and verified archives. Neither original PDF graphics nor
contact-bearing HTML belongs in a code artifact. See
`docs/audits/2026-10-21-fulton-cassia-ballots.md` for source/scope review. Future
elections require fresh permitted publications and review, not a filename change.

Arkansas also uses an external reviewed import. Its one HTML document's URL,
content hash, capture time and 182-record contribution are bound into the snapshot.
The complete source table parser supports reviewed future dates and the same
four-table layout, but automatic retrieval is disabled after HTTP 403 from the
maintained standard downloader. Do not change transport identity, use browser
impersonation or relax access controls to refresh it. Fresh publisher-permitted
material and an access-policy review are prerequisites to changing that mode.
The `arkansas-2026` package includes source-row claims and eight election-inventory
lines, not complete measure texts or voter assignments. See
`docs/audits/2026-10-21-arkansas-public-tables.md`.

This follows this repository's protected immutable-code/external-writable-data
separation rather than embedding refreshed data in every code release. It does
not invoke or reconfigure an analytics deployment. The runtime contract names this directory as
external state. The operator must preserve it across promotions and rollbacks,
provide suitable backups and keep it outside all release directories. No cloud
account, credential, production path or permissions change is made by this update.

Illinois instead loads a validated, immutable snapshot from
`back-end/data/state-ballots/illinois-2026.json`. Its publisher disallows
crawling. Loading, caching, checking, or exporting this snapshot never makes an
Illinois network request and never relabels the captured retrieval timestamp as
fresh. Later changes may be missing, which is disclosed alongside the records.
The snapshot is independently required by the runtime artifact contract and copied
into the compiled service. Updates require reviewed, publisher-permitted source
material, not a bypass of the publisher's automation policy.

Requests use HTTPS with certificate verification, public-IP validation and pinned
DNS, a source-host allowlist on every redirect, a 12 MiB body limit, two redirects,
and bounded timeouts. Sources must return valid UTF-8 and expected election/schema
markers. Form data contains only fixed public election filters, never the
visitor's address or identity. Parser output excludes home/mailing addresses,
phone numbers, email addresses, voter IDs, and confidential-address fields.
Source failure logs contain only the state code.

Snapshots include a SHA-256 of the retrieved UTF-8 body and retrieval timestamp.
Kentucky's fingerprint covers the ordered URL/body envelope of all five required
documents; none of those office pages is treated as a complete state list alone.
Hawaii, Mississippi, and South Dakota fingerprints cover both the
validated public form page and its downloaded CSV body. Illinois retains the
fingerprint of its captured form/TSV pair without refreshing it. Only observed public
export commands and required election selectors/tokens are submitted. Hawaii and
South Dakota exports must contain every row counted by the public report, rather
than only the visible page. No anti-bot challenge is bypassed.
Utah permits crawling with a ten-second crawl delay; the on-demand four-hour
server cache is retained and operator diagnostics must not be run concurrently
against that publisher. Mississippi's listed exclusions do not include the public
candidate report. Hawaii and South Dakota returned no robots document (404).
The diagnostic command emits metadata/counts, not candidates' contact details:

```sh
npm run states:check
npm run states:check -- NC FL MD
```

## Server-transfer document

`back-end/data/state-ballots/reviewed-transfers/2026-11-03-additional-state-candidates.jsonl` contains the current
Colorado, Kentucky, and North Dakota source records, including inactive and local
entries. It is a dated transfer snapshot, not a complete personal ballot or a
claim that the production server has imported it. Its first line records source
URLs, retrieval times, source hashes, and per-state row counts. Following lines
contain only candidate/office/party/status/district/jurisdiction information and
safe source-published campaign links. No residential or contact fields are kept.

`back-end/data/state-ballots/reviewed-transfers/2026-11-03-public-export-candidates.jsonl` adds Utah, Mississippi, South
Dakota, Hawaii, and Illinois with the same schema and provenance contract.
Hawaii and Utah exclude filing history that does not explicitly establish a
general-election candidacy. Other sources retain their dated withdrawn/inactive
records for review; these must never be imported as active candidates.
The manifest distinguishes automatic retrieval from Illinois's manual-snapshot
policy. Its 523 Illinois records remain dated to their actual capture, not the
time a new transfer file is generated.

Create a new snapshot without overwriting an existing document:

```sh
npm run states:export -- CO KY ND --output /path/to/new-candidate-records.jsonl
```

The export is written only after every requested source succeeds. Preserve its
manifest, check each state count and election date, and exclude inactive or
unrecognized statuses before using entries as active candidates. Local county
records and specialized board/judicial districts still need an actual ballot
mapping; do not assign them to voters based on a ZIP centroid.

The complete 50-state/DC research inventory is `docs/state-coverage-2026.csv`.
An integrated feed is distinct from an identified or access-limited source.
All jurisdictions now have an initial source review, but that review is not an
exhaustive search or evidence of complete coverage. Remaining states still need
official-source research and, where no usable
feed is available, public candidate/profile/news evidence. This national goal is
not complete merely because the current adapters pass their tests.

The 2026 adapters stop serving records at November 5, 2026 00:00 UTC, after all
U.S. November 3 polling days. A new election requires verified official endpoints,
date/schema fixtures, district/status tests, and an explicit registry update.
Do not automatically increment years or reuse a portal's default election.

## Other sources and access limits

Research and public export checks on October 20-21, 2026 found these additional
sources or limitations. The individual sources below are not enabled. A state
may separately have a reviewed county publication configured above; that does
not change the access boundary of its blocked state portal.

| State | Official entry point | Remaining work or observed limitation |
| --- | --- | --- |
| Iowa | [General election](https://sos.iowa.gov/general-election) | Direct public retrieval returned HTTP 403. |
| Maine | [Upcoming elections](https://www.maine.gov/sos/elections-voting/upcoming-elections) | Current general workbook, September withdrawal/replacement PDF and October declared-write-in PDF are identified. Direct requests for all three files returned HTTP 403. No alternate identity or host-alias workaround was used. |
| Louisiana | [Voter portal](https://voterportal.sos.la.gov/) | The October 21 policy review found explicit disallows for statewide and parish candidate-inquiry routes; neither was queried. A future permitted source must distinguish the Senate general election from House open-primary and local stages. No validated official candidate contract is claimed. |
| Minnesota | [Candidate filings](https://candidates.sos.mn.gov/) | Normal public export redirected to an anti-bot challenge. No bypass attempted. |
| New York | [Ballot certifications](https://elections.ny.gov/ballot-certifications-elections) | The October 7 amended general certification is published, but normal direct download returned HTTP 403, as did the earlier candidate-data POST. No bypass attempted. Official county sources remain a potential path; fusion endorsements, joint tickets and regional Supreme Court districts require explicit reconciliation. |
| Oregon | [Run for office](https://sos.oregon.gov/elections/get-involved/Pages/run-for-office.aspx) | Replaces the old 404 candidate-filing path. Public search and the November pamphlet are identified, but finance registration and optional pamphlet participation do not establish ballot qualification. The search host's robots redirect to HTTP was refused rather than weakening HTTPS. |
| Rhode Island | [Voter Information Center](https://vote.sos.ri.gov/Home/) | Public candidate summary discovered; direct retrieval returned HTTP 403. |
| Tennessee | [Candidate lists](https://sos.tn.gov/elections/2026-candidate-lists) | Direct official-page retrieval returned HTTP 403; no bypass attempted. |
| Washington | [2026 candidate list](https://voter.votewa.gov/CandidateList.aspx?e=899) | The prior CSV export returned HTTP 403 and is not retried. All nine normally published public pagination controls now succeed and reconcile 887 records through the maintained downloader. The Secretary of State's full public-domain/privacy notice was reviewed. Default portal year was 2027, so explicit election/date selection remains mandatory; King County's separate reuse restriction is unchanged. |
| Wisconsin | [Sauk County candidate/results page](https://www.co.sauk.wi.us/countyclerk/election-candidates-results) | Its complete robots policy explicitly restricts AI input/use and OpenAI crawlers. The guarded download stops before retrieving its index or PDF; its candidate facts are not imported. Green Lake's robots and Dane County's ballot-information index return HTTP 403 and are not retried. The independent Town of Dane publication below is permitted; its Sauk school-area sample is not an import from the restricted Sauk County website. Wider Wisconsin coverage remains incomplete. |

## New York external-only dataset

New York's `ny-monroe-2026` registry entry requires an imported reviewed snapshot.
Without `STATE_BALLOT_DATA_DIR` and a valid imported file, it remains unavailable;
the normal limited-coverage behavior is retained. There is no network/OCR fallback
and no New York payload is required or copied into the immutable runtime artifact.

The canonical local handoff files are in `back-end/data/state-ballots/`, explicitly
excluded from Git. They are not disposable AI scratch or automatically published:

- `new-york-2026.json`: validated snapshot for the compiled import command.
- `new-york-2026-candidates.jsonl`: 106 factual candidate/contest records plus provenance.
- `new-york-2026-ballot-lines.jsonl`: 194 page/row claims linked to canonical record IDs.
- `new-york-2026-manifest.json`: source capture, counts and SHA-256 values for those files.

Back up these files separately before removing or archiving the checkout; Git and
worktree snapshots do not preserve ignored datasets. A local data archive and
`SHA256SUMS` accompany the handoff files.

After an authorized operator transfers the reviewed file and supplies the service's
protected environment, the existing command loads it outside the code release:

```bash
node back-end/dist/manage-state-ballot-data.js import /path/to/new-york-2026.json
node back-end/dist/export-state-ballot-sources.js NY --output /path/to/new-transfer.jsonl
```

The county certification was amended October 6, 2026 at 9:22 am and captured
October 21 at 12:15:08.446Z. The original PDF hash and original capture timestamp
remain unchanged after OCR, import, restart and export. All ten pages were checked;
the cover and signed certification are provenance, not candidate rows.

Repeated party lines coalesce only for the same name/office/district context.
The companion retains every printed party line, including a trailing punctuation
mark in the Gates Working Families label. Party lines are not inferred party
membership. Governor and lieutenant governor remain separate source sections;
the import does not reconstruct joint tickets or a personal ballot. Town/court
records and distinct terms remain exportable but are not matched through Census
legislative, congressional, ward or generic numeric district guesses. Other New York
districts, courts, local offices, write-ins and later amendments remain incomplete.

See `docs/audits/2026-10-21-new-york-external-snapshot.md` for reconciliation and
local verification. That source review did not change the other sixteen datasets;
their subsequent external-storage migration preserves all record facts and dates.

## Vermont: external reviewed sample ballots

`vt-south-burlington-2026` uses the same external-only import boundary as New York.
The official city index supplies five November 3 general-election sample ballots
for CHITTENDEN-8/9/10/11/12. Normal publisher access and TLS succeeded; requests
honored the published ten-second crawl delay. The separate state candidate page's
403 is not bypassed. There is no automatic PDF extraction or bundled fallback.

All ten pages, 266 named candidate rows and their printed party labels were
reconciled against original pixels and independently extracted coordinates. The
58 unique records include 23 statewide, six named House, six unmapped Senate and
23 local records. Repeated ballot variants do not create duplicate candidates.
`DEM/PROG` and `DEM/REP` remain literal printed labels, not inferred party membership
or two separately printed endorsements. Blank write-in slots do not identify
qualified write-in candidates. Governor and lieutenant governor are separate.

The at-large U.S. House race applies statewide. House labels remain
`CHITTENDEN-8` through `CHITTENDEN-12`, never bare Census district numbers.
The ballots do not name their Senate district; those records and all local
records remain exportable but are not assigned to voters through numeric guesses.
Sample ballots are ballot evidence, not an additional claim of certification,
complete statewide coverage or a complete personal ballot.

The canonical Git-ignored handoff is in `back-end/data/state-ballots/`:
`vermont-2026.json`, `vermont-2026-candidates.jsonl`,
`vermont-2026-ballot-lines.jsonl`, `vermont-2026-measures.jsonl`,
`vermont-2026-manifest.json`, `vermont-2026-SHA256SUMS` and the data archive.
The snapshot imports with the existing compiled management command, outside code
releases. Back up these files separately; Git/worktree snapshots omit ignored data.
The measure companion preserves the exact questions and YES/NO choices for
Proposals 3 and 4, including each printed Article 23 reference. It does not supply
legal interpretations or claim that measures are integrated into the application.

See `docs/audits/2026-10-21-vermont-city-ballots.md` for source reconciliation,
scope and local verification. No hosted transfer, scheduler or activation is
performed by the source change.

## Candidate statements, biographies and reporting

The Git-ignored `back-end/data/state-ballots/louisiana-reported-2026.jsonl` and
its checksum list preserve two dated Senate references from Louisiana Radio
Network's September 17 report: Julia Letlow (Republican) and Jamie Davis
(Democrat). They are attributed reporting, not official qualifications or a
complete Louisiana ballot. The source publication date, original capture time,
raw-byte fingerprint and access-policy review accompany each reference.

That original research companion remains unchanged. The supported application
inputs are `election-references-louisiana-2026.json` and
`election-references-maine-orono-2026.json` in the same ignored directory. The
first contains the two attributed Senate reports; the second contains three
candidate-provided Orono statements with nine short factual/priority summaries.
Each has source-review JSONL, a manifest, checksums and an exact three-file archive.
Raw article/PDF prose, photographs, family details, contacts, endorsements and
forecasts are not packaged. Statement authorship is candidate-provided even when
the document is published by the town. Source publication dates are shown only
when explicitly known; an original capture date is never presented as publication.

The separate reference schema is never accepted by the official candidate
snapshot importer. Import it through its own compiled command:

```sh
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-louisiana-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-maine-orono-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-washington-congressional-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-washington-ld1-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-north-carolina-judicial-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-new-mexico-supreme-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-alaska-statewide-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-oregon-eastern-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-utah-congressional-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-arizona-statewide-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-nevada-executive-2026.json
node back-end/dist/manage-election-references.js import /absolute/reviewed-data/election-references-cdir-ca-2026.json
node back-end/dist/manage-election-references.js export LA
node back-end/dist/manage-election-references.js export WA --source wa-congressional-statements-2026
node back-end/dist/manage-election-references.js export WA --source wa-ld1-statements-2026
node back-end/dist/manage-election-references.js export CA --source us-cdir-ca-2026
node back-end/dist/manage-election-references.js prepare-congressional /absolute/reviewed-data/preparation-plan.json
```

Set the existing `STATE_BALLOT_DATA_DIR` to durable writable storage outside code
releases. No new credential or configuration variable is needed. Files named
`references-<collection-id>.json` are validated, atomically replaced and read on
request, so reviewed updates do not require an application restart. Missing files
remain unavailable; malformed data fails closed without damaging other datasets.
The existing lookup kill switch disables both source repositories by default.
`STATE_BALLOT_ENABLED_STATES` still selects official sources, not these independently
reviewed reference collections. The read-only API has its own bounded throttle.

`GET /api/election-references/:stateCode` supports `q`, `scope`, `limit` and `offset`.
The directory uses a separate `referenceOffset` for information pages; it never
changes official totals or pagination. Source kind, publisher, publication date
when known, capture time and a safe source link accompany every displayed record.
The UI labels candidate-provided claims, official biographies and reporting, with a local qualification
limitation for reports. Reference failures do not disable official records.

Multiple reference collections for one state are combined in registry order for
the earliest unexpired configured election, before global search, scope and
pagination. States and election dates are never mixed; the two-day UTC expiry
is unchanged. The additive `collections` response lists configured source IDs,
not data availability. Each record includes `source.collectionId`; its existing
opaque ID, attribution and capture time remain intact. Missing/corrupt collections
are isolated: healthy records remain available with `incomplete: true` and Retry;
all missing yields unavailable, while failures without healthy data yield 503.
Restoring/importing a collection requires no restart. Use `--source` when exporting
a state with multiple configured collections; ambiguous export fails explicitly.

Washington's independent `election-references-washington-congressional-2026.json`
contains twenty candidate-provided profiles with 61 reviewed background facts,
covering both listed candidates in each of the ten congressional districts. Its
ten public race requests are derived from the linked normal-mode VoteWA guide,
not a voter identity, preview mode or denied export. Original response hashes and
capture times are retained. No publication date, qualification, personal ballot
eligibility or publisher verification of the candidates' claims is inferred.

The additive `election-references-washington-ld1-2026.json` supplies four House
profiles for Legislative District 1, Positions 1 and 2: Davina Duerr, Maggie Wang,
Shelley Kloba and Cliff Moon. Twelve short candidate-provided background facts
reconcile with the exact retained official names, offices and public guide IDs.
The current guide's selected GENERAL 2026 election, four actual candidate links,
normal-mode application contract, exact-host policy and reuse notice were reviewed
before the two race requests. Missing fields, publication dates, party preferences,
qualifications and personal eligibility are not inferred. No Senate or complete
legislative coverage is claimed. All twenty congressional profiles and the 887
official records are unchanged. See `audits/2026-10-22-washington-profile-collections.md`.
The optional pinned public `pageUrl` opens the actual guide rather than its data
response; both links remain subject to public-HTTPS validation. Raw photographs,
contacts, family/medical details and campaign prose are excluded. This remains a
reviewed import, not automatic statement scraping. Its companion
`washington-congressional-profile-facts-2026.csv` and JSONL preserve factual review
material in a different schema, not accepted directly by the application importer.

North Carolina's judicial collection adds eight candidate submissions and sixteen
background facts from the separately published 2026 NCSBE judicial guide. All eight
names and statewide offices reconcile with the reviewed Brunswick sample. The
guide explicitly identifies its submissions as candidate-provided, not the board's
opinions. It does not access or substitute for the excluded distribution-host feed.

New Mexico's Supreme Court collection adds two retention profiles and six background
facts from independently authored court biographies. Name/office identities reconcile
with the reviewed Santa Fe sample, including Bacon's additional initial in the
biography. Official biography is a distinct source kind, not a news report,
candidate-authored statement, qualification or recommendation. Other judges are
not inferred from a court roster. Both new collections preserve their October 22
capture times and exact original-byte hashes without inventing publication dates.

The new factual CSV/JSONL, review and manifest companions remain in the ignored
data directory. The three-member v1.10.1 operator addendum contains only the two
supported snapshots and its manifest; it supplements, not replaces, the immutable
v1.10.0 data package. Neither package is included in Git or runtime release assets,
and both require separately approved operator transfer/import. Court copyright
and candidate authorship are preserved: no campaign prose, media, personal contact
or family details are redistributed. No automatic profile refresh is introduced.

Alaska's collection contains fifteen candidate-provided profiles and 47 background
items from the exact individual statements linked by the current `26genr` index.
Their individual names and offices reconcile with eleven certified statewide/federal
ballot-choice rows in the retained 155-record snapshot. Governor and lieutenant
governor members remain separate profiles, not extra official choices. Six other
rows have no linked statement; no withdrawal or missing candidacy is inferred.
Dan S. Sullivan and Daniel J. Sullivan Jr. are kept separate. The source index,
ordinary HTTPS policy/certificate checks, raw-byte hashes and actual PDF geometry
are retained in local review evidence. Normal Node TLS still fails for this host;
no trust override or automatic profile adapter is introduced.

Oregon's collection contains all fourteen indexed submissions and 42 background
items in the Baker/Grant/Harney/Lake/Malheur edition. It includes six statewide,
two congressional, one legislative and five county-office profiles. Eleven names
match retained official filings; three local submissions have no independent
retained filing and remain candidate-provided references. Official Oregon totals
remain 279. Gary Lyndon Dye remains in the official list but has no statement in
this edition. Neither the edition's geography nor a profile's county assigns a
personal ballot. The source link opens its candidate index at PDF page 29.

All source candidate pages are visually reviewed with measured columns, avoiding
cross-column attribution and off-page text. Attendance is not upgraded to a degree;
family military service is not attributed to a candidate. Original publication
dates are unknown, not inferred from PDF timestamps or footer placeholders.
Only concise factual summaries, attribution and provenance are packaged, not
campaign prose, images, contacts, family details or source PDFs.

The two new supported JSON snapshots, factual CSV/JSONL and review/manifest
companions remain in the ignored data directory. The v1.10.2 three-member operator
addendum supplements the unchanged v1.10.0 and v1.10.1 packages. It is not a Git
or runtime asset, an automatic profile refresh or an approved production transfer.
Use current server-AI instructions for exact package hashes and acceptance.

Utah's public general-election pamphlet supplies all sixteen congressional
submissions and thirty short background/position summaries. Its twenty printed
House candidates reconcile with all twenty in the retained official 255-record
dataset. Jesse West, Babak "Bobby" Darvish, Daniel Cottam and Cassie Easley have no
submitted profile, not an inferred withdrawal. Robert Moesinger/Robert M. Moesinger
and Blake Moore/Blake D. Moore are explicit reviewed name variants in the same
printed districts, not fuzzy personal-ballot matches. The link opens PDF page six.
All sixteen statement pages, four missing-statement pages, cover and authorship
notice were visually reviewed. Princeton study is not a degree; unspecified degree
levels and qualified policy positions are not expanded into stronger claims.

The pamphlet explicitly says its federal statements were not edited by the
Lieutenant Governor's Office. Its original 05:35:46Z October 22 capture and byte
hash remain provenance, not a publication date or independent verification.
The reviewed source permits collection with a ten-second delay. Utah's general
reuse notice is not a blanket license to third-party submissions; the new short
factual summaries neither modify nor redistribute the state PDF or campaign essays.
The two-member v1.10.3 addendum contains only the supported reference snapshot and
its manifest, supplementing all three earlier packages. It stays outside Git and
runtime assets and needs separately approved operator transfer/import.

California's voter-guide policy request returned 403. No guide documents were
collected, and no CDN, mirror or identity workaround was attempted. Its separately
reviewed official candidate dataset remains unchanged. See
`docs/audits/2026-10-22-utah-profiles.md` and current server-AI instructions.

Arizona adds five individual executive profiles and fourteen background/position
items. Two are official office biographies; three are candidate-authored statements.
All four retained governor/lieutenant-governor tickets have a gubernatorial profile;
only the Hourihan ticket has a running-mate profile in this collection. Five people
are not five additional official choices. The official 207-record snapshot stays
unchanged. Historical Biggs career/education claims are kept separate from stale
term/committee text; Hobbs's uncertain election-day date is omitted. Angela Harrolle
Mohan's honorary commander role is not active military service.

Nevada adds three official office biographies and nine background items: Aaron D.
Ford and Joe/Joseph Lombardo for Governor, and Stavros Anthony for Lieutenant
Governor. These do not complete either race or change the official 254-record list.
Danielle Ford's campaign biography returned 403 and was not retried through other
routes, identities or mirrors. Arizona's Risa Lombardo remains a different person.
The governor publication is linked by its actual public www homepage; int/prod
search results were not requested. Office biographies describe source authorship,
not independently verified qualification or election recommendations.

The national congressional collection has 46 independent `us-cdir-<state>-2026`
sources, 184 profiles and 368 short background facts. Six new states and thirteen
further matches in nine preceding states add 22 profiles/43 facts. Eight DC
profiles add 23 facts from seven council biographies/service histories and the
attorney general's biography. All preceding 51 configurations and 254 profiles
remain unchanged. The combined collection covers all 50 states plus DC,
58 source IDs, 284 profiles and 639 factual items; these are not additional official
choices, complete slates or personally eligible ballots.

The GPO/Joint Committee on Printing publication is issued 2026-02-20 but states a
printed 2025-10-01 compilation cutoff. The exact-host policy, actual sitemap/details
links, text/MODS and original PDF were reviewed independently. It is a federal
biography source, not a proxy or mirror for a denied state voter guide. Current
2026 candidate identity/office comes from active retained official records, not
directory membership. Exact normalized full-name/state matching remains the
default. Six explicitly reviewed source/name/office/edition-bound mappings use
captured official identity pages; this is not general nickname matching or title
stripping. Mixed-case surnames and the printed city/state semicolon are supported.
Three reviewed DE/ND/VT at-large House cases affect reference display only, not
official scopes or personal lookup. Ticket slots and duplicate/inactive exclusions
remain intact. DC's ward references retain their official Ward 3/5/6 jurisdictions;
current council biographies do not establish general-election qualification.

Fifteen edition-specific holds across twelve profiles omit uncertain fields,
clauses and ranges. The six preceding holds remain, with new Womack/Coons/McBride
service-range holds, Risch's complex state-Senate clause, two Fedorchak clauses,
Balint's education and two DeSaulnier clauses/ranges. Earlier source errors were
confirmed in the original PDF; new text discrepancies are not presumed PDF errors.
No replacement fact is invented or borrowed under the wrong attribution. Current/
open-ended roles, malformed fields, contacts, birth/family/religion details and
images are omitted. An official biography remains a source claim, not independent
verification. The new CSV/JSONL/review/manifest companions preserve factual review
and exact candidate/source/capture identities outside Git, not importer inputs.

The compiled `prepare-congressional PLAN.json` flow validates local raw-text hash,
capture time, pinned edition/compilation notice, configured candidate/reference
snapshots and external output. It creates exclusive staging files and a manifest,
with zero publisher requests or imports. Provide preceding non-directory profiles
for selected states to prevent duplicate people. Candidate statuses and current
office/ticket slots remain explicit. Re-preparing a directory collection does not
deduplicate against itself. Fresh approved downloads may feed this staging flow;
changed counts, source drift, missing matches or unknown editions require review
before separate imports. Current configuration and future-edition/election gates
are documented in `server-ai-current.md`.

The cumulative v1.11.1 operator package supersedes the v1.11.0 transfer procedure:
33 unchanged reviewed official snapshots, all 58 reference snapshots and one
manifest, exactly 92 flat members and 754,597 compressed bytes. It retains 17,662
reviewed official records and 284 profiles/639 facts, not all election data.
Seventeen permitted automatic sources refresh separately. The seven earlier
packages and published tags remain immutable; every preceding file retains its
original timestamp, source/configuration hashes and schema. Publisher documents,
research CSV/JSONL and secrets are not packaged. The archive is outside Git/runtime
and still needs independently approved operator transfer/import. Current server
instructions contain exact hashes and all 91 import prerequisites. Nine expanded
Directory transfer files use versioned filenames; the manifest selects exactly
one full snapshot per source ID. All 323 preceding canonical files remain byte-exact.
See `docs/audits/2026-10-22-reference-coverage-gaps.md` for this expansion.
See `docs/audits/2026-10-22-national-congressional-biographies.md` for reconciliation,
source-quality holds and local acceptance; earlier AZ/NV evidence remains in
`docs/audits/2026-10-22-arizona-nevada-profiles.md`.

Do not relabel references `listed` or `qualified`, merge them into personal ballot
previews, infer an outcome, or claim a complete Louisiana ballot. Collections are
pinned to an explicitly reviewed state/election/document set and stop serving two
days after that election, consistent with the official-source repository. A future
election requires a newly reviewed collection identity and import, not a date
substitution or automatic PDF/news crawl. Broader profile research and Louisiana's
official integration remain incomplete. At least one reference per state/DC does
not establish complete candidate, challenger, local or measure coverage.

## Reviewed snapshots and transfers

The retained 48-dataset national package contains 25,483 official records; the
two independent county inputs add 85 records. Together the fifty source datasets
retain 25,568 records, not that many unique people or a complete personal ballot.
Forty-nine states plus DC are configured: nineteen automatic feeds and thirty-three reviewed sources.
Louisiana still lacks an integrated candidate dataset. Local ballot mapping, measures and substantive
candidate-profile research remain incomplete even in configured jurisdictions.

All thirty-three reviewed snapshots require imports into persistent external state.
The sixteen former bootstrap payloads are in `back-end/data/state-ballots/`, not
the source or compiled data tree. No provider credential is needed to import
reviewed data. The transport refuses automatic requests for these sources.
Reviewed updates must replace captured data and provenance together; loading
never invents a new date. South Carolina remains automatic. Its transfer is dated to the
reviewed capture, while the application independently refreshes its public search.

Each document retains its URL, original-byte SHA-256, retrieval timestamp and number
of unique records first contributed by that document, which may be zero when a
published ballot repeats already represented candidates. Every configured original
is still required, and document contributions must sum to the positive snapshot count.
The source-set hash is the SHA-256 of the ordered JSON array
of `{url, sha256}` entries. The snapshot timestamp is the oldest included document
capture. The loader validates the configured document set, fingerprints, counts,
timestamps, allowed factual fields and unique record identities. The runtime
copier, independent compiled verifier and artifact inspection reject election-data
bundles. All reviewed payloads, including the Maine composite, Rhode Island and
Oklahoma, stay outside immutable code artifacts and pass the same import validator.
The test-only regression catalog is not a production bootstrap or import package.

## Browsing candidate source records

`/records` provides state, office-level and name/office/jurisdiction filters, bounded
50-record pages and an explicit inactive-record option. It shows source capture
time, election date, the publisher's scope limitation and source-published status,
party and ballot-designation fields. Source records are not promoted into verified
guides or personal ballot matches. Local/court/town records remain withheld from
personal lookups unless a separate authoritative eligibility mapping exists.
Sources with separately labeled documents expose only links that match the
configured reviewed document set. New Hampshire links each town's original PDF;
Minnesota links each published school-area sample.

`GET /api/state-records` lists all states and which have configured sources without
fetching every publisher. `GET /api/state-records/:stateCode` uses the existing
repository and freshness/storage controls. Filters are `q` (single line, at most
120 characters), `scope` (all/statewide/congressional/state-senate/state-house/local),
`status` (active/all), `limit` (1–100, default 50) and `offset` (0–25,000).
Inactive, withdrawn, disqualified, defeated, elected, unopposed and unrecognized
records are excluded by default, with their explicit status retained when requested.
Old offsets fall back to the last valid page rather than stranding navigation.

The read-only API whitelists public fields, refuses mismatched source identities,
sanitizes campaign links, returns unavailable rather than fabricating missing data,
and uses a bounded per-client throttle (120 requests/minute, 10,000 buckets).
It does not return residential addresses, emails, phones, raw documents or private
provider fields. No user location or personal ballot is required to browse.

Maine's current handoff is `back-end/data/state-ballots/maine-local-samples-2026.json`;
Rhode Island uses `rhode-island-2026.json`, and Oklahoma uses
`oklahoma-woodward-2026.json` in the same ignored directory. Each has candidate,
source-line and question-reference JSONL, a manifest, checksums and an exact five-file
archive. No source graphics, signatures or raw PDFs enter those archives. The old
Bangor-only package remains unchanged for rollback; its fifteen IDs and original
capture time survive in the new Maine composite. Import the new source identity
instead of renaming an old cache. These are reviewed snapshots, not unattended PDF
or image ingestion. Back up the packages separately from code releases.
See `docs/audits/2026-10-21-rhode-island-oklahoma-maine.md` for source reconciliation,
question-text limits, safe import and local verification.

Minnesota and Iowa use `back-end/data/state-ballots/minnesota-2026.json` and
`back-end/data/state-ballots/iowa-2026.json`. Each has candidate, printed-line and
question JSONL companions, a manifest, `-SHA256SUMS` and an exact five-file
`-data.tar.gz` archive. All are ignored external data, not code-release assets.
Validate checksums, unpack outside the code checkout and import each snapshot:

```sh
node back-end/dist/manage-state-ballot-data.js import /absolute/reviewed-data/minnesota-2026.json
node back-end/dist/manage-state-ballot-data.js import /absolute/reviewed-data/iowa-2026.json
```

Set `STATE_BALLOT_DATA_DIR` to persistent writable storage outside immutable
releases before import; enable `MN` and `IA` if restricting the configured states.
Back up the snapshots and companions separately. No original PDFs or Iowa contact
details belong in these archives. Missing imports return unavailable, never an
automatic crawl or bundled fallback. Automatic refresh refuses both manual sources.
The question companions retain source facts but are not application measure payloads.
See `docs/audits/2026-10-21-minnesota-iowa.md` for scope and acceptance evidence.

Kansas uses the existing automatic-source repository and management commands.
Its explicitly selected public page is downloaded in one bounded request; no
voter identity, login, form token or private API is used. The parser refuses a
different election, restricted filters, pagination, empty/incomplete cards,
unknown office/status vocabulary, duplicate identities or an incomplete ticket.
With persistent `STATE_BALLOT_DATA_DIR`, fresh data survives restart; TTL expiry
permits another validated download. Invalid updates fail closed rather than
reusing an unrelated election. The state portal's HTTP 403 is not bypassed.

The retained `kansas-2026.json` capture is a factual transfer/backup, not a
reviewed-source import. The import command deliberately refuses automatic sources;
use `manage-state-ballot-data.js refresh KS` to download and persist Kansas data.
Its candidate JSONL and manifest join an exact three-file archive/checksum list. Nevada's
`nevada-2026.json`, candidate/printed-line JSONL and manifest form a four-file
archive with a separate checksum list. Both datasets stay in ignored
`back-end/data/state-ballots/`, not Git/code releases. Original PDFs and HTML
with contact data never enter those archives. Import into persistent external
storage before hosting Nevada; automatic refresh refuses its reviewed PDFs.

Kansas's revised notice explicitly lists no candidate for Gardner/Olathe township
clerk. Those empty offices do not create candidates. Its source-name discrepancy
is disclosed rather than silently corrected or duplicated into a second person.
Nevada's eight non-person options are not application candidate or measure objects.
See `docs/audits/2026-10-21-kansas-nevada.md` for reconciliation and verification.

Tennessee's `tn-williamson-2026` requires a reviewed external import. Its ordinary
county sample is an image-only PDF; automated refresh refuses it. The ignored
`tennessee-2026.json`, candidate/claim/question JSONL and manifest form a five-file
archive with a separate checksum list. No original PDF, seal, graphical ballot or
contact information enters that transfer. Import only the snapshot through
`manage-state-ballot-data.js import /reviewed/path/tennessee-2026.json` with an
enabled `TN` source and persistent `STATE_BALLOT_DATA_DIR` outside the release.
Do not import the factual companion files as snapshots.

The sample's fourteen offices include congressional districts 5 and 9, not the
older calendar's 5 and 7. County election officials link a May 2026 redistricting
notice. The current Census service advertises 120th Congress geography, but the
application's district matches do not retain that layer identity or establish
that its stored address context uses this map. The source therefore declares
`withheldDistrictScopes: ["congressional"]`: all eight records remain browsable,
but typed congressional numbers alone cannot make them address matches. State
Senate/House behavior is unchanged. Local records also remain unassigned.

This source-level gate is configuration, not a data-file override. Changing it
requires a reviewed map/provider-vintage contract, regression tests, local
acceptance and reimport because source fingerprints invalidate old envelopes.
Do not silently remove it after a date change or a successful candidate refresh.
See `docs/audits/2026-10-21-tennessee-county-ballot.md` for source reconciliation,
limitations and local acceptance. The final server-AI handoff remains queued
while national collection and the broader boundary/profile/measure work continue.

Montana uses the same persistent automatic-source flow. Its separately published
general-election service, explicitly linked from an independent county, selects
election `450002987`, not the county link's default primary `450002928`. Normal
bounded GET and published CSV postback requests reconcile all 272 source records.
The downloader refuses a different election/date/jurisdiction, changed export or
marker legend, partial count, unexpected schema/status/district/term or duplicate
identity. Withdrawals remain browsable with inactive records but are not offered
as active candidates. Judicial and commission districts never become congressional
or legislative matches, and single-candidate filings do not imply retention or
unopposed elections.

The ignored `montana-2026.json`, candidate JSONL and manifest are factual backups,
not a reviewed-file bootstrap import. Use `manage-state-ballot-data.js refresh MT`
to download into persistent `STATE_BALLOT_DATA_DIR`, then export the validated
cache. Keep data outside Git and immutable application releases. Future elections
require a reviewed source/date/selection/status/marker/term contract and synthetic
tests, not a blind year or election-ID substitution. See
`docs/audits/2026-10-21-montana-arizona.md` for acceptance and continuing Arizona review.

Arizona's original review-only transfer remains
`back-end/data/state-ballots/arizona-2026-review-claims.csv`, matching claim JSONL
and a review manifest, outside Git/code artifacts. It preserves 126 Pima printed
candidate claims, fourteen declared write-ins and 82 statewide/regional judicial
retention claims, with source URLs, hashes, dates and per-document contexts. The
222 named claims are not 222 deduplicated candidates: judicial documents overlap.
Seven unnamed count rows stay in JSONL, not the named-person CSV. No unnamed
placeholder becomes a candidate. All thirteen original pages were visually reviewed.

That original transfer is not an application snapshot or direct import, and its
222 claims are not added to the new 207-record dataset total. The newer Yavapai
sample visibly establishes the four printed governor/LG tickets and confirms
each member's party code. Its independent write-in and withdrawal notices supply
later status evidence. The six-document reviewed snapshot is now
`arizona-2026.json`; its separate candidate/claim/question-extract files and
manifest stay outside Git. The archive has five members plus external checksums.
Import only the validated snapshot with `manage-state-ballot-data.js import`.
Automatic refresh and bundled fallback remain refused.

The two named governor write-ins still have no established running mates. Four
source claims for those two people remain factual evidence, not incomplete
application tickets. Fourteen already dated Pima judges are joined to explicit
roster aliases for retention status; the roster itself prints only a year, and
its additional 68 claims are not imported. Original spellings remain intact,
including the documented Neal suffix-order variation. Different school terms,
unexpired terms, ordinary Yavapai judicial races and three withdrawals remain
distinct. The final city vote instruction is clipped despite hidden text, so no
limit is inferred. Local cancellations, wider county data and precise personal
eligibility remain unverified. Twenty-seven question extracts are labeled for
further full-text review and are never imported as candidates or measures.
The permitted sources do not authorize retrying state/Coconino restrictions.
See `docs/audits/2026-10-21-arizona-county-ballots.md`.

Wisconsin's independent Town of Dane publication provides three school-area
samples and the Type B notice. They reconcile fifteen candidate/ticket records,
not 45 different candidates. `wisconsin-2026.json`, candidate/claim JSONL, seven
full question texts, thirteen question-source claims and the manifest form a
six-member external archive. The two joint tickets stay intact. No blank
write-in, notice-signing clerk or inferred unopposed outcome becomes a candidate.
Question texts remain factual companions, not application measures; overlapping
ward labels do not establish school eligibility. The applicable public robots
and linked vendor privacy notice were inspected; no applicable factual-reuse
restriction was identified. Sauk County's separate AI restriction and Dane
County's HTTP 403 remain respected. No original graphics are transferred.
See `docs/audits/2026-10-21-wisconsin-town-ballots.md`.

King County's official landing page links a current November sample ballot, but
its terms require prior written permission for publication/display/distribution
of website/app content and data. No King County candidate or measure content is
integrated or transferred. The normal access/provenance and restriction metadata
are retained; the downloaded original and derived extracts were removed. The
Washington state export restriction is not bypassed through that county source.

## Canonical transfer exports

### Washington automatic collection and Rhode Island question companions

Washington uses `washington-html`, source `wa-general-2026`, and the explicitly
selected general election `e=899` on November 3, 2026. The supported downloader
performs one public GET and follows only the observed next-page form controls.
It does not request an export, a private voter lookup or a candidate contact
database. Complete counts, 100-row page sizes, ordering and identifiers must
reconcile; inconsistent, filtered, repeated, denied or oversized responses fail
closed without replacing accepted disk data. Pagination is bounded to 25 pages,
2,500 records, two MiB per page and the existing combined request limit. Normal
TLS, host restrictions and zero redirects remain enforced.

The ordinary compiled refresh is the bootstrap and update path:

```sh
STATE_BALLOT_ENABLED_STATES=WA STATE_BALLOT_DATA_DIR=/absolute/persistent/state-ballots node back-end/dist/manage-state-ballot-data.js refresh WA
STATE_BALLOT_ENABLED_STATES=WA STATE_BALLOT_DATA_DIR=/absolute/persistent/state-ballots node back-end/dist/export-state-ballot-sources.js WA
```

The host operator chooses an absolute durable directory outside all checkouts
and releases. The existing enable-state and cache-lifetime settings apply.
Warm and validate it before serving lookup traffic. Do not relabel a refresh or
restart as a new source capture. A future election requires a reviewed source
identifier, election date and published election ID, source-policy review and
fresh acceptance tests; the parser verifies those configured values rather than
silently following the publisher's default year. Unsupported status or schema
changes require review, not weaker validation. No schedule or host is changed
by this source work.

The ignored `washington-2026` snapshot, export, 887 source claims, manifest,
four-member archive and checksums are factual review/reference material outside
Git and code artifacts. Automatic sources cannot use reviewed `import` as a
bootstrap shortcut. Their persistent cache is created by `refresh`. Raw HTML
contains contact columns and stays in local evidence, never in the factual
package. Public record identifiers are retained, but official guide links are
not mislabeled as campaign websites. Numerical term lengths are preserved
without inventing units or a remaining term. Regional judges are not made into
statewide retention choices; local records are not assigned by ZIP or numerical
legislative aliases. Source limitations now propagate once into previews for
both automatic and reviewed configurations.

Rhode Island's independent Providence publication supplies two local question
texts in English and Spanish, with exact source pages, choices and hashes. The
`rhode-island-providence-2026` question companion, manifest, two-member archive
and checksums remain ignored and separate from the candidate application.
They do not establish candidate qualification or personal ballot eligibility,
and do not turn the previously denied state portal into an available feed.
Original graphics, city explanatory prose and inferred polling assignments are
excluded. No statewide Rhode Island candidate dataset is claimed. See
`docs/audits/2026-10-21-washington-public-pagination.md` for both reviews and
the continuing national scope.

The canonical transfers are `back-end/data/state-ballots/reviewed-transfers/2026-11-03-reviewed-pdf-candidates.jsonl`
for MO/NE/DC/NJ/AL, `back-end/data/state-ballots/reviewed-transfers/2026-11-03-ca-in-tx-candidates.jsonl` for CA/IN/TX,
`back-end/data/state-ballots/reviewed-transfers/2026-11-03-pa-wv-candidates.jsonl` for PA/WV, and
`back-end/data/state-ballots/reviewed-transfers/2026-11-03-ak-sc-candidates.jsonl` for AK/SC, and
`back-end/data/state-ballots/reviewed-transfers/2026-11-03-connecticut-candidates.jsonl` for CT, and
`back-end/data/state-ballots/reviewed-transfers/2026-11-03-oregon-candidates.jsonl` for OR, and
`back-end/data/state-ballots/reviewed-transfers/2026-11-03-oh-ma-candidates.jsonl` for OH/MA.
Their manifests retain the same
document evidence and consequential scope notices. Re-export the exact configured
snapshots without network access after building the back end:

```sh
node back-end/dist/export-state-ballot-sources.js MO NE DC NJ AL --output /path/to/new-transfer.jsonl
node back-end/dist/export-state-ballot-sources.js CA IN TX --output /path/to/another-new-transfer.jsonl
node back-end/dist/export-state-ballot-sources.js PA WV --output /path/to/portal-transfer.jsonl
node back-end/dist/export-state-ballot-sources.js CT --output /path/to/connecticut-transfer.jsonl
node back-end/dist/export-state-ballot-sources.js OR --output /path/to/oregon-transfer.jsonl
node back-end/dist/export-state-ballot-sources.js OH MA --output /path/to/county-publication-transfer.jsonl
```

Alaska can likewise be exported offline with `AK`. Exporting `AK SC` also makes
the supported live anonymous South Carolina search; its retrieval timestamp and
source-envelope fingerprint may differ from the reviewed transfer. Compare
candidate fields separately rather than relabeling a new capture as byte-identical.

The output path must not already exist. No residential addresses, emails, phones,
campaign contact people, party committee elections or copied candidate essays are
included. See `docs/audits/2026-10-21-reviewed-state-pdfs.md` for extraction,
reconciliation, authority and local acceptance details, and
`docs/audits/2026-10-21-ca-in-tx-records.md` for the additional three states.
The portal selection, source-access evidence and remaining-state research are in
`docs/audits/2026-10-21-public-state-portals.md`.
Alaska pagination/certification and South Carolina public-search evidence are in
`docs/audits/2026-10-21-ak-sc-candidates.md`.
Connecticut's extraction, source-printing anomalies, name reconciliation and
remaining mapping gaps are documented in `docs/audits/2026-10-21-connecticut-ballots.md`.
Its `back-end/data/state-ballots/reviewed-transfers/2026-11-03-connecticut-ballot-lines.jsonl` companion links all 15,517
printed claims to the 709 canonical records and their original document/page,
physical office/party rows, position labels and printed voting areas. Those voting
labels are evidence, not inferred Census or legal local-district identifiers.
Question cells are retained in the regression fixture but are not an accepted
measure dataset or voter-facing measure coverage. Updating the dated snapshot
requires reviewing every changed PDF, reproducing grid/word geometry, checking
the complete document/page set and replacing factual records plus provenance
together. Runtime loading needs no PDF software or live publisher requests.
Oregon's independent county publication, blocked state-portal findings, complete
candidate-page/count checks and local acceptance are documented in
`docs/audits/2026-10-21-oregon-ballots.md`. Its
`back-end/data/state-ballots/reviewed-transfers/2026-11-03-oregon-ballot-claims.jsonl` companion links 338 original
candidate claims to 279 canonical records and source document/page contexts.
The three original PDFs contain 35 pages; the extraction retains all 24 candidate
pages while omitting directive narrative and measure text. Those omissions are
not a claim of measure coverage. County report counters, wrapped party labels,
multi-seat offices and separate court/city/utility jurisdictions are checked.

CTCL direct feeds, Ballotpedia, and Democracy Works remain prospective licensed or
permissioned integrations. No access requests, accounts, subscriptions, external
messages, or Google Civic bulk collection were performed.
