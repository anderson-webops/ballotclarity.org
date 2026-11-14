# Union County public-question preparation

The [Union County sample collector](union-county-candidate-research.md) retains
actually offered final sample forms with both publishers' policy checks, original
bytes, hashes, clocks and geographic labels. Public-question preparation reuses
those complete pinned captures offline. It makes no publisher requests and runs
outside public request handling.

## Input and output

The compiled command is `back-end/dist/prepare-union-ballot-questions.js`:

```json
{
  "schemaVersion": 1,
  "type": "union-ballot-question-preparation",
  "ballotCaptures": [
    { "path": "/external-research/batch-1/capture.json", "sha256": "<capture SHA-256>" },
    { "path": "/external-research/batch-2/capture.json", "sha256": "<capture SHA-256>" }
  ],
  "outputRoot": "/external-research/questions"
}
```

The same capture loader serves candidate comparison and question preparation.
It verifies original bytes, the complete source/policy inventory, original clocks,
request spacing, identical edition catalogs and every offered form exactly once.
Missing, duplicated, altered or conflicting captures require review before output.
The output root uses the existing external-storage and process-held lock boundary;
each successful preparation writes a new directory without replacing prior data.

`questions.csv` and `questions.json` retain both publisher-provided languages:
question wording, interpretive statement, printed yes/no labels, municipal context
and all supporting forms/pages/URLs/hashes/clocks. Records receive an identifier
derived from election, municipality and the literal question evidence. The CSV's
source arrays align by ascending form identifier. Repeated preparation is byte-
identical and preserves acquisition clocks rather than refreshing them.

## Native extraction boundary

The native reader first validates the sample's date, form, municipality, visible
layout and single-page geometry. It then checks the reviewed public-question
panel, both language headings, yes/no boxes, all four paragraphs and complete
panel bounds. Every paragraph line agrees with ordinary text extraction. Both
extractions use the same maintained Poppler executable; their agreement is a
layout/extraction check, not independent publisher verification.

The supported format contains one bilingual question panel per sample and one
question per municipality. Equivalent forms contribute separate citations to one
record. Conflicting wording or statements, partial languages, additional headings,
unknown choices, clipped text and unconsumed panel lines hold preparation. A new
election uses the actually offered edition and date. Changed question wording
creates new evidence; no year, source URL or translated wording is guessed.

Samples without this panel remain part of the complete research inventory. That
inventory creates no public empty-state text. Image-only or changed-layout
documents need separate reviewed support. The preparation neither generates vote
advice nor establishes legal effects, translation equivalence or a voter's ballot.
Substantive review, rights/applicability, application import/publication and
recurring scheduling remain separate approvals.

## Retained November 3, 2026 question

All 42 retained samples were checked. Elizabeth forms 7 through 12 contain the
same English and Spanish question and interpretive statement. The question asks
whether to add a twenty-dollar annual rent-increase cap, retaining the lower of
three percent or twenty dollars. The publisher's statement describes approval
as restoring that cap and rejection as leaving the ordinance unchanged. Those
are attributed ballot statements, not an independently verified account of
current law. Other forms contribute no panel to this reviewed format.

The six sample citations remain distinct, with the original November 14 capture
times. Earlier candidate-reference evidence, the Ann/Anne name discrepancy and
existing New Jersey public records stay unchanged. Raw documents and prepared
research remain outside Git and public runtime assets.
