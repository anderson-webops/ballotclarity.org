# Maryland question review preparation

`back-end/src/prepare-maryland-questions.ts` prepares review records from a
retained Maryland State Board of Elections ballot-question HTML capture. The
compiled entrypoint is `back-end/dist/prepare-maryland-questions.js`.

Both accept exactly one JSON plan path. Preparation is offline: it does not
retrieve documents, import coverage, approve translations or publish a guide.

## Plan contract

The plan has exactly these fields:

| Field | Contract |
| --- | --- |
| `schemaVersion` | `1` |
| `type` | `maryland-question-review-preparation` |
| `electionDate` | A valid `YYYY-MM-DD` election date |
| `expectedAreas` | Ordered `{ label, questionIds }` groups matching the reviewed publication |
| `capture` | `{ path, url, sha256, capturedAt }` binding the original retained bytes and capture time |
| `outputDirectory` | A new absolute directory outside the application checkout or release |
| `outputName` | A bounded lowercase alphanumeric/hyphen file prefix |

The capture URL must be
`https://elections.maryland.gov/elections/YYYY/ballot_questions.html`, with the
same year as `electionDate`. A preparation timestamp cannot replace the original
capture time. The SHA-256 digest must match the retained file exactly. Linked
inputs, future capture timestamps and changed content fail closed.

An election-specific plan supplies the expected question identifiers and area
order. The source must contain its exact dated election heading and the closed
comment-period marker. The parser requires one unique content region, one
explicit supported For/Against pair per question, and substantive question text.
Unknown markup, duplicate or missing questions, different jurisdiction order,
invalid UTF-8, oversized documents and excessive nesting are rejected.

Known source labels map explicitly to the state, Anne Arundel, Baltimore County,
Baltimore City, Cecil, Dorchester, Frederick, Howard, Prince George's and Wicomico.
Baltimore City is a city, not Baltimore County. Newly observed jurisdictions need
a reviewed mapping before preparation; a label is never guessed into a county.
Future elections can change the plan's date, identifiers and capture binding,
but incompatible publisher markup still requires review.

## Outputs

The command creates five files:

- `<name>.jsonl`: metadata followed by one English question record per line.
- `<name>.csv`: one English question per row, including printed choice labels,
  available official effect statements, jurisdiction, source digest and time.
- `<name>-translations.jsonl`: separately scoped Spanish companions and their
  pending-translation and semantic-review status.
- `<name>-manifest.json`: provenance, counts and file hashes.
- `<name>-SHA256SUMS`: output integrity checks.

CSV cells receive formula-prefix escaping without changing JSON source text.
Publication dates remain unknown where the source provides none. Output files
are bounded; the output directory must not already exist and its parent must
resolve outside the application. Preparation never overwrites existing work.

All question records retain `personalBallotAssignment: false` and
`meaningInferred: false`. Missing official effect statements stay empty. Spanish
companions are not inserted into English text or approved for public use by this
parser. An explicit pending-translation notice remains a hold.

The review CSV is not a personal ballot. County or city publication alone does
not establish which local questions a particular address may vote on. Curated
native explanations use the separate state-measure guide preparation contract;
its source, coverage, workflow and publication checks still apply.

## Guarded HTML document collection

`ElectionDocumentSource` also supports an optional `documentFormat: "html"`.
That format requires bounded, nonempty `documentDateMarkers`, an exact document
path pattern and a reviewed `documentLinks` policy-link fingerprint. Responses
must have `text/html` content type and pass the collector's UTF-8, structure,
date-marker and policy-change checks. The offline CSV preparation step does not
replace these collection checks.

The Maryland collector binds the election index, question page, robots rules,
home-page policy links, privacy page and SBE policy index. A changed link set,
policy region, election marker, redirect or denied response is a review hold,
not permission to try a different publisher identity or alternate URL.

Omitting `documentFormat` retains existing PDF collection behavior and limits.
Collection stores external evidence only. Neither collection nor offline
preparation grants automatic import or public approval.
