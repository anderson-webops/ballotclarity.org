# Reusable election cycles

External election catalogs opt the automatic candidate repository into reusable
source families. The current 64 source definitions retain explicit source/state
allowlists; reusable discovery does not widen an exact-source allowlist.

Thirty-four families across twenty-seven states and D.C. are supported:

| Family | Discovery | Elections |
| --- | --- | --- |
| `dc-boe-2026` | [D.C. Board of Elections navigation](https://dcboe.org/) | Actually offered year pages and explicit general-election dates; complete general, ANC and write-in publications, source-status amendments and hash-bound durable imports |
| `oh-franklin-2026` | [Franklin County election navigation](https://www.vote.franklincountyohio.gov/home) | Actually offered year pages and explicit general-election dates from the complete FWAB notice or general schedule; complete candidate/notice reconciliation, pending future publications and hash-bound durable imports |
| `id-cassia-2026` | [Cassia County sample-ballot index](https://www.cassia.gov/sample-ballots) | Actual dated general-election sections, complete general and supplemental PDFs, separate questions and retained local applicability limits |
| `ia-polk-2026` | [Polk County election index](https://www.polkcountyiowa.gov/county-auditor/election/) | Actually offered dated voter-information pages, complete candidate PDFs and one explicitly linked precinct sample for joint-ticket verification; publication-link changes invalidate cached imports without an annual source edit |
| `ia-johnson-2026` | [Johnson County, Iowa election index](https://johnsoncountyiowa.gov/auditor/elections) | Actually offered, explicitly dated even-year general pages; complete candidate sections, printed seat/term rules and external durable imports, with questions separate from people |
| `nv-washoe-2026` | [Washoe County election information](https://www.washoecounty.gov/voters/information/) | Printed even-year November general dates and complete HTML contest tables; policy-bound collection, separate questions/nonperson options, terms, vote limits and the published deceased-candidate notice |
| `nv-clark-2026` | [Clark County general-election information](https://www.clarkcountynv.gov/government/departments/elections/26g-info) | Actually offered dated general elections with independently reconciled candidate-table and newsletter publications; both remain required |
| `ct-sots-2026` | [Connecticut town ballots](https://portal.ct.gov/SOTS/Election-Services/Town-Ballots/Ballots) | Actually offered dated town publications, complete printed page sets and bounded table extraction; unknown layouts and unresolved claims remain held |
| `or-sos-multnomah-2026` | [Multnomah County current/upcoming elections](https://multco.us/info/current-and-upcoming-elections-multnomah-county-elections) and each actually offered general-election page | Explicit even-year November dates, the independently published state directive and both county ballot-content reports; current 279 facts/IDs retained, unknown formats held for review |
| `tx-sos-2026` | [Texas election index](https://www.sos.state.tx.us/elections/index.shtml) and its actually offered regular-general page | Explicit even-year November dates, final county certification and optional declared-write-in certification; separate special elections stay excluded |
| `vt-sos-2026` | [Vermont general-election candidates](https://sos.vermont.gov/elections/election-info-resources/candidates) | Actual active even-year general date and published qualified-candidate workbook; legislative codes remain unmapped and local rows are not personal ballot matches |
| `mo-sos-2026` | [Missouri official homepage](https://www.sos.mo.gov/) and [election calendar](https://www.sos.mo.gov/elections/calendar) | Offered November certification PDFs paired with the calendar's explicit regular-general date; current 425 identities retained, including individual regional retention questions |
| `nj-doe-2026-federal` | [New Jersey election-year archive](https://www.nj.gov/state/elections/election-information.shtml) and each actually offered even-year page | Published Senate/House lists and explicit district amendments; every PDF identifies the selected general date, published party totals reconcile and only the amended district is replaced |
| `ga-fulton-2026` | [Fulton County sample-ballot index](https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/sample-ballots), reviewed current policies and [official PSC scope](https://georgia.gov/organization/public-service-commission) | Actual dated November general/special-on-general-day PDF links, including qualified county write-in notices; county-published records, not statewide completeness |
| `va-elect-2026-federal` | [Virginia candidate index](https://www.elections.virginia.gov/casting-a-ballot/candidate-list/) | Explicit November general-election dates and actual combined or split federal HTML links; separate presidential records do not establish tickets |
| `va-elect-2026-local` | The same official index and its local/all-office reports | Explicit odd/even November general dates, source locality/district/term facts and any published all-office cross-check; not personal eligibility |
| `wa-general-2026` | [Washington candidate list](https://voter.votewa.gov/CandidateList.aspx) | General elections, including odd years |
| `mt-general-2026` | [Montana candidate list](https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx) | Federal general elections in even years |
| `ms-sos-2026` | [Mississippi qualifying list](https://www.sos.ms.gov/content/CandidateQualifying/default.aspx) | Explicitly dated November general-election records |
| `wy-sos-2026` | [Wyoming election center](https://sos.wyo.gov/elections/default.aspx) | Explicitly dated even-year general elections with matching CSV/PDF roster links |
| `de-doe-2026` | [Delaware candidate index](https://elections.delaware.gov/candidates/candidatelist/) | Explicitly dated even-year statewide general-election roster links |
| `sd-sos-2026` | [South Dakota election index](https://sdsos.gov/elections-voting/default.aspx) and its published yearly calendar | Even-year general elections with matching public candidate IDs and explicit calendar dates |
| `nd-sos-2026` | [North Dakota candidate index](https://www.sos.nd.gov/elections/candidate) and its published candidate calendar | Even-year general elections with matching public candidate IDs and explicit calendar dates |
| `fl-doe-2026` | [Florida public candidate download](https://dos.elections.myflorida.com/candidates/downloadcanlist.asp) | Published even-year `-GEN` election codes and matching year labels; state-filed candidates only |
| `fl-doe-local-2026` | [Florida local candidate download](https://dos.elections.myflorida.com/candidates/downloadcanlist.asp) | The same published election codes, the explicit local-candidate control and downloaded county codebook; local filings, not complete or personalized ballots |
| `md-sbe-2026` | [Maryland election navigation](https://elections.maryland.gov/elections/) | Observed year links, explicit General Election Day, statewide category and published general file code; existing current IDs/facts retained |
| `md-sbe-local-2026` | [Maryland county candidate lists](https://elections.maryland.gov/elections/2026/general_candidates/) | Separate local category, actual HTML/CSV controls and complete county-section reconciliation; no residential-geography inference |
| `sc-sec-2026` | [South Carolina public election selector](https://vrems.scvotes.sc.gov/Candidate/SelectElection) | Published even-year statewide general elections with matching IDs, dates and display labels |
| `nc-sbe-2026` | [North Carolina published year tables](https://www.ncsbe.gov/results-data/candidate-lists) | Exact CSV/general-list controls and actual nonprimary November general-election record dates, retaining the combined-year file's separate primary rows |
| `ky-sos-2026` | [Kentucky candidate selector](https://web.sos.ky.gov/CandidateFilings/) and [State Board calendar](https://elect.ky.gov/Pages/default.aspx) | Offered general-election IDs paired with explicit November dates, including odd years; original 210 records/IDs retained |
| `ky-courts-2026` | The same public selector/calendar and its separately published court/prosecutor controls | Full regional district/division labels and lifecycle evidence, not personalized ballot eligibility |
| `ut-lg-2026` | [Utah candidate resources](https://vote.utah.gov/resources-for-candidates-political-groups-parties/) and [current election information](https://vote.utah.gov/current-election-information/) | Actually offered even-year candidate links paired with an explicit same-cycle regular general-election date; existing 255 records/IDs retained |
| `mi-dos-2026` | [Michigan election homepage](https://www.michigan.gov/en/sos/elections) | Published November General Candidate Listing links paired with matching official report headers and explicit dates; original 716 entries/IDs retained |
| `ks-johnson-2026` | [Johnson County upcoming elections](https://www.jocoelection.org/events-elections/upcoming-elections) and its public candidate selector | Explicit November general-election links, matching offered candidate IDs and dated Johnson County election pages, including odd years; county publication is not statewide completeness or voter-specific eligibility |

Texas reconciles all 1,395 numbered report pages and 254 counties, retaining all
3,840 current facts/IDs, seventeen declared write-ins and the original PDF hashes.
Candidate repetition does not make a county office statewide. Legislative,
regional and county contexts stay distinct; unverified local eligibility stays
withheld. Congressional previews also require verified election-map boundaries;
directory records stay available, and latest configured safety holds protect
retained snapshots too. Current visually reviewed OCR corrections bind the exact write-in PDF
hash, not every later document. The bounded optional Poppler invocation permits
up to 2,000 Texas pages with unchanged byte/output/time bounds; other sources keep
the 50-page default. Original reviewed Texas files stay readable without the
extractor. Future dates/URLs must actually be offered. Unknown tickets, empty
certifications and changed unexpired document sets require review. Future cases
are synthetic. See the [Texas source review](audits/2026-10-25-texas-candidates.md).

Vermont's packaged Node workbook reader requires no host conversion tool. It
bounds compressed/expanded ZIP bytes, entries, XML, dimensions, cells, output,
memory and duration, rejecting formulas, entities, encryption and active content.
The current 2,619 candidacy rows include 2,197 justices of the peace and 33 usable
published websites. Residential/contact and financial-disclosure fields are
excluded, as are ten unknown party labels. The source's September 23, 2026
revision remains distinct from retrieval time. Per-host starts are at least one
second apart. The statewide source has same-date default priority; all 58 prior
South Burlington records remain independently available and unchanged. District
codes stay unmapped. Unexpired identity drift requires review, and empty validated
future workbooks wait rather than import zero records. Future tests are synthetic;
new office layouts and presidential tickets still require review. See the
[Vermont source review](audits/2026-10-25-vermont-candidates.md).

Missouri and New Jersey use the shared, optional bounded-worker Poppler capability
in `stateBallotPdfCollectorContract`. New Jersey uses positional text rather than
whitespace guesses, excluding address, county-slogan and contact fields from facts.
Raw PDFs and intermediate text stay outside Git/releases. Every original fact and
ID remains exact: 425 Missouri and 39 New Jersey records. Existing reviewed files
and explicit imports remain readable without a tool or fresh capture timestamp.
An actual worker refresh records capability, policy, transport and format failures
without claiming cached data is a successful fresh import. Successful automatic
replacement files require a compatible runtime; original reviewed files remain
the prior-runtime rollback targets.

New Jersey follows actual archive/year/candidate controls. Senate lists are
optional when none is published; this family covers federal legislative offices,
not presidential tickets, odd-year state offices or local ballots. Published
amendment revision dates and districts govern replacement. A newer complete list
supersedes older amendments while retaining their zero-contribution provenance;
ambiguous same-day
versions require review. Missouri follows the actual certification link and
explicit calendar date. A changed unexpired publication set retains the accepted
catalog for review. Only 2026 was observed; future even-year cases are synthetic.
Neither family constructs a yearly candidate filename or invents an election date.

Fulton retains all 98 current facts and their original IDs. Its catalog binds
actual dated consolidated PDF links, optional qualified county write-in notices
and the independent official PSC scope page. Future odd/even November dates must
be explicitly published; separate special dates and primary elections are not
inferred. Policy fingerprints and relevant policy links are rechecked during
discovery. Changed unexpired document sets retain the accepted catalog for review.
The collector requires the optional bounded-worker Poppler capability declared in
`fultonCollectorContract`; no production tool installation is implied. Original
reviewed 2026 data remains readable without that capability. Worker failures stay
visible and never advance successful import clocks. Successful automatic files
require a compatible runtime; the exact original reviewed file is the rollback
data target. Future-cycle tests are synthetic, not observed future candidacies.

Johnson County retains the existing 98-record current source and its original IDs.
Future `ks-johnson-general-YYYY-MM-DD` sources require the complete published
index/selector/election-page capture before a selected candidate page is accepted.
No election IDs or dates are guessed, and primary or special-election controls
are not imported as regular general elections. Empty future pages require the
publisher's exact empty-result layout, validated election identity and unfiltered
controls; they remain durable waiting receipts rather than successful imports.
Unknown office/status layouts still need review. The dated 2026 spelling note
does not carry into later elections. One normal current-source GET remains
compatible with existing snapshots; all new future captures bind discovery.
Discovery and selected reports use bounded normal HTTPS with zero redirects.
Persistent external catalogs and a single collection owner support unattended
refresh; source publication alone does not install or verify a receiving-host job.

Stable family identifiers retain their original descriptor bindings; future
instances do not require editing those descriptors. Discovery reads the official election selector or an explicit published general-election date,
not a predicted URL, numerical election-ID sequence or computed election date.
Primary, separate special-election dates and conservation elections are outside
these families. Virginia's general-day publication explicitly includes special
offices; their unexpired terms remain distinct and legislative applicability is
withheld until verified.

Virginia catalogs additionally retain each published report kind/URL and an
optional all-office URL. Annual paths are never constructed. A currently offered
date and its links must match again at collection; changing an unexpired report
set retains the accepted catalog for review. An empty, otherwise validated future
table waits durably rather than becoming a successful zero-record import. Strict
HTML category/schema checks cover combined and historical split federal formats.
Future rollover tests are synthetic, not observed future candidate claims.

Michigan reads actual even-year general-report links in the filing section,
validates the report's state/judicial scope and explicit regular-general date,
then reuses those captured report bytes during import. A source cache miss reads
the published index and only its selected report. Future instances require the
index/report evidence envelope; legacy current raw captures remain compatible.
Only 2026 was observed live. Future overlap, waiting, cached recovery and hot/cold
runtime rollover are tested with synthetic evidence, not future candidacies.

All 716 existing Michigan identities remain exact. The report counts 721
individuals because five governor tickets include running mates. Exact columns,
known status codes, complete report totals and regional judicial geography stay
validated. In 187 judicial records, the combined column's literal INCUMBENT is
now an explicit incumbency fact, not a party. No political party is inferred.
Existing cached records receive the same correction without rewriting their bytes
or advancing capture clocks. Standard storage retains the compatible legacy
encoding, so older runtimes can still read rollback data; the public API exposes
incumbency separately. All other normalized fields and IDs remain unchanged.
A complete future report with zero candidates waits durably; format,
status, date or unexpired-election drift retains accepted data for review. The
publisher's current as-of label is September 4 without an explicit year; capture
time proves retrieval, not later publisher revision or a complete local ballot.
County reports, including the separately reviewed Tuscola source, remain separate.

Normal pinned transport verifies both publishers with no redirects. Michigan's
wildcard robots exclusions do not cover the election homepage; the candidate
host's robots request returns 404. Neither observation grants republication
rights. Only normalized factual records enter this adapter; raw reports remain
external/private and broader collection/publication approvals remain distinct.

Utah reads the candidate link from Candidate Essentials and pairs its year with
Election Day in the same published regular-general cycle. It does not discover
municipal elections or invent future URLs/dates. The current five section tables
and an optional explicitly headed State Offices table are validated in order;
unknown headings, statuses, missing tables or conflicting years fail closed.
Only Election Candidate and Write-In rows enter the general roster. Judicial
retention and school districts retain their existing geography safeguards.
Complete future table sets without eligible records enter durable waiting, not a
successful empty import. A changed unexpired election retains the accepted catalog.

The normal Utah transport shares a process-local request queue with at least ten
seconds between request starts, matching its observed robots crawl interval.
Discovery fetches two pages; a cache miss downloads the candidate page separately.
Use one approved collector owner per external dataset and scheduled cache warming:
the queue is not a cross-process lock, and cold or concurrent requests may exceed
the public API request deadline. This source validation does not install a host
scheduler or authorize additional collection. The initial candidate request timed
out; an unchanged, interval-respecting retry succeeded. No future Utah cycle was
observed in the live evidence; future-cycle tests are synthetic.

Kentucky intersects explicitly published general-election dates with the candidate
selector's offered general IDs. Overlapping published years are retained; neither
the next year, an ID sequence, a primary election nor the election-date rule
creates a future source. Each office page uses its own normal public dropdown
postback when needed, echoing known form state and blank search/party filters.
Requests remain pinned HTTPS with zero redirects; private form state stays in the
local capture rather than source configuration or public records.

The original five-page core descriptor and all 210 current record values/IDs are
unchanged. A separate external court/prosecutor source adds 143 records: 139 listed,
three write-in filings and one inactive. Court IDs retain full district/division
labels and distinguish Family Court from Circuit Court. The original core includes
one historical inactive district-judge record also represented in the new source;
these are source entries, not a count of unique eligible candidates. Future core
and court families separate that inactive evidence. Governor tickets and other
published non-court office controls are discovered rather than fixed to 2026 IDs.

Active office totals and actual section totals must reconcile. The root inactive
counter currently says 16, while the selected 2026 general inactive page has four
rows. Its scope is unverified, so that aggregate is not treated as a reconciled
selected-election total or proof of completeness. The four actual rows remain
inactive evidence. Missing pages, ambiguous lifecycle mappings, contradictory
dates or changed controls preserve accepted data and require intervention.
Fully validated empty future sets use the existing durable waiting protocol;
accepted nonempty snapshots take precedence over earlier waiting receipts.

Only the 2026 general election is currently offered with a matching calendar date;
odd-year/overlapping future rollover is synthetic test evidence, not future
candidacies. The separate county-filings page and binary export have no verified
explicit election identity and remain outside these families. Filings and raw
regional labels do not establish qualification or personal eligibility. Addresses,
phone numbers, emails and filing dates are excluded from normalized records.

Florida local collection uses the published `LOC` control, separately from the
unchanged `STA` family. The collector validates both public forms, the complete
26-column TSV and the 67-row county codebook. Source candidate IDs distinguish
otherwise identical names/offices. District/circuit and group/seat labels remain
source facts; reported counties are searchable area labels, not verified office
jurisdictions or personal ballot matches. Voter IDs, addresses, phone numbers,
email addresses and treasurer details are not normalized or published.

The reviewed local export contains Windows-1252 bytes without a declared charset.
Only this candidate-download request opts into strict UTF-8 first, then reviewed
Windows-1252 decoding. All other text requests retain strict UTF-8; DNS, HTTPS,
redirect, timeout and size checks remain unchanged. A local source-format capture
binds the public form, county codebook and decoded rows, not a purported publisher
JSON API.

A fully validated header-only local export for a future election creates a
source-bound `.json.pending` receipt outside the release, never an empty accepted
snapshot. Its original capture time and combined capture hash are retained. The
ordinary cache TTL, clipped at Election Day, controls rechecks across process
restarts. New records are imported on the next due successful refresh. Transport
failures, changed layouts, mismatched elections and an empty refresh of accepted
data remain failures that preserve the accepted snapshot. Pending-evidence write
failures remain persistence failures. Source-pending status is not an imported
dataset or an exception. No collection/import clock is invented.

Maryland uses the same waiting-receipt protocol after complete discovery, date,
category, roster identity and CSV validation. A state CSV is empty only when its
HTML also has no candidate markers; local HTML/CSV counts must reconcile. The
old current statewide source descriptor and 369 normalized records remain exact.
Its legacy raw-CSV parser path remains current-source-only; future/local captures
require the complete evidence envelope. Published navigation, not a guessed next
year or `GG`/`PG` code, supplies future election identities. A future candidate link
that is not yet published is not synthesized; subsequent scheduled discovery can
acquire it when offered, preserving the prior catalog on failure.

County HTML sections establish publication groups for local records. Candidate
residential jurisdiction is used only to reconcile the two official views and is
never substituted for office geography. No addresses, phone numbers, gender,
email, social handles or residence labels enter normalized records. Public facts,
quoted nicknames, alpha districts and valid provided websites are retained. Four
duplicate lifecycle pairs prefer the inactive evidence rather than imply ballot
qualification. Local source-area labels participate in derived IDs without
changing prior IDs. No personal local-ballot assignment is inferred.

Default browsing orders unexpired sources ahead of expired ones and selects the
nearest published election. An unavailable/waiting nearest election is not silently
replaced with later-year filings. Explicit selection can still browse those future
filings. Catalogs and bulk collection retain all supported published instances.

Version-one automation receipts remain rollback-compatible: a validated pending
checkpoint uses `cached` with zero records and no failure reason. Only an actual
durable nonempty import advances successful collection/import clocks. The API
reports `awaitingRecords` only with confirmed pending evidence; real failures
retain the unavailable/error state. Older runtimes ignore the separate pending
sidecars. Enabling this additional family requires the matching runtime and its
separate approved catalog/allowlist; rollback retains the prior runtime's supported
configuration rather than enabling an unknown family there.
Selector-based discovery permits one HTTPS redirect within the approved official
host to its current election. Wyoming, Delaware and Dakota discovery and candidate reads use
zero redirects. Candidate-specific downloads retain their zero-redirect,
exact-election checks.

## Data contract

Florida discovery reads the actual public download form, including its approved
state-candidate type, all-office/status controls and submit target. The published
`YYYYMMDD-GEN` value supplies the full date; neither the date nor election ID is
predicted. Its index currently offers 2026, 2028 and 2030 regular elections.
An offered future election is not evidence of a qualified or complete ballot.
Collection revalidates the form before posting its exact selected identifier;
the TSV retains existing status, literal-name and other-election exclusion rules.
County/municipal candidate collection is outside this state-filed family.

South Carolina discovery uses the ordinary public selector's reviewed year and
election-list endpoints. Only years offered by that selector are requested.
The bounded internal capture contains the index, linked selection script, year
response and each selected year's election response. Its hash binds the complete
capture, not a claim that the publisher exposes this envelope. Explicit dates,
IDs and display labels must agree; primary, presidential-primary and special
entries do not become regular general elections. Candidate headings, hidden IDs,
export labels, filters, complete result tables and detail links are independently
bound to that election. Published state-Senate districts and presidential tickets
are supported for later cycles. An explicitly undesignated presidential running
mate remains missing, not an inferred ticket. Local county identities, inactive
history, literal party labels and current normalized identifiers remain intact.

The Dakota families pair officially published candidate IDs with explicit dates
in linked election calendars. South Dakota's year-scoped election-information
sections bind each calendar and candidate link; identical desktop/mobile menus
are reconciled, while conflicting identities fail closed. North Dakota's current
candidate card and calendar supply its year, public election ID and full date.
Its older voter-portal landing page is not used as the current discovery index.
Neither family calculates an election date or enumerates numeric IDs.

Dakota discovery is a bounded internal JSON capture containing exactly `page`
and `calendars`, with each calendar containing only its observed `url` and `body`.
The catalog's discovery URL remains the fixed official index; its SHA-256 binds
the complete capture, not a claim that the publisher provides this JSON API.
Only the exact approved index/calendar hosts and paths are requested, without
redirects. An unexpired election disappearing or changing identity preserves the
accepted catalog for review. North Dakota's shared current calendar may omit an
older, expired-year card without requiring an invented historical date.

Candidate collection independently checks the exact form target, selected
election year/type, public controls and unfiltered selections. South Dakota's
complete CSV count must match the public report; valid withdrawal dates may
precede the election year but cannot follow the election. North Dakota retains
its unpaginated complete table, excludes unnamed vacancies and keeps county
identities distinct. The verified current rosters contain 745 and 717 records,
respectively; all normalized facts and IDs remain unchanged by cycle support.
Contacts remain excluded and local records do not establish personal eligibility.

Delaware discovery requires the official candidate-index heading and dated
`Statewide General` links to matching year-specific HTML rosters. Collection
independently checks the roster's exact general-election heading, complete table
and six public fields. Undated, duplicate, conflicting, primary, redirected and
off-host replacements fail closed. A year is never used to calculate an election
date or guess whether an unpublished roster exists.

Delaware's published county field now distinguishes local candidate records.
This changes derived IDs for the 28 local rows in the verified 128-record 2026
roster, while preserving the other candidate facts. Accepted snapshots retain
their bytes until a successful refresh. County labels alone do not establish
personal ballot eligibility. Private addresses and contact fields remain excluded;
filing and qualification statuses remain distinct.

Wyoming discovery reconciles the explicit general-election date, the matching
election-information section and both published roster links. The roster's
`Election` column must match the descriptor's year and general-election label on
every row. Conflicting dates, primary replacements, wrong-year files and altered
transport endpoints fail closed. Published numbered `STATE SENATOR` and
`STATE REPRESENTATIVE` labels supply the legislative district; judicial regions
remain local and are not inferred from an address or ZIP centroid.

The corrected district field changes derived IDs for the 114 legislative rows
in the verified 151-record 2026 roster. Existing accepted snapshots retain their
bytes until a normal successful source refresh. A fresh normalized snapshot uses
the corrected IDs and district matching. The reviewed original descriptor,
capture metadata and canonical transferred datasets remain unchanged.

Collection results record an explicit `imported` flag from successful durable
writes, not a comparison between capture and run timestamps. A cached read in
the same millisecond as an earlier write remains cached. Configuration, catalogs,
allowlists and snapshots use the same supplied validation clock in rollover
rehearsals; normal runtime behavior continues to use the real clock.

The version-one catalog contains exactly:

- `schemaVersion: 1`, `type: "state-ballot-cycle-catalog"` and `familyId`.
- `sourceConfigurationSha256`, binding the reviewed compiled source descriptor.
- `discovery`: the fixed official landing URL, discovery-payload SHA-256 and original
  retrieval time.
- `elections`: explicit official `electionId` and ISO `electionDate` pairs.
  Mississippi, Wyoming and Delaware have no published numeric election ID in these reports,
  so their `electionId` is exactly `null`. A date-derived fake ID is never substituted.

The family controls the HTTPS origin, path, parser, scope limitations and general
election label. Catalog entries cannot supply arbitrary URLs, parsers, methods,
hosts, publication approvals or manual-source overrides. Duplicate/conflicting
identities, unsupported dates, future capture times, unknown fields, symlinked
files and oversized/nonregular files are rejected.

The original November 2026 election retains its existing identifier and stored
snapshot binding. New instance identifiers use each family's prefix, followed by
`YYYY-MM-DD`, for example `de-general-2028-11-07`; source
labels include the election year to distinguish cycles. Every fetched candidate
page must independently select the exact official election ID
and date, expose the expected unfiltered controls and reconcile all pages and
candidate identities. Montana derives the selected election, hidden year label
and date from the catalog while retaining its exact statewide county selection,
incumbent legend, public CSV control, approved columns and complete-count checks.
A catalog entry alone does not establish available content.

Mississippi retains its fixed public report URL. Discovery requires the exact
public form, heading, CSV control and one consistent, explicit general-election
date. Collection independently checks that date against the selected instance.
Every CSV candidate name, including withheld undated records, must reconcile
with the complete public HTML tables. Truncated exports, replaced names and
changed table layouts fail closed. A blank-name office row is excluded only
when its otherwise empty CSV fields match an explicit public no-candidates
notice for that exact office. Rows without an explicit matching date stay
withheld; a conflicting pair of date fields is a review error. Regular House
races are not relabeled special elections, and legislative districts are not
described as judicial districts.

## Runtime integration

`back-end/src/manage-state-ballot-cycles.ts` is the source entry point; the build
emits `back-end/dist/manage-state-ballot-cycles.js`. It uses
`STATE_BALLOT_DATA_DIR` and either catalog configuration below, all outside the
checkout or immutable release:

- `STATE_BALLOT_CYCLE_CATALOG` remains the compatible single Washington path.
- `STATE_BALLOT_CYCLE_CATALOGS` is a bounded JSON object mapping approved family
  IDs to distinct absolute catalog file paths, for example
  `{"wa-general-2026":"/var/lib/ballotclarity/cycles/washington.json","mt-general-2026":"/var/lib/ballotclarity/cycles/montana.json"}`.

The two catalog variables are mutually exclusive. Unknown/manual families,
relative or repeated paths, cross-family catalog replacement and mismatched
family/file contents are rejected. The existing enabled-state and exact enabled-source filters
remain operative. An exact source-ID allowlist intentionally does not opt into
all future elections.

`STATE_BALLOT_ENABLED_FAMILIES=wa-general-2026,mt-general-2026,ms-sos-2026,wy-sos-2026,de-doe-2026,sd-sos-2026,nd-sos-2026` explicitly opts into
those families' current and future instances alongside an existing exact source-ID
allowlist. Each family's state must remain in any enabled-state filter. One family
cannot widen another family's exact source filter and
cannot enable a manual source or another publisher. This one-time opt-in avoids
adding each future election ID to the environment by hand. Without it, exact
source-ID filters retain their existing behavior.

Synchronization discovers official cycles, atomically updates the catalog and
uses the existing strict adapters and external snapshot storage. Results identify
each election as available, unavailable, persistence-failed or expired. Unchanged
discovery preserves its original capture metadata; fresh snapshots reuse the
existing bounded cache rather than downloading again. Repeated runs replace
source/election snapshots, not append duplicate candidates. Each family runs
independently: a discovery or collection failure in one does not prevent the
other from completing. Single-family output retains the original result fields;
multi-family output contains a `families` array with `completed` or `failed`
results. The command exits nonzero for any discovery, collection or durable-write
failure, even when another family succeeds.

The repository and record routes reread accepted catalog updates on subsequent
requests, without a restart. A malformed runtime update retains the process's
last accepted descriptors and reports source unavailability through its existing
callback with the affected family state. Cold startup rejects an invalid configured
catalog; synchronization rejects an invalid catalog for its own family. Failed
candidate reads or writes preserve the previous durable snapshot. An unexpired
election disappearing or changing identity stops catalog replacement for review.
After an election expires, Mississippi can roll its fixed URL to a later
published date. Existing snapshots retain their original source/date identities;
new content is never written into the expired election. The fixed URL does not
provide archive browsing, and this work adds no archival API.

## District of Columbia

`dc-boe-2026` follows actually offered election-year controls and explicit general
dates. All three general, ANC and registered-write-in publications are required;
partial future sets stay pending. Primary and special elections remain separate.
No dates, paths or future candidates are predicted.

The complete policy footer/link inventory and linked accessibility statement
are bound to reviewed fingerprints. The source-specific reviewed robots 404
leaves other policy gates intact. Collection uses the maintained absolute-path
PDF text worker; persisted API reads are converter-independent.

Original PDF hashes and URLs drive refreshes, including same-URL revisions. The
first automatic replacement retains the exact reviewed envelope. Failed collection,
backup or persistence preserves accepted data and clocks. Disappearing accepted
candidates/publications require review. See the [source review](audits/2026-10-26-dc-automation.md)
for actual 2026 acquisition and separately synthetic future compatibility. Federal/
shadow citizenship rules and distinct ward/ANC applicability remain intact.

## Cassia County, Idaho

`id-cassia-2026` discovers explicit November general-election headings and actual
offered PDFs from the county's rolling sample index. Its publication set and
source-policy review are part of the capture contract. Future pending pages,
changed links, freshness-based same-URL refresh, exact durable restart and
recoverable reviewed-to-automatic replacement use the existing cycle worker.
Unfamiliar layouts or office types remain review exceptions. Current facts and
all supporting/question-only documents reconcile with the original packet.
See `docs/audits/2026-10-26-idaho-cassia-automation.md` for scope and boundaries.

## Boundaries

These supported source families are not nationwide future-election automation.
Other adapters still have cycle-specific discovery or parsing work. Reviewed
PDF/image conversion, measure interpretation, independently verified geography,
rights review, ballot publication, archival browsing, host scheduling, monitoring
and accepted production operation remain separate requirements. The application
deployer is not the data scheduler. Source availability is not evidence of a
complete personalized ballot.

Validation includes retained Washington and Montana 2026 data, Montana's current
official landing/selector, Mississippi's current public form/CSV and all 190
dated records, an explicitly synthetic Mississippi 2027 cycle and synthetic
Washington/Montana 2028 cycles.
Delaware validation reconciles all 128 current public rows and independently
tests a synthetic 2028 discovery and roster. Synthetic fixtures test discovery through cold API reads, idempotence, election
isolation and failure preservation; they make no claim about actual 2028
publication, candidate identities or official election IDs.
