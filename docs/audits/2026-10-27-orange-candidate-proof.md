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

## Original-page verification

The bounded native worker independently checks the original PDF objects and all
188 freshly rendered pages, not just two text exports. It accepts five reviewed
embedded TrueType programs with 296 mapped characters and binds every rendered
nonspace character to one of 544 visually reviewed original outline shapes.
The accepted report has 23,487 text fields and 416,307 nonspace glyphs. Its 356
stroked category headings must reconstruct the approved glyph outlines exactly;
arbitrary vector paths, hidden text, low contrast, occlusion and consequential
clipping are rejected. Page order, geometry, colors, the first-page seal and
font-role inventories are checked together with the existing complete reader.

Forty-three repeated right-column district labels are partially clipped in the
original report; 32 also have suffix characters absent from its render. Only
that fixed metadata column may retain these discrepancies as source evidence.
Candidate names, party labels, offices, qualification dates, identifiers and
counts must remain complete. The verification explicitly leaves source district
labels unapproved for voter matching. A complete jurisdiction label in another
heading is not permission to infer a voter's district.

Sixty-three mappings fall outside the report's own declared ToUnicode code-space
ranges. They remain explicit in the proof and must independently agree with
Windows-1252 byte semantics, the original symbolic cmap and reviewed TrueType
outlines. Extraction does not silently repair the publisher's declarations.
The XML extractor suppresses the seal to avoid writing image files, while the
separate SVG verifier still requires the exact original first-page seal.

The explicit Orange County profile permits at most 256 pages, 8 MiB each for
XML and PDF objects, 2 MiB per SVG page, 128 MiB total rendered output and
180 seconds for verification. Existing standard, Chicago and NYC limits remain
unchanged. Native tools execute only in the bounded worker; no public route is
connected to this preparation. Raw fonts, document artwork and rendered pages
remain outside Git and release assets. Approval catalogs contain hashes only.

## Collection integration

The pure reader has bounded XML/page/DOM/font contracts and rejects changed
scope, counts, party labels, qualification fields, missing candidates, unknown
critical text, hidden or active markup and contradictory continuations.
Future-election fixtures are synthetic and require the new report's explicit
date; they do not assert that a future publication is available.

The `ca-orange-2026` family now consumes this native proof through reviewed
selector discovery and policy-bound collection. Every stored candidate is
validated again against its office scope, source status, vote limit, scoped ID
and civil source clock. See `2026-10-27-orange-automation.md` for discovery,
persistence and public-reader boundaries. Original preparation alone did not
enable collection. Receiving-host data acceptance and recurring collection
remain separate from local validation and source release.
