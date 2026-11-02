# Native publication readers and retained-data reconciliation

## Reader and collector roles

The stored-reader branch covered newer native adapters but omitted twelve older
families, including Connecticut and Clark County. An expired cache could therefore
make an ordinary reader contact the publisher and run conversion. A failed refresh
then hid otherwise readable stored records. Conversely, the unconditional branch
for newer formats also prevented explicitly selected direct collectors from
refreshing without a cycle catalog.

Bulk publication readers now load accepted external snapshots without publisher work or
conversion, including after cache expiry, a previous miss or restart. The original
capture timestamp remains unchanged. Explicit collection retains its existing
`refreshReviewedLegacy` or collection-index boundary. Current source binding,
pending-publication handling, future timestamps, election-end limits and external
storage validation remain enforced. Source publication activates no scheduler.

PDF sources and the existing batch-workbook/roster adapters define this boundary.
Ordinary CSV/JSON and other non-bulk sources retain their existing cache-expiry,
pending-publication and refresh behavior. External storage by itself does not
establish a source's acquisition role.

Regression coverage exercises every configured native format's public/direct
boundary and Connecticut/Clark stale persistence, late imports and restarts.
Existing family-index and legacy rollback checks remain in place.

## Retained data

A compiled-reader audit found that the canonical Connecticut and Clark research
snapshots lack metadata required by their newer automatic readers. Their original
files remain historical evidence, not newly rewritten successful imports.

Replaying the retained original captures through the current compiled parsers
produces 813 Connecticut candidate/office records and 254 Clark County records.
All 709 prior Connecticut records and 254 prior Clark records retain every field
and ID; Connecticut contributes 104 additional records, not a claim of 104 unique
people. All 169 Connecticut PDFs and both independent Clark publications were
re-extracted with bounded native converters. Every derived document matches its
retained capture exactly. No OCR, nominee inference or publisher request is used.

Original October 25 capture dates, source document hashes, joint tickets,
cross-endorsement labels, municipal/regional scope and printed vote limits remain
attached. This offline reconciliation establishes format/provenance compatibility,
not a new publisher revision, current completeness or personal-ballot eligibility.
Substantive import, publication, recurring collection and receiving-host acceptance
remain separate.

## Browser-test isolation

Three repeated startup traces reached hydrated, responsive local pages while the
external analytics script remained pending beyond the document-load deadline.
The voter-resilience browser helper now blocks that tracker explicitly, retaining
the complete-document, hydration, heartbeat and bounded-persistence assertions.
This also keeps synthetic resilience visits out of live analytics. The separate
compiled-output tracker check continues to verify production tracker wiring;
public application analytics behavior is unchanged.
