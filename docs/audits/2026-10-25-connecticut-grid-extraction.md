# Connecticut ballot-grid extraction preparation

## Verified source material

The [official November 2026 town-ballot index](https://portal.ct.gov/sots/election-services/town-ballots/2026-november-town-election-ballots)
now offers 169 town documents. The retained review covered 134. Ordinary,
certificate-verified HTTPS acquired the other 35 documents on October 25, with
the reviewed robots rules, serial requests and at least eleven seconds between
requests. The existing 134 revision URLs remain offered without changes.
All 169 original-byte hashes were checked during extraction.

The combined corpus has 609 pages and 18,562 printed candidate-line claims.
It prepares 813 candidacy/context records, not 813 unique people:

| Scope | Prepared records |
| --- | ---: |
| Statewide | 10 |
| Congressional | 13 |
| State Senate | 70 |
| State House | 264 |
| Town/local context | 456 |

The original 134 documents reproduce all 709 reviewed records and 15,517
claims. Retaining their order and appending new towns preserves the existing
record names and identifiers instead of changing punctuation according to the
rolling index's first appearance. Original captures remain dated October 21;
new captures are dated October 25. Extraction time does not refresh source data.

## Reusable bounded worker

`state-ballot-pdf-grid.ts` combines Poppler's raw word boxes with its vector
grid lines. Raw logical order preserves the compressed Nonpartisan label in
Darien; geometric word centers preserve names without neighboring glyphs.
The Office/Party anchor selects the connected candidate table. Enclosing page
frames and unrelated drawings do not become candidates. Merged office headers,
bilingual anchors, physical party rows and position markers remain distinct.
Header voting-area labels such as `1A` are not candidate positions.

The optional worker uses absolute maintained Poppler paths:
`STATE_BALLOT_PDFTOTEXT` and `STATE_BALLOT_PDFTOCAIRO`. Bounds include a 12 MiB
PDF, 4 MiB per tool output, fifty pages, twelve seconds per child process,
sixty seconds per document and an explicit geometry-operation budget. SVG is
parsed as data, never executed or loaded in a browser. Persisted public facts
continue to require neither converter. No Python dependency is introduced.

## Evidence boundaries

- South Windsor's five supplied pages print no congressional, Senate or House
  district identifiers. Explicit unassigned-claim mode retains 47 such claims
  separately and excludes them from resolved candidacy records. It does not
  infer districts from names, ZIP codes, town names or adjacent ballots.
  The prepared resolved records cover 150 of 151 House districts, all 36 Senate
  districts and all five congressional districts. House district 14 remains
  unresolved in this corpus. Partial or malformed geographic headers still fail.
- Berlin prints three Board of Education names in an unlabelled row. Their
  affiliation remains unspecified, not inferred to be Nonpartisan or a party
  associated with a slot letter. South Windsor explicitly prints United
  Community Party, which is recognized as printed.
- Morris prints `Willian Tong` on its Democratic line and `William Tong` on its
  Working Families line. The same office/party/election across other towns
  corroborates the spelling correction, scoped to that exact town and 2026
  claim. The district-71 `Ferrucci III` suffix-comma variant is likewise scoped.
  Raw claims retain their original text. Existing DeLauro and Sanchez mappings
  remain scoped to 2026; unknown names are not matched fuzzily.
- Local records remain town contexts rather than verified probate, precinct or
  personalized-ballot geography. Question text and disconnected measure boxes
  require their separate complete-text and applicability review.
- No seals, logos, original PDFs, residential contact fields or expressive
  statements are added to Git, release assets or public candidate fields.

## Integration status

This is extraction preparation, not a completed automatic Connecticut adapter.
The configured Connecticut source still loads its previously reviewed manual
snapshot. The 813-record preparation has not replaced that acknowledged data.
Policy-bound acquisition, actually offered future election discovery, durable
automatic imports, Operations receipts, rollback and publication acceptance
still need integration. Future same-layout tests are synthetic, not proof of
future publications, presidential ballots or municipal-office layouts.

Oregon's separately approved v1.14.20 source release does not include this
unfinished Connecticut work. Nationwide automation remains incomplete.
