# Union County municipal question guides

`back-end/dist/prepare-union-measure-guides.js PLAN.json` joins the complete
policy-bound sample captures with source-bound editorial review and the existing
native measure-guide assembler.
The recurring worker's generated question plan supplies the complete capture
pins, so callers reuse discovered editions rather than maintain annual URLs or
form lists.

```json
{
  "schemaVersion": 1,
  "type": "union-measure-guide-preparation",
  "ballotCaptures": [
    { "path": "/private/capture.json", "sha256": "<capture SHA-256>" }
  ],
  "review": null,
  "baseSnapshot": null,
  "outputDirectory": "/private/union-measure-review",
  "outputName": "union-measures"
}
```

Every offered form is validated through native positioned and layout text.
The output retains both publisher languages, interpretive statements, choices,
municipal labels, document hashes and original clocks. Conflicting forms and
incomplete capture sets stop preparation. An empty question inventory creates
no guide placeholders.

The first pass emits an editorial template. A reviewed file supplies a concise
title, summary, yes/no meanings and municipal type for each question. Its pin
replaces `review: null` in a subsequent plan. The review binds the exact bilingual
question/statement bytes and every corroborating form's identity and hash;
changed or disappeared questions, altered witnesses and incomplete reviews stay
held. Publication and automatic-import authority remain false. Compatible future
editions use the same code and their actually offered dates and documents.

Each prepared municipality gets its own city/town/township/village scope and a
stable date-bound measure identity, rather than statewide or countywide coverage.
The measure carries the exact English question and one official sample citation;
the full bilingual and multi-form evidence stays in the accompanying research.
Reviewed English explanations do not assert translation equivalence, current-law
verification, election results or personal eligibility. Independent legal,
fiscal and advocacy fields remain empty unless separately sourced through the
maintained draft workflow.

Prepared files include native drafts, guide bundles, draft workflows, provenance
CSV and review diagnostics. A pinned `baseSnapshot` optionally produces an
append-only coverage proposal while preserving the existing primary guide.
Standalone preparation emits no primary-replacement snapshot. Original captures,
review files and the base remain unchanged; public reads use assembled data
without invoking converters or publisher requests. Host review, publication,
scheduling and geographic-applicability acceptance remain separate.

The shared assembler conveys scope through jurisdiction names and ballot-question
headings. It omits generic descriptions of missing races and implementation-stage
freshness labels while retaining official-confirmation flags and draft gates.
Election overviews link single-question ballot items directly to the measure,
preserving the viewed election context. Candidate races and multi-question
contests retain their full contest pages.
