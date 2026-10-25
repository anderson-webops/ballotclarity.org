# Reusable election cycles

External election catalogs opt the automatic candidate repository into reusable
source families. Without them, the existing 56 source
definitions, source ordering and source/state allowlists remain unchanged.

Five families are supported:

| Family | Discovery | Elections |
| --- | --- | --- |
| `wa-general-2026` | [Washington candidate list](https://voter.votewa.gov/CandidateList.aspx) | General elections, including odd years |
| `mt-general-2026` | [Montana candidate list](https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx) | Federal general elections in even years |
| `ms-sos-2026` | [Mississippi qualifying list](https://www.sos.ms.gov/content/CandidateQualifying/default.aspx) | Explicitly dated November general-election records |
| `wy-sos-2026` | [Wyoming election center](https://sos.wyo.gov/elections/default.aspx) | Explicitly dated even-year general elections with matching CSV/PDF roster links |
| `de-doe-2026` | [Delaware candidate index](https://elections.delaware.gov/candidates/candidatelist/) | Explicitly dated even-year statewide general-election roster links |

Stable family identifiers retain their original descriptor bindings; future
instances do not require editing those descriptors. Discovery reads the official election selector or an explicit published general-election date,
not a predicted URL, numerical election-ID sequence or computed election date.
Primary, special and conservation elections are outside these families.
Selector-based discovery permits one HTTPS redirect within the approved official
host to its current election. Wyoming and Delaware discovery and candidate reads use
zero redirects. Candidate-specific downloads retain their zero-redirect,
exact-election checks.

## Data contract

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
- `discovery`: the fixed official landing URL, response SHA-256 and original
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

`STATE_BALLOT_ENABLED_FAMILIES=wa-general-2026,mt-general-2026,ms-sos-2026,wy-sos-2026,de-doe-2026` explicitly opts into
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

These are five source families, not nationwide future-election automation.
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
