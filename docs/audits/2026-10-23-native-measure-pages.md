# Native measure drafts and concise measure pages

October 23, 2026. Local source/data validation only; not a publication or deployment.

## Data prepared

Five source-linked drafts now conform to the existing `Measure` field structure:

| State | Drafts | Source basis | Deliberate limits |
| --- | --- | --- | --- |
| North Dakota | Constitutional Measures 1 and 2 | Seven retained official PDFs, including both newly reviewed analyses | One supersession-clause wording difference remains unresolved. No unified legal rule is invented. |
| Idaho | HJR 4, HJR 6 and Proposition 1 | Retained current official HTML guide | The six-choice HB 932 advisory question is not coerced into a binary measure. No PDF-derived or clinical-risk claims are added. |

The two external-only draft packages contain JSON, CSV, a manifest and checksums.
The CSVs contain 31 field rows in total, not 31 newly discovered measures or facts.
Original research and source captures remain unchanged. Draft metadata explicitly
withholds publication, automatic import and replacement of the active guide.

Unknown publication dates remain unknown. Source-specific capture dates, HTML
section names or verified PDF page links preserve provenance. The North Dakota
school-meal range remains a two-year 2027-29 estimate, not an annual cost. The
Idaho range remains an attributed annual projection of limited modeled state
Medicaid costs, not a comprehensive net fiscal estimate. Unavailable fiscal
figures for Idaho's constitutional questions are omitted, not set to zero.
Proposition 1's proposed January 1, 2027 effective date is tied to voter approval
and verified against Section 2 of the retained full legal text, not invented from
the election date or added to the unknown source-publication dates.

The Idaho guide's fiscal heading says "Division of Fiscal Management", while its
detailed text uses DFM and a different rendering of the agency name. The agency's
own [About DFM page](https://dfm.idaho.gov/about-dfm/) identifies it as the Division
of Financial Management. The new interface retains the unambiguous DFM acronym;
the original guide/research wording is preserved as evidence rather than silently
rewritten. The agency-name check used primary-site search evidence after a direct
homepage request timed out; it does not establish a new automatic source policy.

## Source changes

- `back-end/src/server.ts` adds `electionDate` to public measures from their
  published parent election, overriding any stale embedded measure date without
  mutating stored data or changing publication decisions.
- `back-end/src/types/civic.ts` and `front-end/src/types/civic.ts` declare that
  additive optional field. Existing clients/data remain compatible.
- `back-end/test/measure-election-date.test.ts` checks the parent-date binding and
  unavailable-record boundary.
- `front-end/src/pages/measure/[slug].vue` leads with the proposal and election
  context, then fiscal information when present. Caveats remain adjacent to the
  estimate; longer proposal and implementation details follow.
- `front-end/src/utils/measure-content.ts` and its test select only populated
  sections, deduplicate repeated summary text and retain all nested citations.
- `front-end/src/components/SourceList.vue` supports one whole-row direct link per
  source in measure pages and omits unknown dates. Its default behavior elsewhere
  remains unchanged.
- `front-end/src/components/GuideUnavailableState.vue` omits an empty message.
  `front-end/test/public-copy.test.ts` covers the associated source-action and
  concise unavailable-measure copy contracts.

## Copy and interaction review

Removed redundant summary labels when they repeat the headline summary, empty
arguments/current-law/timeline sections, duplicate source controls throughout the
page, uppercase micro-labels, generic promises about effects of YES/NO, repeated
review metadata and the duplicate unavailable-measure explanation. Short factual
sections are visible without disclosure toggles. Material fiscal/source limits,
attributions, vote meanings, saved-choice feedback and direct source access remain.

Election dates are plain text, not red attention labels. Review timing stays with
sources rather than competing with the proposal. No choice is preselected; local
browser checks exercise and then clear their own synthetic saved choices before
capturing neutral screenshots. No new public page or navigation category is added.

## Verification

- Repository lint, frontend/backend types and builds pass; 102 backend modules.
- 921 unit tests pass; two optional PostgreSQL cases skip.
- Twenty actual-data measure renders pass accessibility/overflow/source-link and
  keyboard/saved-choice checks at 320px and 1280px, light and dark. Four missing
  measure-route checks retain one concise error heading and no duplicate message.
- Twenty-one built-app browser tests, 48 core accessibility cases and 15 native
  runtime entries pass.
- Both state fixtures retain all 50 native candidate caches/25,031 rows and all
  95 reference collections/2,040 profiles/4,235 facts, with original capture dates.
- The five drafts are unavailable without a published test workflow. Positive
  render checks use explicit isolated fixtures only. Raw draft objects are not
  accepted as a complete coverage snapshot or by candidate/reference importers.

No root/workspace dependency or lockfile change belongs to this cohort. The
preceding frozen source-release candidate, source registry holds, private data,
permissions and production configuration are not modified. Local build and
rendering success do not constitute immutable release-artifact acceptance.

## Remaining integration

The maintained coverage repository still has one primary election/jurisdiction,
and public measure lookup follows that published election. A validated standalone
state draft is therefore not a safe replacement for the existing primary guide.
Multi-guide publication/state binding and a choice-aware advisory-question
contract remain unfinished. These are source-side requirements, not reasons to
overwrite the active guide or invent binary vote meanings. The national goal is
not complete, and no production transfer, import, schedule or source release is
performed by this work.
