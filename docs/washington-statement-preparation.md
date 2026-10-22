# Washington statement preparation

Official candidate-list downloads remain separate from candidate-authored
background information. The permitted Washington candidate adapter can refresh
the official roster into persistent external storage. This preparation command
does not download statements, import data, schedule jobs, or approve campaign
claims automatically.

```bash
node back-end/dist/manage-election-references.js prepare-washington /approved/staging/plan.json
```

## Local inputs

Construct the plan from verified local captures. It must contain exactly:

- `schemaVersion`: `1`.
- `type`: `washington-statement-preparation`.
- `sourceId`: the configured Washington reference collection, such as
  `wa-state-statements-2026`.
- `candidateFile`: absolute path to a configured official Washington snapshot,
  in the exported snapshot format rather than its internal cache envelope.
- `referenceFiles`: absolute paths to all preceding configured Washington reference
  snapshots for that election, including the preceding congressional and
  Legislative District 1 collections. They prevent duplicate profiles.
- `documents`: one object per configured document, in registry order. Each has
  exactly `url`, `path`, `capturedAt`, and `sha256`. Paths are absolute regular
  local files; hashes and times describe the actual successful capture.
- `reviewedFactsFile`: absolute path to the explicit factual review described
  below.
- `outputDirectory`: a fresh absolute directory physically outside the checkout
  or immutable release. Existing output files are never overwritten.

The review file contains exactly `schemaVersion: 1`,
`type: "washington-statement-review"`, the same `sourceId`, `reviewed: true`, and
`facts`. Each fact contains exactly these fields:

| Field | Meaning |
| --- | --- |
| `sourceCandidateId` | Exact published race/candidate association from the official roster. |
| `statementSha256` | SHA-256 of the candidate's exact captured `Statement` HTML string. |
| `field` | One of `Elected Experience`, `Legal/Judicial Experience`, `Other Professional Experience`, `Education`, or `Community Service`. |
| `evidence` | Exact normalized text anchor within that factual section. |
| `text` | A reviewed plain-text factual paraphrase, at most 600 characters. |

An explicit review flag and matching anchor are not evidence of factual truth.
The reviewer must check that the paraphrase follows from the cited section and
does not turn attendance, coursework, an in-progress degree, or an institutional
list into a completed qualification. Missing fields do not imply no education or
experience. Do not extract slogans, endorsements, policy promises, family or
medical information, private contact details, or images. Candidate authorship
remains explicit even when the state hosts the document.

## Fail-closed preparation

The command binds source configuration, election ID/date, source bytes, capture
time, exact ballot identity, office, jurisdiction, statement hash and factual
section. It rejects preview/county modes, repeated identities, unmatched facts,
changed evidence, duplicate facts, missing preceding collections, and files
outside the local-file bounds. A candidate without reviewed facts is held rather
than given invented background. At most six reviewed facts are accepted per
profile; list views still show compact identity summaries, not every fact.

Outputs are `election-references-SOURCE_ID.json` and
`washington-statement-preparation.json`. The latter records identities, hashes,
counts and holds. Neither output contains raw statements, photos or contact
fields. `publisherRequests: 0` and `imported: false` describe preparation only.
Validate counts, holds, source identity and all factual deltas before a separate,
independently authorized reference import. Retain healthy preceding data on any
unexpected loss or source change.

Captures are read sequentially rather than allocating hundreds of maximum-size
file buffers at once. Each response is bounded to 6 MiB and the combined captured
body to 128 MiB. Statement HTML, section lengths, nesting and node counts have
separate bounds. Preparation never decodes captured images.

## Downloading and future elections

Under independently approved host collection authority, store source captures,
review inputs and accepted datasets outside Git and immutable runtime releases.
Renew exact-host robots/reuse review, verify the normal public guide and its
actual endpoint contract, and use only observed election/race IDs. Capture normal
verified HTTPS responses with conservative spacing and bounded sizes. Never
reuse this workstation's capture time for a different download, infer approval
from an internal flag, retry denied exports through another identity, or use
preview, private-voter or submission tools. The earlier CSV-export and King
County publisher exclusions remain in force.

`washington-statement-sources.ts` holds the reviewed document metadata. The
current new collection describes 125 observed statewide/legislative races for
November 3, 2026, excluding the already covered Legislative District 1 races.
Old configurations are unchanged. No raw dataset belongs in Git or a code
artifact. Automatic staging must not become automatic factual approval.

A future election needs a newly reviewed roster, publisher policy, normal-client
contract, election/race IDs, collection ID/date, identity and parser tests, runtime
release, and approved data import. Never repoint the 2026 collection at a new
election or infer qualification from biography or an approximate location.
