# Connecticut automatic town-ballot imports

## Source and collection

The Secretary of the State's [town-ballot catalog](https://portal.ct.gov/SOTS/Election-Services/Town-Ballots/Ballots)
links the dated November 3, 2026 index. Its 169 offered town PDFs cover 609
pages. The candidate worker discovers those links instead of freezing their
revision URLs in a release. The existing 134-document, 709-record reviewed
reader remains a compatible fallback until a successful automatic import.

Collection uses validating HTTPS, pinned public addresses, zero redirects,
serial requests separated by at least eleven seconds and reviewed robots,
privacy, disclaimer and policy-link fingerprints. Policy or layout changes
require review. Only candidate facts and provenance are normalized; this is
not a license to reproduce seals, graphics or expressive statements. Separate
question-document permissions and publication gates remain independent.

The optional worker requires maintained Poppler executables at the absolute
paths configured by `STATE_BALLOT_PDFTOTEXT` and `STATE_BALLOT_PDFTOCAIRO`.
Input, output, page geometry and process execution remain bounded. Persisted
API reads require neither executable. Original PDFs and sanitized snapshots
remain external to the release and repository.

## Reusable flow

The `ct-sots-2026` source joins the existing configurable family mechanism.
Actually offered November election dates produce bounded external catalog
descriptors; no election paths, names or nominees are guessed. Candidate
normalization for a synthetic 2030 election exercises the currently reviewed
state-election layout. Presidential, municipal or otherwise changed office
sets require layout review rather than extrapolating from current candidates.

The ordered town/revision index has its own digest. An added town or revised
PDF invalidates a fresh candidate cache during cycle synchronization. Reordered
HTML does not. A missing previously accepted town, unknown policy, conflicting
nominee, missing geographic identifier or failed durable write cannot silently
replace accepted facts. An atomic first migration retains a byte-exact,
hash-addressed legacy envelope beside the external snapshot for compatible
runtime/data recovery.

The ordinary automation command and Operations receipts distinguish attempted
collection, successful durable import and cached reuse. Cached checks retain
the original capture and import clocks. Routine accepted imports need no
editorial queue action.

## Content boundaries

The retained 169-document replay produces 813 candidate/context records and
preserves every prior 709 ID and public field. The records include 10 statewide,
13 congressional, 70 state-Senate, 264 state-House and 456 local contexts.
These are not counts of unique people or personalized ballots.

Exactly 47 South Windsor district claims remain unassigned because their
printed pages omit congressional, Senate and House identifiers. They are not
assigned from names, ZIP codes or assumptions about the town. House district
14 remains unresolved; 150 of 151 House districts, all 36 Senate districts
and all five congressional districts have resolved records. Printed local
areas remain evidence rather than verified legal precinct or voter mappings.
Question cells are not promoted to an accepted measure dataset by this work.

The original capture clocks remain attached to an offline replay; replay time,
release publication and receiving-host scheduling are separate observations.
Source release, host capability and actual unattended host acceptance remain
separate delivery gates.
