# Orange County candidate proof preparation

## Current offered source

Orange County's [candidate page](https://ocvote.gov/candidates) offers a
[printable filing log](https://ocvote.gov/candidates/candidate-filing-log-printable-version).
Its actual general-election selection maps to the county's
[GEN2026 report](https://ocvote.gov/fileadmin/user_upload/data/candlog/GEN2026/candlog.pdf).
Normal public-address-pinned HTTPS requests retrieve those pages and the PDF
under the county's current robots rules. The older offered `/vc/web/` link
redirects to HTTP; that downgrade is not followed. The separate canonical
HTTPS link already present in the candidate navigation is used directly.

The inspected root, candidate and printable pages have no terms, copyright,
privacy or licensing links in their footer or legal-link inventory. No
restrictive reuse notice appears in the report's extracted text. This supports
factual source preparation, not a blanket license to republish the website,
document, seal, fonts, candidate statements or other third-party material.
Raw captures remain local and outside Git and release assets. San Diego's
separately linked county policies still require their own collection review.
California's statewide CDN access hold remains unchanged.

## Complete report reconciliation

The 188-page report explicitly names the November 3, 2026 general election,
qualified candidates and contests on the ballot. It contains 430 named
candidate references in 169 distinct contests, with 356 repeated contest
headers. All names, literal party labels, ballot designations, qualification
dates and contest-scoped candidate identifiers reconcile between the native XML
and separately exported layout text. Both exports use Poppler; this is not
independent native-font or rendered-visibility proof.

The per-contest `Num Cands` fields sum to 449, while `Num Qualified` and the
actually enumerated names sum to 430. The unnamed 19-person difference is not
invented or imported. The report's final `Total Candidates Filed: 430` label
is preserved as a report total rather than used to erase that distinction.
Incumbents printed in contextual rows do not become candidate entries. The
asterisk denotes a filing extension, not incumbency. Ballot-designation text
remains source-provided wording, not independently verified biography.

The reader preserves distinct source office and district labels, shared-county
labels, vote-for limits and each contest's continuation pages. It handles a
new contest beginning at the bottom of a page before its shared-jurisdiction
row continues on the next page. It requires that context before reading a
candidate and reconciles every qualified count. IDs are unique within a
contest, not across the entire PDF. No ZIP, postal label, school area or special
district is assigned to a voter by this preparation.

Printed civil clocks remain separate for every page: August 28, 2026,
3:47:35 p.m. on page 1 and 3:48:21 p.m. on later pages. No timezone or new
publication date is inferred from the October retrieval.

## Remaining automation work

The pure reader has bounded XML/page/DOM/font contracts and rejects changed
scope, counts, party labels, qualification fields, missing candidates, unknown
critical text, hidden or active markup and contradictory continuations.
Future-election fixtures are synthetic and require the new report's explicit
date; they do not assert that a future publication is available.

This is a preparation dependency for a reusable county collector, not an
enabled family or a new accepted dataset. Five embedded TrueType programs,
their character mappings, meaningful rendered placement and page completeness
still need automated native verification. Discovery, policy-change handling,
durable import/restart, public routes and receiving-host acceptance remain
required before enabling the family. Existing California records, configured
families and the active pending data packet remain unchanged.

Native preparation retains five embedded font programs and a visually reviewed
296-character source-glyph atlas. Sixty-three mappings fall outside the
report's own declared ToUnicode code-space ranges. That discrepancy remains
explicit: matching extracted strings and a manual atlas are not a substitute
for an automated original-outline and rendered-placement verifier. No PDF
software bounds, existing font approvals or production collection gates are
broadened by this preparation.
