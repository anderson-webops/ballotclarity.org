# Maui Measure Automation

The managed worker connects county collection to pinned native preparation.
Its external profile contains collection/preparation directories, the existing
county access review and a bounded list of reviewed election cohorts. Each cohort
pins an editorial review, original resolution captures and an optional base
snapshot. Future cohorts extend configuration without an annual code change.

The compiled `back-end/dist/manage-maui-measures.js` accepts `run PLAN.json`,
`prepare PLAN.json` and `status PLAN.json`. `run` performs the existing policy-bound
collection before preparation. `prepare` and `status` use retained files only.
The profile has this shape:

```json
{
  "schemaVersion": 1,
  "type": "maui-measure-automation",
  "collectionDirectory": "/external/maui/collection",
  "preparationDirectory": "/external/maui/preparation",
  "accessReview": { "reviewedAt": "REVIEW_INSTANT", "robotsSha256": "ROBOTS_SHA256" },
  "cohorts": [
    {
      "electionDate": "ELECTION_DATE",
      "review": { "path": "/external/review.json", "sha256": "REVIEW_SHA256" },
      "documents": [],
      "baseSnapshot": null
    }
  ]
}
```

`documents` uses the resolution identities, paths, SHA-256 pins, offered URLs and
original capture clocks in the [native preparation contract](maui-measure-guide-preparation.md).
An empty cohort list discovers review work without generating interpretations.
Unknown elections, missing resolution evidence, changed questions and incomplete
reviews preserve earlier prepared guides and produce source-bound exceptions.
Invalid input bytes fail closed rather than silently becoming a fresh review.

Exact reviewed inputs reuse the existing prepared output and editorial clock.
Each new preparation has an immutable file receipt. Accepted pointers advance
after all output bytes and directories are synchronized and verified. Completed
outputs survive an interrupted journal update and can be adopted on restart.
Publisher and persistence failures retain the previous pointer. Storage remains
external and bounded to 64 preparations/128 MiB, with explicit retention review.

`MAUI_MEASURE_AUTOMATION_PLAN` optionally exposes its retained status through the
existing protected Operations API. Reads perform no collection or preparation.
Collection, source freshness, preparation, review and import remain separate.
The default runtime leaves this optional source unconfigured. Publication,
automatic import, source enrollment and recurring activation retain their existing
approval boundaries; generating a draft authorizes none of those stages.
