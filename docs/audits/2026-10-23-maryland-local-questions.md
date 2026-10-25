# Maryland local ballot questions, October 23, 2026

## Added review content

The retained [State Board of Elections publication](https://elections.maryland.gov/elections/2026/ballot_questions.html)
contains three statewide and 48 local questions. This review adds short original
summaries and binary-choice explanations for all 48 local questions, arranged in
nine unpublished native guides. The three previously prepared statewide questions
and all original source/review files remain unchanged.

| Area | Local questions | Native scope |
| --- | ---: | --- |
| Anne Arundel County | 3 | County |
| Baltimore County | 14 | County |
| Baltimore City | 9 | Independent city |
| Cecil County | 1 | County |
| Dorchester County | 4 | County |
| Frederick County | 1 | County |
| Howard County | 2 | County |
| Prince George's County | 10 | County |
| Wicomico County | 4 | County |

The curation retains each official question identifier and exact printed
For/Against option pair. It summarizes the complete question body, including
explicit outcome sentences embedded within paragraphs, without treating missing
extracted outcome fields as evidence that the source contains no explanation.
The raw parser output is not rewritten. No campaign position or fiscal benefit
is inferred from favorable wording in a government's explanation.

Eighteen borrowing authorizations retain their individual principal amounts and
purposes. Principal is not presented as interest or total repayment. Baltimore
City's proposed Baby Fund is described as an annual city-budget contribution of
$0.03 per $100 of taxable property value, not as a newly calculated tax rate or
a household cost forecast. Express implementation dates remain conditional on
approval, including the December 2030 Council-seat change and Baltimore's
different 2026, 2028 and 2029 dates. No common effective date is invented.

The source repeats the Question F topic heading on Baltimore City's Question G.
The separate G body describes franchises and minor privileges. Its original
record and identifier are preserved, while the authored display title follows
the body rather than merging it with F. Unknown publication dates, total debt
service, unreviewed translations and incomplete personal-ballot coverage remain
explicit review limitations.

## Independent-city geography

The [Census geography definition](https://www.census.gov/programs-surveys/geography/technical-documentation/boundary-change-notes.html)
distinguishes Baltimore City from Baltimore County and treats independent cities
as county equivalents. The native preparation contract now accepts the explicit
`independent-city` type. Lookup matches its exact reviewed county-equivalent name
against county geography; it does not guess from a locality named Baltimore or
strip the meaningful word City. No other existing city or county changes type.

Independent-city guides can receive the same response-only, published,
same-state/same-date statewide-measure composition as other local guides. Stored
publication states, source identities and the primary guide are not changed by
composition. Unknown or neighboring county geography cannot select this guide
merely because a locality has a similar name.

## Collection and validation boundary

Multi-area rendering exposed a saved-plan defect: the page counted all stored
choices rather than valid entries in the loaded ballot, producing "26 of 12"
and an overflowing progress bar. Completion and the remaining-review list now
derive from entries resolved against the current ballot. The store is unchanged;
other guides' choices are retained. Browser checks preserve all 48 choices,
verify area-specific counts and exclude a stale, unresolved choice from progress.

The expanded print review also exposed a fixed two-column layout that overflowed
on a narrow page with a longer question title. Printable guide/plan columns now
have a readable minimum width and fall back to one column when necessary. Text
is not reduced, clipped or hidden to make the layout pass.

Unfinished questions now show their actual titles as whole-row detail links,
instead of repeating a generic office/category label and empty rationale.
Inherited statewide-question links retain the local guide context. Their
substantive details remain on the existing question pages without a dropdown.

An initial browser assertion expected the local-only scope warning even when
statewide measures were composed into the response. The corrected assertion
requires the existing combined statewide/local limitation. This was a harness
expectation error, distinct from the subsequently found product progress defect;
both original diagnostics remain in the local review evidence.

The original six Maryland policy/index/question captures are hash-verified and
replayed through the existing `md-question-documents-2026` configuration. No
publisher request, alternate identity, new state policy interpretation or new
collection authorization is needed for this retained-data review. Future source
or election changes still require reviewed configuration, source hashes,
curation and publication decisions; collection alone does not write public copy.

Validation covers all 48 detail pages and nine area flows at narrow/wide widths
and in light/dark modes, including source links, saved choices, reload and actual
print media. The publication matrix separately tests state-only, local-only,
both, neither, city-only and county-only cases. It includes neighboring,
missing-county and foreign-state geography. Original statewide questions,
Washington/Virginia/New Mexico rollups and accepted/held candidate snapshots are
preserved. No content dropdown, new navigation or interface commentary is added.

The prepared-data archive is separate from source Git and contains no raw HTML
or server-AI handoff. Its private handoff is ignored, indexed and backed up.
Source publication, data transfer/import, production operation and scheduling
remain unperformed independent approval steps. Local tests are not proof of
production activation. Nationwide and local coverage remain incomplete.

## Other source review

A newly discovered Kentucky amendment page was not downloaded into accepted
evidence. The ordinary robots request returned 404 and the homepage returned
302 before the linked-use-policy review could be completed. No redirect,
alternate host/identity or trust override was followed, and no Kentucky collector
was added. This is an incomplete policy/transport review, not a confirmed legal
prohibition. Existing Ohio and other publisher holds were not retried or bypassed.
