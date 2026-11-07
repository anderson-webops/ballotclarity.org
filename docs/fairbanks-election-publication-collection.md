# Fairbanks Election Publication Collection

The explicit `collect-fairbanks-election-publications` worker collects the two
original publications actually offered by the independent borough election index.
Public visitors continue reading accepted stored data without contacting publishers
or running converters. Candidate parsing/import is a separate, unfinished stage.

Run the compiled `back-end/dist/collect-fairbanks-election-publications.js` with
one JSON plan:

```json
{
  "schemaVersion": 1,
  "type": "fairbanks-election-publication-collection",
  "outputDirectory": "/external/fairbanks-evidence",
  "accessReview": {
    "reviewedAt": "REVIEWED_ISO_INSTANT",
    "robotsSha256": "REVIEWED_ROBOTS_SHA256",
    "indexLinksSha256": "REVIEWED_LEGAL_INVENTORY_SHA256",
    "accessibilitySha256": "REVIEWED_ACCESSIBILITY_SHA256"
  },
  "previousCapture": null
}
```

A previous immutable bundle can be pinned as `{ "path": "/external/bundle.json",
"sha256": "BUNDLE_SHA256" }`. Unchanged document bytes retain original capture
clocks; actual checks advance separately. The previous bundle remains unchanged.

## Collection Contract

- Fresh publisher robots, the complete legal-link/footer inventory and the linked
  accessibility statement must match the reviewed fingerprints. Access review
  expires after 30 days. Applicable AI-crawler restrictions remain operative.
- Discovery reads the explicit regular-election date and both offered sample and
  notice links. It constructs no annual document paths or future slate.
- The index, sample and notice must agree on their election identity. Calendar
  wording and printed weekday/date contradictions require review.
- All transport is bounded HTTPS on the reviewed publisher, with no redirects,
  policy-compliant pacing, maintained Poppler extraction and byte/page limits.
- Complete original PDF bytes, original HTML, hashes, capture/check clocks and
  extracted text remain in an immutable external bundle. Exact retries verify
  stored bytes; conflicts and failed acquisition preserve earlier bundles.

The worker configuration is `STATE_BALLOT_PDFTOTEXT`, an absolute maintained
Poppler executable in the existing bounded collection role. Storage uses an
exclusive, synchronized temporary file and atomic publication into its physical
external directory. Collection has no import, publication or scheduling authority.

## Reviewed Historical Content

The October 6, 2026 material supplies 15 borough candidate entries, four City of
Fairbanks entries and three City of North Pole entries. The latter office permits
two selections; the other ten offices permit one. All printed terms are three
years. Blank write-in lines remain separate from named people. The borough sample
has three questions; the North Pole sample has one. Municipalities remain distinct.

The prepared CSV and question inventory are review inputs. The separate
[native candidate preparer](fairbanks-native-candidates.md) corroborates printed
fields and the complete candidate selection-row inventory from retained originals.
Changed crop, rotation, page units, font mapping and covered text/selection rows
have bounded rejection checks. General font/paint-layer proofs, registered
candidate snapshots, geographic assignment, native measure preparation,
substantive approval and recurring enrollment remain open.
The automatic candidate-family catalog and its coverage counts are unchanged.

Synthetic 2027 October and November fixtures test actually printed dates and
schedule changes. They establish no future publication, winner or legal change.
See the [source review](audits/2026-11-07-fairbanks-and-louisiana-review.md).
