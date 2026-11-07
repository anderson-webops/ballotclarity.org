# Fairbanks Recurring Candidates

The `fairbanks-pdf` family follows the independent borough's offered sample and
election-notice PDFs. Current and future dates come from agreement between the
index and both publications. The family constructs no annual document URLs,
candidate names or election outcomes. The initial source is `ak-fairbanks-2026`;
later published dates receive `ak-fairbanks-municipal-YYYY-MM-DD` identifiers.

## Collection And Storage

Existing cycle synchronization collects the reviewed publisher policies and
paired original PDFs, derives native/rendered evidence, normalizes named
candidates, and writes external state snapshots. The original borough, Fairbanks
city and North Pole jurisdictions stay distinct. Printed term years and vote
limits are retained; blank write-in rows create no people. Party, incumbency,
results, a full term-end date and voter applicability are not inferred.

The bounded worker uses the maintained tool paths documented in
[native preparation](fairbanks-native-candidates.md). Cycle synchronization owns
a `fairbanks-evidence` child directory alongside external snapshots. Direct
collection can use `STATE_BALLOT_FAIRBANKS_EVIDENCE_DIR`. It requires a physical,
private directory outside the application release. Immutable evidence files and
an atomically replaced `fairbanks-last-capture.json` preserve original acquisition
clocks and source bytes. Exact unchanged PDF bytes reuse verified native evidence;
actual publisher checks advance independently. Original converter fingerprints
remain attached to reused evidence.
Unchanged checks replace only the latest capture; they create no duplicate full
evidence archive. Changed document, index, policy or approval content retains a
new immutable capture.

An exclusive `fairbanks-collection.lock` rejects overlapping collectors. Normal
completion and failures release the owned lock. A process interruption can leave
an abandoned lock for reviewed recovery after verifying the collector has stopped.
Accepted evidence remains intact. Lock existence by itself does not establish a
running process. Evidence retention remains an explicit storage-management concern.

## Review Boundaries

The existing 30-day publisher-access review remains operative. A renewed approval
can be supplied through an external `STATE_BALLOT_FAIRBANKS_REVIEW_FILE`, using
the collection plan's `reviewedAt`, `robotsSha256`, `indexLinksSha256` and
`accessibilitySha256` fields. Fingerprints remain tied to the reviewed publisher
policies; external renewal supplies no new host, URL or policy authority.

Unaccounted text or selection rows, altered geometry, mismatched publications,
unknown layouts, removed accepted candidates, policy changes and failed native
conversion hold the collected update. Snapshot persistence failure retains the
served last-good records. Fairbanks cycle catalogs advance only after selected
current sources have persisted successfully; expired entries remain separate.

The October 6, 2026 source is historical. Explicit archive requests can read its
stored candidates; current lookup and expired collection preserve their cutoffs.
`ballotPreview: false` keeps these multi-municipality publications separate from
an address-personalized ballot. Public API/page requests read stored records and
run neither native conversion nor publisher acquisition. Full evidence stays
private to the collection role, outside public API payloads and release assets.

Source enrollment, substantive cohort approval, production import, publication
and recurring scheduling retain their existing independent gates. This source
does not enable scheduling or import merely by being included in a release.

The same retained native evidence now supplies [ballot questions](fairbanks-ballot-questions.md),
including official yes/no effects and actual combined-notice page links. Earlier
candidate-only snapshots remain readable. Reversible data adoption preserves
the earlier snapshot alongside any older runtime that rejects question metadata.
