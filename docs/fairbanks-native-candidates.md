# Fairbanks Native Candidate Preparation

`prepare-fairbanks-ballot-candidates` prepares historical or future candidate
review inputs from an exact retained Fairbanks publication bundle. It performs
no publisher requests and retains the original acquisition clocks and document
hashes. It has no import, publication, geography-assignment or scheduling authority.

```json
{
  "schemaVersion": 1,
  "type": "fairbanks-native-candidate-preparation",
  "publicationBundle": {
    "path": "/external/fairbanks-publications.json",
    "sha256": "EXACT_PUBLICATION_BUNDLE_SHA256"
  },
  "outputDirectory": "/external/fairbanks-native"
}
```

The compiled command is `back-end/dist/prepare-fairbanks-ballot-candidates.js`.
Its separately confined collection role provides absolute maintained executable
paths in `STATE_BALLOT_PDFTOTEXT`, `STATE_BALLOT_PDFTOPPM`,
`STATE_BALLOT_PDFTOCAIRO`, `STATE_BALLOT_QPDF` and `STATE_BALLOT_TESSERACT`.
The last executable must report Tesseract 5. English
sparse-text recognition uses a fixed 300 DPI rendering and page-segmentation
mode 11. Conversion is sequential, single-threaded for recognition, bounded to
30 seconds per subprocess and 180 seconds across preparation. Byte, page,
geometry, output and temporary-storage bounds remain explicit.

## Fields And Source Agreement

Native coordinates identify ballot pages and columns, independently of prose
elsewhere in the notice. Exact rendered-word comparison corroborates the printed
date, municipality, office, term, selection limit and candidate name. Primary
facts require a recognition confidence of at least 70, an engine threshold rather
than a probability of correctness. Differences in spacing, periods, typographic
apostrophes, dash style and case are normalized only for comparison; the source
name and punctuation remain unchanged in the prepared record.

Blank write-in lines must match their literal printed label and expected count.
They contribute no candidate records. Their recognition confidence is not used
to establish a person. The notice's second borough copy must match the complete
primary borough slate and every printed field exactly. Low-confidence duplicate
text can corroborate an already established primary fact; it creates no new fact.

Party affiliation, incumbency, winners and uncontested status are never inferred.
The borough, Fairbanks city and North Pole records remain separate. A two-selection
office retains that limit. The geographic labels identify the publication's
municipality, not a personalized ballot assignment.

This is field-level rendered corroboration, not a general proof of every PDF
font, paint layer or viewer's appearance. Unknown headings, disagreeing copies,
missing pages, changed media dimensions and uncertain primary fields hold the
entire preparation for review. Native family enrollment and public publication
retain their separate acceptance requirements.

An independent rendered-oval inventory accounts for every named candidate and
blank write-in row within the printed candidate region. A missing native row
remains held even when recognition also misses its text. Unassigned recognized
words, extra or missing selection marks, clipping, hidden marks, low-contrast
strokes and later path paint covering a mark require review. Page metadata must
retain the reviewed media box, full crop, zero rotation and unit scale. These
checks are specific to the reviewed publisher layout; unfamiliar rendering
structures remain review work rather than expanding automatic acceptance.

## Durable Evidence

The immutable output includes the pinned source-bundle hash, original source
clocks, page geometry, native coordinates, rendered-image hashes, recognition
output, vector evidence and tool fingerprints in a version-2 bundle. Earlier
version-1 evidence stays immutable. Intermediate PDFs and images are temporary. Output installation
is synchronized and atomic, supports identical retries and rejects conflicts.
Previous evidence remains intact after conversion or persistence failure.

The independent borough publication and the notice supply 22 named October 6,
2026 candidates across 11 offices. Four rendered pages corroborate 134 fields
and 57 selection rows, including the repeated borough slate and blank write-ins.
Local copies with altered crop, rotation, page units, Unicode font mapping,
covered candidate text or covered selection marks all reject preparation while
preserving the accepted output. The future-cycle fixture changes the
printed date and term years without changing the parser or candidate names in
configuration. The [recurring candidate family](fairbanks-recurring-candidates.md)
uses these checks for external snapshots and stored-data API reads. Protected
cohort approval, production import, publication and scheduling remain separate.
