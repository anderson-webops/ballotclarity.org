# Lafayette ballot research preparation

The offline `back-end/dist/prepare-lafayette-ballot-research.js PLAN.json` command
reconciles One Acadiana's dated native PDF with the government's independently
published proposition questions. It produces `research.json`, `measures.csv`,
`candidates.csv` and a hash inventory in a new external directory. Existing output
is never replaced.

```json
{
  "schemaVersion": 1,
  "type": "lafayette-ballot-research-preparation",
  "electionDate": "2030-12-14",
  "guide": {
    "path": "/external/research/guide.pdf",
    "sha256": "<original PDF SHA-256>",
    "url": "https://www.oneacadiana.org/wp-content/uploads/GeauxVote_Dec2030_BallotGuide-FINAL-v2.pdf",
    "capturedAt": "<original capture timestamp>"
  },
  "governmentPage": {
    "path": "/external/research/government.html",
    "sha256": "<original HTML SHA-256>",
    "url": "https://www.lafayettela.info/",
    "capturedAt": "<original capture timestamp>"
  },
  "outputDirectory": "/external/research/prepared-edition"
}
```

This future-date example is synthetic. Actual editions require the literal
matching date in both publications and the PDF filename. Policy-reviewed original
acquisition and the government referral remain separate evidence. The preparer
performs no publisher requests and supplies no recurring collector enrollment.

The existing bounded Poppler worker extracts at most twenty pages. Both original
hashes and original capture clocks are preserved. Complete question sets must
match after Unicode, whitespace and quotation normalization. Parish and city questions
remain separate even when their printed numbers coincide. Missing, duplicate,
changed, foreign-source or oversized inputs require review before output.

Each record retains both publishers' numbers and its exact question fingerprint.
Conflicting numbers produce explicit review entries. Canonical proposition
numbers remain unset. Placeholder council-resolution identifiers are retained
as unresolved evidence. Even agreement establishes neither certification nor
personal ballot eligibility; all outputs remain research with import/publication
approval false. There is no public API, bootstrap import or new runtime setting.

Fiscal extraction distinguishes bond authorization, maximum term and interest
from estimated annual tax revenue, tax rates and tax years. It supplies no promise
about personal tax bills, a future interest rate, project completion or revenue.
Future compatible editions reuse the same inputs and command; changed layouts or
unreconciled questions stay held. Retain the original publications privately and
review rights before reproducing third-party explanations or artwork.

Fiscal headings must agree with their question bodies. A separately printed
City Court runoff table can contribute source-stated candidate names, parties
and the printed electorate description. It establishes neither official
qualification nor geographic matching. Unknown offices, parties, extra columns
or repeated names require review. No candidate is inferred when that table is
absent. All candidate references retain the original guide-page citation.
