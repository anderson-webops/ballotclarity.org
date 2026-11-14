# Lafayette measure-guide preparation

`back-end/dist/prepare-lafayette-measure-guides.js PLAN.json` composes the existing
[Lafayette source reconciliation](lafayette-ballot-research.md) with the
[state-measure preparation pipeline](state-measure-guide-preparation.md). It
creates separately scoped parish and city drafts, review evidence and assembled
guides. Preparation is offline and leaves active data and publication unchanged.

## Inputs

The plan requires `schemaVersion: 1`, `type: "lafayette-measure-guide-preparation"`,
`researchPlan`, `review`, `documents`, `baseSnapshot`, `outputDirectory` and
`outputName`. Each pinned input identifies an absolute `path` and exact `sha256`.
`outputName` is a lowercase slug; the physical external output directory must be
new and have an existing parent.

- `researchPlan` pins the existing four-field-source reconciliation plan. Its
  original PDF/HTML hashes, literal election date, question completeness, fiscal
  checks and original clocks are revalidated. Its old output directory is unused.
- `documents` supplies exactly one original council-call PDF for each represented
  area. Each supplies `path`, `sha256`, `area`, `resolution`, `url` and `capturedAt`.
  Parish and city use their respective `PR-` and `CR-` identifiers and actual
  document URLs returned by the public council archive. Source adoption dates
  and scan metadata never become assumed publication dates.
- `review` is null for an initial template or pins a completed editorial review.
  Rows bind exact question and call hashes, the adopted-call number, reviewed
  question/notice/certification pages, and concise summary/Yes/No meanings.
  Ambiguous numbering, changed documents, missing or newly offered questions and
  incomplete review produce a review report without native drafts.
- `baseSnapshot` is null for standalone guides or pins the existing coverage
  snapshot for additive review assembly. Existing scopes and publication
  decisions retain the generic preparer's preservation checks.

The maintained Poppler worker validates real page bounds through bounded
`bbox-layout` extraction, including image-only PDFs. This supplies page inventory,
not OCR or automatic certification. The full original call remains the reviewed
wording source. `STATE_BALLOT_PDFTOTEXT` uses the same existing worker setup as
source reconciliation. Lafayette source/review inputs are bounded to 32 MiB
together, with the existing 12-MiB per-file limit and fifty-page call limit.
Optional base assembly retains the generic preparer's separate input limits.

## Outputs and review

Successful review emits two native drafts when both areas are represented,
`preparation-review.json`, an editorial template, the generic assembly plan, its
prepared guide outputs and `MANIFEST.json`. An initial or stale review emits
only the template, diagnostics and manifest. Existing files are never replaced.

Parish measures retain the county-equivalent `Lafayette Parish` scope. City
measures retain `Lafayette` city scope. Slugs bind election date and question
fingerprint, independently of conflicting publisher numbers. Source citations
identify exact call pages. Original question text, capture clocks and unchanged
editorial clocks remain preserved. Candidate references are excluded.

Tax rates and estimated annual revenue retain their printed tax periods. Bond
authorization, maximum term, interest ceiling and referenced existing millage
remain distinct. The latter is not presented as a guaranteed future tax rate.
Explanations and advocacy arguments are not copied from third-party guides;
editorial vote meanings require separate source-bound review.
The reviewed summary also supplies the required explanation field; the existing
measure renderer deduplicates identical text rather than displaying it twice.

All outputs retain draft publication/import status, final-ballot/amendment review
and personal-applicability holds. Adopted-call numbering does not establish final
sample-ballot order. Review holds stay in preparation/workflow diagnostics rather
than becoming extra voter-facing absence notices. No publisher requests, recurring
collection enrollment or production configuration changes occur. Future compatible
editions reuse the same plan and reviewed-source contract.
