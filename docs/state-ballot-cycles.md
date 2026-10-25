# Reusable election cycles

External election catalogs opt the automatic candidate repository into reusable
source families. Without them, the existing 58 source
definitions, source ordering and source/state allowlists remain unchanged.

Twelve families are supported:

| Family | Discovery | Elections |
| --- | --- | --- |
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

Stable family identifiers retain their original descriptor bindings; future
instances do not require editing those descriptors. Discovery reads the official election selector or an explicit published general-election date,
not a predicted URL, numerical election-ID sequence or computed election date.
Primary, special and conservation elections are outside these families.

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

## Boundaries

These are twelve source families, not nationwide future-election automation.
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
