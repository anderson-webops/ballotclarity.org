# VIP access and official measure content

Reviewed October 22, 2026. This is a source-side research assessment, not an
operator handoff, an access agreement or evidence of production activation.

## Verified corrections

| Claim | Finding and primary evidence |
| --- | --- |
| Google officeholder lookup remains available with a cache policy | Retired April 30, 2025, according to the [Google Civic team reminder](https://groups.google.com/g/google-civicinfo-api/c/lR8kT7Uc0sE). The [address-to-division method](https://developers.google.com/civic-information/docs/v2/divisions/divisionsByAddress) remains documented. A division identifier is not an officeholder record. This repository already records the retirement in `coverage-data.ts`; its Google implementation calls elections/voterinfo, not the retired representatives endpoints. No replacement or cache-policy change is necessary here. |
| VIP feeds are normally available 45 days before an election | Not supported by the current guidance. VIP's [FAQ](https://www.votinginfoproject.org/faq) says publication is usually two to three weeks before an election; its [coverage page](https://www.votinginfoproject.org/election-coverage) says around two to four weeks. Treat both as approximate availability windows, not an SLA or a guaranteed state publication date. |
| VIP means a complete ballot is available everywhere | The [FAQ](https://www.votinginfoproject.org/faq) says ballot information is included only in some cases and directs developers to Google Civic. The [2026 coverage page](https://www.votinginfoproject.org/election-coverage) plans all 50 states plus DC under election ID 12000; planned coverage does not establish live records, candidate/measure completeness, or successful address-to-ballot mapping. |
| An open VIP specification implies a public feed or republication license | It does not. The [format documentation](https://vip-specification.readthedocs.io/) describes data relationships; the [VIP FAQ](https://www.votinginfoproject.org/faq) recommends Google Civic for consumption and says election offices can submit other formats too. A publisher-granted feed, its access policy and its reuse terms still need independent verification. An official feed request may be appropriate, but none was sent. |
| The linked VIP documentation is the current format | The default Read the Docs site identifies itself as 5.1.2. The current [FAQ](https://www.votinginfoproject.org/faq) identifies 6.0 and links the [publisher's v6.0-release source](https://github.com/votinginfoproject/vip-specification/tree/v6.0-release). A prospective importer needs an explicit version and tested schema. Do not assume 5.x field names or defaults describe a delivered 6.0 file. |
| CTCL's ballot program is confirmed obsolete | Not established. Its current [Ballot Information Project page](https://www.techandciviclife.org/our-work/research-department/our-data/ballot-information/) still advertises Google distribution, JSON API, XML and tab-delimited delivery, with a direct access inquiry. That page does not establish an account's 2026 entitlement, price, precise election coverage or redistribution rights. The existing prospective provider remains appropriate; a configured URL is not verified partner access. |
| Democracy Works ballot content is independent official corroboration | Its [v2 API documentation](https://developers.democracy.works/api/v2) requires `includeBallotData=true` and attributes ballot data to Ballotpedia. Local coverage also has mapping constraints. Its official-election research and VIP distribution are distinct products/provenance paths; do not count them as separate corroboration of the same Ballotpedia record. |

The repository has configured official sources covering every state and DC, not
51 equally capable automatic adapters. Its accepted local coverage audit reports
19 automatic adapters, of which 17 are permitted for automatic retrieval, and
34 manually reviewed datasets after the St. Charles addition. Region coverage,
candidate qualification, measure content and personal ballot completeness must
remain separate claims. Prospective provider catalog entries are not completed
feed integrations.

## Official measure content reviewed

The retained [Utah 2026 official voter pamphlet](https://vote.utah.gov/wp-content/uploads/2026/09/2026-Voter-Information-Pamphlet.pdf)
contains two statewide constitutional amendments. The capture is dated
2026-10-22T05:35:46.438Z with SHA-256
`5869a5a4052a20a67d248a12aa35e9cacdfc7f61e9938907a89da76f4c78a434`.
This review reuses those bytes offline rather than claiming a new retrieval.
All eleven relevant PDF pages, 35 through 45, were rendered and visually reviewed.

- Amendment A: publication of constitutional proposals, implementing H.B. 481,
  conditional effective date and the official two-year fiscal estimate.
- Amendment B: a proposed 60% rule for specified statewide citizen initiatives,
  covered tax categories, existing exceptions, fiscal assessment, distinct
  initiative-vote cutoff and conditional amendment effective date.
- Nineteen field-level claims preserve the exact legislative ballot titles,
  factual paraphrases, page/section references, source hash and capture time.
  Submitted arguments remain attributed opinions, not official findings.
  Missing opposition submissions do not imply absence of opposition.
- The factual CSV, JSONL, manifest and checksums are stored outside Git in
  `back-end/data/state-ballots/utah-pamphlet-measure-facts-2026*`.
  They are research transfer records, not application measure payloads or
  approved public guide content. No automatic refresh or voter assignment is
  introduced. Existing application publication gates remain unchanged.

The text layer mixes inserted and deleted legislative language; it must not be
published as a clean legal text. Full legal text remains linked to the original
pages. The $1.4 million fiscal estimate is an uncertain upper bound every two
years, not guaranteed annual savings. Amendment B's unquantified assessment
stays unquantified, not zero. Its November 1 vote cutoff is not silently replaced
by its November 23 conditional effective date; their legal interaction remains
unresolved in this research extract.

## Remaining leads

Official pamphlets are a substantive content priority alongside reviewed
candidate records. VIP is a promising structured-source/access route, not a
permission bypass or a guaranteed solution to every 403. The existing external
storage and source freshness/allowlist controls remain the basis for future
permitted collection; there is no new analytics deployment integration.

The remaining suggestions, including county test results, aggregate boundary
crosswalks, government coverage denominators, finance bulk data, questionnaire
rights and multilingual ballots, remain research leads rather than verified
2026 availability or an implemented collection schedule. No probability of
ballot appearance, private voter data, archived-copy workaround, outreach,
subscription, public-records request or production change is introduced.

## Local verification

- All nineteen claim anchors and exact ballot titles match the retained source.
  Eleven rendered pages were visually checked, including the legal redlines.
- CSV parsing round-trips multiline titles and structured details exactly;
  source/output checksums, record uniqueness, fiscal units, null amounts,
  separate dates and attributed arguments pass focused assertions.
- Six existing provider/guide-publication tests pass. Six compiled repository
  and API isolation cases preserve all 255 Utah candidate records and withhold
  both research measures from public measure routes and search results. No
  publisher request is made by these tests.
- All 379 earlier canonical data files, seven preceding local content files,
  package/lock metadata, staging and HEAD remain unchanged. Four new external
  research files bring the canonical file count to 383, not the application
  measure count. Independent local Gitleaks finds no secrets in the new data
  and assessment.
- Application code, CSS, routing and visible copy do not change, so there is
  no newly affected rendered website page or accessibility path. The prior
  application build is reused; no new build is claimed. Local PDF source
  review and actual-data API isolation are the applicable checks for this
  research-only change.

The first verifier assumed the snapshot parser's default manual policy applied
to the automatic Utah capture; a later search check mistook the query echo for
a published result. The test harness now uses the explicit source policy and
documented grouped-result contract. A loopback bind also required the normal
execution approval. These were verifier/environment diagnostics; no product
parser, publication gate, network permission or saved configuration was changed.
Original failure evidence is retained locally. Test-owned listeners and
temporary data stores were removed after verification.
