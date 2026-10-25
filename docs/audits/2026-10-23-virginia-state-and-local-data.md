# Virginia state and local source review, October 23, 2026

## Official evidence

The [Virginia Department of Elections candidate/referendum index](https://www.elections.virginia.gov/casting-a-ballot/candidate-list/)
links the current November all-offices HTML and constitutional/local referendum
HTML. Normal, pinned transport returned HTTP 200 for both:

| Capture | Original capture time | Bytes | Publication rows |
| --- | --- | ---: | ---: |
| [All offices](https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-3-2026-gen-elect-all-offices/) | `2026-10-23T16:38:38.745Z` | 800,991 | 2,009 |
| [Amendments and local referenda](https://www.elections.virginia.gov/casting-a-ballot/candidate-list/november-2026-proposed-constitutional-amendments/) | `2026-10-23T16:38:27.575Z` | 84,473 | 67 |

The all-offices digest is
`0a86f3ca8847751149dec22447cf792cd76891de77691520d251636276b62013`.
The referendum digest is
`83ebbad68f47c11da4340aca23f04e8274b88436aae521f71fe0d808b3750466`.

Candidate appearances span 133 published localities. These are publication
occurrences, not 2,009 distinct people. The table repeats federal candidates by
locality and includes town, independent-city, school-board, other local and
special-election offices. Office terms, multi-seat counts, raw district labels
and party/ballot-order fields are not flattened into federal-only records.
Thirteen rows omit only the trailing postal-code cell; this exact exception is
reviewed, counted and flagged. Campaign contact/address fields are excluded from
the prepared review data.

The referendum publication has three statewide and 64 local questions across
52 localities: 62 `Locality` rows and two `District` rows. All currently carry
`Active: Yes`, which is not a Yes vote choice. The district rows remain scoped
review evidence, not questions assigned to every voter in their locality.

## Native state and county drafts

The three statewide explanations are checked against the Department's individual
[Question 1](https://www.elections.virginia.gov/election-law/proposed-constitutional-amendment-question-1/),
[Question 2](https://www.elections.virginia.gov/election-law/proposed-constitutional-amendment-question-2/)
and [Question 3](https://www.elections.virginia.gov/election-law/proposed-constitutional-amendment-question-3/)
pages, retained through standard transport:

- **Reproductive freedom:** the specified care decisions, narrow compelling
  interest/least-restrictive-means standard, third-trimester regulation and
  physician-judgment life/physical-or-mental-health/nonviability exceptions remain
  distinct. The draft does not claim an unconditional right without exceptions.
- **Marriage equality:** the current constitutional prohibition is described as
  unenforceable under the existing 2015 Supreme Court decision, not as a current
  enforceable same-sex marriage ban. The proposal replaces the text and protects
  equal recognition of lawful marriages between two adults.
- **Voting rights:** automatic restoration follows release from felony
  incarceration, while citizenship, age, residency and registration requirements
  remain. The proposal's specific court finding about understanding voting is
  not reduced to a diagnosis or generic incapacity label. Rights restoration is
  not represented as automatic voter registration.

The separately scoped Floyd County tax question is corroborated by the state
referendum table and the [county election publication](https://votefloydva.gov/current-elections/november-3-2026-general-special-election/).
It authorizes a retail sales tax of up to 1% for school construction/major
renovations and related financing costs, expiring June 30, 2046. Authorization
is not described as automatic imposition. No revenue estimate, start date,
retail exemption or effect on an existing tax rate is invented.

The county's town-council special election is not assigned to all county voters.
The native county guide contains only the selected tax question; the existing
state/local composer adds the three independently published statewide questions
only when both packages are published. Both standalone and combined guides keep
their partial-coverage limitations. Fiscal/effective-date gaps and unreviewed
translations remain explicit review holds rather than fabricated content.

## Access boundaries

Reviewed robots and linked privacy/policy pages disclosed no general collection
prohibition for the specific HTML paths used. The state's email disclaimer
addresses email, not these public election pages. This review does not establish
a blanket republication license. Full pamphlets and translated documents were
not downloaded or republished; native content is short factual paraphrase with
source links.

The state's non-path extension disallows are treated conservatively: JSON, CSV,
XLS and XLSX downloads are not requested. Only the separately published and
permitted HTML documents are collected. Existing robots bounds, unknown-rule
holds, host-pinned TLS, delays, denial/redirect handling and publication gates
remain unchanged. The 79,572-node candidate page is below the existing 80,000-node
limit; later growth past the limit requires review.

Massachusetts is not fetched again: its linked terms already prohibit collection
with unresolved applicability to election publications. A newly rediscovered
booklet is not a workaround or new permission. Previous Hawaii, Michigan,
Nebraska and other publisher holds remain intact.

## Delivery state

The configurable collector retains the two exact Virginia HTML tables. Offline
source/compiled preparation produces candidate and referendum review JSONL/CSV
without public identity reconciliation or personal-ballot assignment. The
separate native state/county draft remains unapproved for publication/import.
Raw publisher documents and operator instructions stay outside Git and the
small review-data packet. No production service, scheduler, permission or saved
configuration is changed. The national coverage objective remains incomplete.

## Local verification

Lint, typecheck and both builds pass, with 109 compiled backend modules. The
complete unit suite has 1,056 passes and two optional PostgreSQL skips; 21
built-application checks and 48 core accessibility cases pass. Source and
compiled preparation reproduce 20 standalone/combined output files.

Four independent state/county publication combinations test Floyd's county
question, statewide fallback and withheld packages. Sixteen controlled ZIP cases
keep Richmond and a neighboring county from receiving Floyd's local measure.
The primary and 19 preceding additional guides are preserved, as are all 49
accepted candidate captures and their original timestamps. Prior Hawaii data
remains held without publisher requests.

Forty-eight connected mobile/desktop light/dark rendering/accessibility cases and
four saved-choice/reload/actual-print journeys cover the state guide and the
four-question state/county composition. An initial fixture expected the old
local-only limitation; the actual composer correctly emitted its combined scope
notice. The corrected fixture retains strict print-media, visible-limit,
contrast, overflow and all-four-saved-title checks. A repeated current-law
sentence identified visually was removed from the draft, not hidden by a toggle.
Synthetic publication/geography fixtures are not real approval or personal
eligibility evidence.
