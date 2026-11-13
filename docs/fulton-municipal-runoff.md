# Fulton municipal runoff preparation

The reusable native-text preparer reads the county's single-page, three-column
municipal runoff ballot layout. It follows the explicit printed election date
and municipality headings, preserving office, district and at-large wording,
vote limit, named candidates and printed incumbency. Party, election outcome,
current officeholding and residential applicability remain unasserted.

```sh
STATE_BALLOT_PDFTOHTML=/absolute/poppler/pdftohtml \
  node back-end/dist/prepare-fulton-municipal-runoff.js ballot.pdf capture.json
STATE_BALLOT_PDFTOHTML=/absolute/poppler/pdftohtml \
  node back-end/dist/prepare-fulton-municipal-runoff.js ballot.pdf capture.json csv
```

The capture metadata supplies the exact official URL, original `retrievedAt`,
SHA-256 and byte length. Preparation checks the original PDF bytes before
bounded native extraction. It performs no network requests or persistent writes.
JSON and CSV retain the original capture clock; PDF creation/modification metadata
is not substituted for an unknown publisher-issued date. Stable identities bind
the election, municipality, office, district and candidate. Explicit future dates
reuse the same reader without annual edits or a calculated prior general election.

The official [December 2, 2025 sample](https://www.fultoncountyga.gov/-/media/Departments/Registration-and-Elections/2025-Election/Sample-Ballots/2025-12-02-Runoff-Election-composite-ballot-v1.pdf)
reconciles 24 named candidates across twelve offices in five municipalities.
Four candidates have printed incumbency. Atlanta's Board of Education District 8
At Large stays distinct from a geographic District 8. The retained PDF was
visually reviewed against the native output. Its original bytes remain external
to Git and immutable runtime artifacts.

This prepares a review inventory, with publication, personal applicability and
automatic collection flags false. Source registration, rolling-index discovery,
native/visible-text admission, approved import/publication and recurring host
activation remain separate integration work. The current county index offers
the November 2026 general ballot; the historical runoff sample establishes a
layout, without asserting a December 2026 runoff or a current candidate slate.

The bounded reader requires the reviewed one-page dimensions, fonts, municipality
headers, office classes, one-vote/two-candidate contests and unambiguous column
placement. Changed layouts, missing candidates, duplicate identities, unsupported
text and inconsistent dates require review. The known `SAMPLE` watermark is kept
outside substantive fields; generic PDF-grid and inspection gates stay unchanged.
