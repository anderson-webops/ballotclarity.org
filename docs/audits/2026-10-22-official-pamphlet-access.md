# Official pamphlet access and attribution review

Reviewed October22,2026, following the supplied November-measure research table.
Search visibility, an open data format and a legal publication are not evidence
of collection permission, complete certification or a republication license.
This is a source assessment, not operator instructions or a new application feed.

## Current primary-source findings

| Publication | Verified | Collection decision |
| --- | --- | --- |
| [Colorado Blue Book landing page](https://content.leg.colorado.gov/content/initiatives/initiatives-blue-book-overview/ballot-information-booklet-blue-book) | The supplied official landing page returned403. No PDF was opened or downloaded after that denial. Fourteen measures and publication number842 remain unverified in this review. | Hold. Do not retry a PDF, alternate hostname, mirror, archive, identity or challenge route as a workaround. |
| [Massachusetts 2026 introduction](https://www.sec.state.ma.us/divisions/elections/research-and-statistics/2026-Information-for-voters/2026-ballot-questions.htm) | The official introduction explicitly identifies nine statewide questions for November3: eight initiative proposals and one referendum. The linked [terms](https://www.sec.state.ma.us/divisions/terms.htm) prohibit scraping/crawling, including manual collection. Their surrounding text discusses filing services, so applicability to elections is unresolved, not assumed away. | Hold programmatic collection pending clear publisher permission/applicable terms. The robots200 response does not override the terms. No nine-page crawl, pamphlet download, automated refresh or data import is introduced. |
| [New Mexico LCS amendments booklet](https://www.nmlegis.gov/Publications/New_Mexico_State_Government/Constitutional_Amendment/Constitutional_Amendments_2026.pdf) | The research tool opened a32-page official PDF that identifies four constitutional amendments for November3. Robots200 does not exclude its PDF path. Subsequent official homepage/policy discovery returned403, so a complete source/reuse review was not obtained. Four amendments are not proof of seven total questions: possible bond questions were not reviewed here. | Hold canonical content preparation and further programmatic retrieval. No duplicate PDF download, alternate source, bond-document collection, automatic feed or license approval is claimed. |
| [Arizona SOS policy](https://azsos.gov/robots.txt) | The policy request returned403 with a bot challenge. A statute establishing the publicity-pamphlet process is not an inspected2026 pamphlet. | Stop at the policy denial. No pamphlet, challenge URL, alternate identity or mirror was requested. Existing independently reviewed county publications remain unchanged. |

California's earlier voter-guide403 and King County's separate reuse restriction
remain intact. The supplied King-Seattle edition is not treated as a workaround
for King County content. Other table rows, measure counts, translations, lawsuits
and individual judicial recommendations remain leads, not newly verified facts.

## Attribution changes the data mapping

- Massachusetts Question9 concerns an existing law: YES retains it and NO
  repeals it. It must not inherit the initiative convention that NO simply
  rejects a proposed new law. The [official introduction](https://www.sec.state.ma.us/divisions/elections/research-and-statistics/2026-Information-for-voters/2026-ballot-questions.htm)
  explicitly distinguishes those cases.
- The [official Question1 page](https://www.sec.state.ma.us/divisions/elections/research-and-statistics/2026-information-for-voters/2026-ballot-question1.htm)
  identifies its opposing argument as a Secretary-prepared substitute, partly
  based on a legislative report, because no organized opposing group was listed
  at printing. Do not invent an opposition signatory or call it a submitted
  advocate statement.
- New Mexico's booklet, PDF pages6-7, says its arguments are suggested positions
  prepared by Legislative Council Service staff. They are not signed campaign
  submissions, exhaustive positions or an agency endorsement; unequal argument
  counts are not evidence weights. Existing `MeasureArgument.attribution` can
  identify staff authorship without pretending an advocate submitted them.
- Massachusetts distinguishes Attorney General summaries, jointly prepared
  yes/no effects, Administration and Finance assessments, legislative reports
  and submitted/substitute arguments. Preserve those roles field by field;
  one generic source-author or arguments disclaimer is insufficient.

The current `Measure` model already has places for these substantive fields.
No new schema, source adapter or public page is necessary merely to document
the mapping. Full legal text stays linked; monetary units, forecast uncertainty,
effective dates, source dates and unknowns must not be invented or flattened.
The previous accepted Utah factual transfer remains unchanged and unpublished.

## Judicial-evaluation placement decision

Use a separate **Official evaluation** section on the judge's detail page, not
biography and not the glanceable directory row. Show the issuing body, actual
evaluation date/cycle, a short attributed finding and the original source link.
If the body issued a retention recommendation, label it as that body's
recommendation, never Ballot Clarity's advice. Do not infer an evaluation from a
candidate statement or absence of material. No claimed Alaska2026 negative
recommendation has been independently verified in this review, so none is added.
This is the selected design/data direction, not an implemented evaluation block.

## Reuse boundary

The [2020 Supreme Court opinion](https://www.supremecourt.gov/opinions/19pdf/18-1150_7m58.pdf)
concerns Georgia's official code annotations and the government-edicts doctrine.
It is not a blanket license for every state executive agency's ballot summary,
pamphlet, fiscal essay or privately authored submission. This review makes no
new categorical public-domain determination. Keep access permission, factual
paraphrase, quotation rights and public editorial approval separate. Attributing
or shortening content does not resolve a publisher's collection prohibition.

## Result and verification

The durable external source-review catalog contains four publication/access
records, not four imported measures. Its CSV, JSONL, manifest and checksums live
under `back-end/data/state-ballots/official-pamphlet-source-review-2026*` outside
Git/code release assets. Each hold records what was observed and what remains
unverified; there is no invented certification count or refresh permission.

No application code, visible copy, source configuration or publication gate is
changed. No new UI/build/accessibility result is claimed for this research-only
assessment. Catalog round-trip/checksum/preservation checks and focused existing
provider/publication tests are the appropriate local verification. No outreach,
subscription, production access, external source upload or release is performed.
