# Louisiana parish reference integration

The maintained parish collector's factual candidate research can be prepared for
the existing reference-data API and Directory. Collections remain attributed to
the independent nonprofit Power Coalition. They carry no official-candidate
binding, personal ballot assignment, election outcome or inferred election stage.
Their source titles identify the unofficial sample, and citations open the exact
original PDF page. Literal office labels, source-stated parties and seat counts
are retained. Publication parish is searchable source context, not an inferred
electorate or office jurisdiction.

## Preparation

`back-end/dist/prepare-louisiana-parish-references.js PLAN.json` accepts:

```json
{
  "schemaVersion": 1,
  "type": "louisiana-parish-reference-preparation",
  "captures": [{
    "path": "/external-research/intake/capture.json",
    "sha256": "<complete original capture manifest SHA-256>"
  }],
  "outputRoot": "/external-research/parish-references"
}
```

Each of at most twenty-five pins passes the existing full offline capture
verification and native candidate extraction. Every original byte, index,
navigation, CSV digest and capture clock stays bound to its capture. Preparation
makes zero publisher requests and preserves all previous research. If multiple
captures cover the same parish/election, the latest original index clock wins,
including its holds; conflicting captures at the same clock require review.

Output contains one standard reference snapshot per candidate-bearing parish,
`catalog.json` and `review.json`. Review retains every source occurrence and page,
held parish and capture/preparation pin. Identical inputs produce identical
catalog, snapshot and review bytes despite separate output directories. Native
question research stays separate. Missing, date-conflicting or empty candidate
publications create no importable snapshot. Preparation grants no publication,
import or recurring-collection approval.

## Optional external catalog

`LOUISIANA_PARISH_REFERENCE_CATALOG_PATH` selects an absolute, owner-private
regular file outside the runtime checkout. The default is disabled. The catalog
contains explicit dated editions and actual offered document URLs:

```json
{
  "schemaVersion": 1,
  "type": "louisiana-parish-reference-catalog",
  "editions": [{
    "electionDate": "2030-12-14",
    "publications": [{
      "parish": "Caddo",
      "url": "https://powercoalition.org/wp-content/uploads/2030/11/Caddo-SampleBallot-Printable-DEC-2030.pdf",
      "pages": [1, 2]
    }]
  }]
}
```

This is a synthetic schema example, not a discovered future publication. Actual
catalogs come from the collector's offered controls and dated captured edition.
Later editions need no source-code or annual-URL rewrite. The catalog is bounded
to twenty-five distinct dates, sixty-four parishes per date and 512 cited pages.
Unknown parishes, publishers, URL forms, repeated identities and invalid dates
fail closed. Existing configured reference sources remain unchanged. An invalid
Louisiana catalog does not disable other states' reference APIs.

The existing `manage-election-references.js import SNAPSHOT.json [...]` and
`export LA --source SOURCE_ID` use the same selected catalog and ordinary external
snapshot storage. A catalog alone supplies no records and performs no download,
import or publication. Readers invoke neither native converters nor publishers.
Default API/search selection honors the existing two-day election expiry and
selects the next dated edition; explicit CLI export retains historical access.

Reference rows can be reached through `/api/election-references/LA`, Directory
and name/source-title search, then their existing detail pages. These unofficial
collections are excluded from implicit official-candidate matching, preserving
stage and eligibility boundaries even when names/offices match. Existing source
reviews, protected host adoption, storage backups, publication approval and
recurring-collection permissions remain separate.
