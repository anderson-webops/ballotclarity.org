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

The preparation command produces a review inventory, with publication, personal
applicability and automatic collection flags false. The separately registered
`ga-fulton-municipal-runoff-2025-12-02` family integrates rolling discovery and
stored candidate import with the existing state-ballot automation. Future source
IDs follow the explicit date printed in actually offered runoff publications.
The historical sample does not establish a December 2026 runoff or current slate.

## Recurring collection

The family uses the existing external cycle catalog and candidate-data directory.
Cycle synchronization creates a private `municipal-evidence` child directory;
direct discovery can use `STATE_BALLOT_FULTON_MUNICIPAL_EVIDENCE_DIR`. Configure
`STATE_BALLOT_PDFTOHTML`, `STATE_BALLOT_PDFTOPPM`, `STATE_BALLOT_QPDF` and
`STATE_BALLOT_TESSERACT` with maintained absolute native-tool paths. Rendered
preparation requires Tesseract 5 and bounds native execution, output and scratch
storage. Publisher starts are at least eleven seconds apart, with reviewed
robots/privacy fingerprints, public DNS/TLS checks and no redirect following.

Discovery follows only runoff-ballot links actually offered on the county's
sample-ballot index. An index containing only general-election publications
produces an empty runoff catalog. Calendar dates, filenames and prior elections
never create an assumed candidate slate. Missing active publications, changed
policies, unreadable layouts and candidate disappearance require review.

All substantive fields are independently read from 300-DPI rendered crops and
matched to the native identities, offices, municipalities, dates, vote limits
and incumbency. Every crop word requires at least 70 OCR confidence. Full-page
rendered text must stay within accounted fields, apart from the reviewed voting
marks beside candidate names. Inspected page geometry, original PDF hash, crop
bounds, raster hashes and converter fingerprints bind the evidence.

Original PDF bytes and complete verified captures remain in immutable private
files outside the application checkout and release assets. Stored public reads
run neither native tools nor publisher requests. Snapshot failure retains the
last accepted records, and catalogs advance after selected current imports
succeed. Historical records remain available through explicit source selection;
default and personal requests retain expiry and `ballotPreview: false`.

Source enrollment, substantive cohort approval, host import/publication and
recurring scheduling remain separately controlled. Native inventories retain
their original capture clocks and unknown party labels.

The bounded reader requires the reviewed one-page dimensions, fonts, municipality
headers, office classes, one-vote/two-candidate contests and unambiguous column
placement. Changed layouts, missing candidates, duplicate identities, unsupported
text and inconsistent dates require review. The known `SAMPLE` watermark is kept
outside substantive fields; generic PDF-grid and inspection gates stay unchanged.
