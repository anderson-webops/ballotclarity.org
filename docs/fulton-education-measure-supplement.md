# Education-notice fiscal supplementation

`prepare-fulton-education-measure.js` connects a pinned, unpublished Fulton
education-measure draft with the maintained collector's original notice capture.
It produces a separate native draft, fiscal CSV, review record and hash manifest.
Those outputs feed the existing measure-guide preparation and review workflow.

```json
{
  "schemaVersion": 1,
  "type": "fulton-education-measure-supplement",
  "draft": { "path": "/external-data/education-draft.json", "sha256": "DRAFT_SHA256" },
  "capture": { "path": "/external-data/notice/capture.json", "sha256": "CAPTURE_SHA256" },
  "measureSlug": "reviewed-education-measure",
  "outputDirectory": "/external-data/education-supplement"
}
```

The maintained absolute `STATE_BALLOT_PDFTOTEXT` executable supplies bounded
native extraction. The command makes no publisher requests and never replaces an
existing output. It checks the election, county, one-percent education tax, tax
start/period, collection ceiling, both school allocations and bond principal.
Rates, annual limits and page citations come from the captured notice, supporting
compatible future editions without hardcoded election dates, amounts or principal years.
The document binding retains the pages checked by extraction; independent
substantive review remains separate.

Original question wording, Yes/No meanings, context, uncertainties, identities and
freshness clocks remain intact. Existing fiscal rows or source bindings require
exact equality or a separate replacement review. The maximum rate stays distinct
from an actual borrowing rate. The original capture clock and both parent hashes
remain in the review evidence; independent editorial/legal review is not inferred.

The supplement reconciles fiscal anchors rather than asserting identical full
notice/ballot wording. Personal applicability, outcomes, publication, import and
scoped recurring activation retain their independent gates. Original drafts and
source documents remain outside Git and immutable runtime artifacts.
