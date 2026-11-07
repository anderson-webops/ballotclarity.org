# Maui Native Measure Preparation

The Maui collector supplies county-authored questions and resolution identities.
Native preparation connects those facts to the existing measure, contest,
election and source models while retaining substantive publication review.

Run the compiled `back-end/dist/prepare-maui-measure-guides.js` with one JSON plan:

```json
{
  "schemaVersion": 1,
  "type": "maui-measure-guide-preparation",
  "capture": { "path": "/external/county-capture.json", "sha256": "CAPTURE_SHA256" },
  "review": null,
  "documents": [
    {
      "resolution": "RESOLUTION_ID",
      "path": "/external/original-resolution.pdf",
      "sha256": "RESOLUTION_SHA256",
      "url": "EXACT_OFFERED_RESOLUTION_URL",
      "capturedAt": "ORIGINAL_CAPTURE_INSTANT"
    }
  ],
  "baseSnapshot": null,
  "outputDirectory": "/external/fresh-preparation-directory",
  "outputName": "maui-measure-review"
}
```

Each input is an original file pinned by SHA-256. The collector's capture bundle
must reproduce its stored county inventory exactly. Each question needs one
matching resolution URL and original PDF capture. Preparation performs no network
requests and keeps state-source holds outside this county collection.

## Editorial Review

A plan with `review: null` produces a private review template and disposition.
It creates no invented explanations or publishable measure pages. Complete the
template with a short neutral summary, the effects of approving and rejecting
the proposal, reviewed PDF pages and the editorial review timestamp. Pin that
file in the plan's `review` field with the same `path` and `sha256` structure.

Review rows bind the exact official question and resolution-document hashes.
Unchanged source material can reuse reviewed wording without advancing the
editorial review clock. New questions, changed text or documents, incomplete
interpretations and disappeared questions produce explicit review issues rather
than silently reusing or deleting records. Election identity stays exact; a prior
cycle's review never becomes approval for a different election.

Original question text, publication dates, capture dates and editorial timestamps
retain their separate meanings. Blank analysis, fiscal, advocacy and uncertainty
fields remain blank. Conditional vote effects do not establish election results
or imply that a proposal became law.

## Native Outputs

Completed editorial inputs produce a native draft and invoke the established
state-measure guide preparer. The result includes county-scoped measure and
contest pages, an election guide, draft publication workflows, a provenance CSV,
diagnostics and file hashes. Existing schemas, readiness checks, geographic
requirements, publication approvals and automatic-import gates remain unchanged.

`baseSnapshot: null` prepares a standalone county guide. A pinned base uses the
existing append-only preparation mode, preserving its primary guide and prior
additional guides. Output directories must be fresh, physical and external to
the application. Repeat attempts never overwrite an earlier preparation.

Assembly plans contain local absolute paths for reproducibility on their host.
Portable delivery consists of the native content, original evidence and hashes;
local paths are resolved against the receiving host's retained files. Preparation,
receipt, substantive approval, import, publication and scheduling stay distinct.
