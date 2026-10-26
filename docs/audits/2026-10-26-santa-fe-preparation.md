# Santa Fe native candidate preparation

## Outcome

The existing local candidate-preparation command can read Santa Fe County's
reviewed master PDF directly, without a separately transcribed candidate CSV.
This is preparation automation, not authorization to collect or publish data.
The source remains an external manual snapshot; its automatic-import and
publication approvals remain false.

The retained fifteen-page master, SHA-256
`424899bd085291589ada4c0f591c8f43c353a05fc4d1cc97bd3b940331906890`,
reproduces all 46 existing records, including every field and identifier. The
source dates remain October 22, not this preparation's execution time. Candidate
pages are 1–5. The separately retained sample contributes no additional records;
its broken embedded font mapping remains a limitation, not evidence of emptiness.

## Local input contract

The existing `prepare-reviewed-candidates` plan, exact source fingerprint,
document set, hashes, capture clocks, page counts, reviewed pages and external
output restrictions still apply. For this source, replace the CSV input with:

```json
{
  "format": "santa-fe-master-pdf",
  "path": "/absolute/path/to/reviewed-master.pdf",
  "sha256": "<reviewed PDF SHA-256>"
}
```

The input must be the first configured document, at its exact reviewed path and
hash. The worker uses the existing absolute `STATE_BALLOT_PDFTOTEXT` capability
and bounded native bounding-box extraction. A missing converter, changed source
fingerprint, unreviewed candidate page, invalid election date, unknown office,
new party code, truncated text or changed geometry fails before output creation.
The original CSV mode remains available and unchanged.

The parser reads printed election identity, office blocks, complete wrapped
names, party codes and named retention questions. It has no candidate-name or
current-year allowlist. Synthetic future-date tests demonstrate the same format
with different names and a different printed date; they are not future-election
evidence. A future configured source still requires its own exact review plan.

Joint governor/lieutenant-governor names remain the printed combined choice.
County-wide `ALL` style labels do not make local offices statewide or establish
personal ballot eligibility. Three legislative/congressional matching holds
remain unchanged. English retention questions must agree with their named
choice and office heading. Measure text and yes/no options never become people.
Only the two previously reviewed office spelling corrections are normalized.

## Collection policy assessment

Normal, pinned requests on October 26 returned the county's robots file,
homepage and election index successfully. The homepage's **Website Policies &
Use** link points to
[the privacy-policy page](https://www.santafecountynm.gov/additional-information/privacy-policy).
That page returned HTTP 200 but contains old parks-advisory membership and
biographies, not inspectable website-use terms. Its captured body has SHA-256
`4c634edf85359278f878b6325f572f619233da304272852ae7540b9cfaf0f43b`.
Collection remains held pending an inspectable policy or appropriate permission.
No new county election PDF was fetched in this assessment.

The state candidate portal's separate AI-agent exclusion remains effective for
this research. Neither county preparation nor the missing county policy grants
permission to contact that portal, changes the existing non-AI server importer's
wildcard policy, or establishes statewide coverage.

## Verification boundary

Native extraction is compared against the exact retained originals and accepted
records. Local source/compiled preparation, connected API rendering and normal
repository checks establish source readiness, not server receipt, scheduled
collection, production import or public activation. Existing accepted data and
the pending private-data archive remain separate from source/runtime delivery.
