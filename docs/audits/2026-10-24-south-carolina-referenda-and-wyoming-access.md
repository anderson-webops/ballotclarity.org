# South Carolina referendum inventory and Wyoming access

Reviewed October 24, 2026. This is source research and local data preparation,
not publication approval or a complete personal-ballot claim.

## Official South Carolina source

The current [candidate form](https://vrems.scvotes.sc.gov/Candidate/CandidateSearch?electionId=22596)
links the anonymous [referendum search](https://vrems.scvotes.sc.gov/Candidate/ReferendumSearch?electionId=22596).
Its visible form and published JavaScript identify election `22596`, November 3,
2026 Statewide General Election, and an unfiltered public POST operation.
The ordinary request selected both published `All` values and no county filter.
No voter lookup, voter identity, login, CAPTCHA or credential was used.

The complete returned table contains **42 distinct referendum IDs under 23
responsible counties**, all classified by the source as Local Questions. Every
listed detail was retrieved sequentially, at least eleven seconds apart, using
the existing bounded public HTTPS transport and normal certificate validation.
Every detail independently matches the referendum ID, election ID, election date,
title and responsible county. The table's printed HTTP links and the verified
same-host HTTPS detail URLs are both retained.

The POST text helper confirms a successful 2xx result but does not expose the
exact status code. Its receipt records that limit, rather than inventing HTTP
200. The 42 separate document receipts do expose and record actual HTTP 200.
The listing was captured at `2026-10-24T06:58:00.602Z`, SHA-256
`e7133181eca2e96ccf3e677e60b5f3723d45d015685fc8dea4fec81a5aa82178`.
Individual detail clocks and hashes remain distinct; publication dates are unknown.

## Data and scope

Five additive files use the `south-carolina-referenda-2026-*` prefix plus
`south-carolina-referenda-source-access-20261024.json` in
`back-end/data/state-ballots/`. They provide JSON, CSV, access research, a manifest
and checksums. Each question has an original factual summary, exact source
identity and response labels, administrative county, original district fields,
page/question hashes, capture time and independent-review flags.
Full questions, raw HTML and advocacy are absent from this data packet.

- Responsible county is administrative, not evidence that every county resident
  votes on the question. Eleven entries name municipalities, five identify fire
  districts, and three school-board/district entries carry explicit district
  fields. Twenty-three entries leave district fields blank, including some
  school questions; those blanks are not silently converted into countywide scope.
- The two Charleston sales-tax rows have the same title but distinct IDs and
  different tax/debt questions. They remain separate. Beaufort and Greenville
  debt questions retain their dependence on the corresponding sales-tax question.
- Spartanburg School District 2 Question 2 retains its express condition that
  Question 1 must pass. Whitney's rate increases **by** 5.25 mills, not to that rate.
- Lee's source places an anticipated date beside a seventh-year ending clause.
  Its intended start/end dates remain an explicit independent-review item.
- This capture does not establish the absence of other statewide or local
  questions. The independent county, municipal and special-district electorate,
  current-law, fiscal, rights and publication reviews remain incomplete.

No native guides were added. The preceding primary guide and 107 additional
native drafts across 30 states remain exact. All 50 retained candidate captures,
25,082 source rows and 1,443 South Carolina records remain unchanged.

## Access and automation holds

The exact service host's robots request returned an empty 404. Narrow anonymous
research proceeded with that absence explicitly recorded, not with an automatic
collector approval. The service footer retains its all-rights-reserved notice.
Original factual summaries do not imply a general reuse license.

The main `scvotes.gov` robots request returned 200 with several named groups,
including AI-specific calendar rules. The existing fail-closed automatic parser
does not accept that group configuration. No main-host content was fetched after
that local guard failed. Its policy review remains incomplete; no parser or
access-control rule was weakened. The separate service host was reviewed on its
own receipts, not treated as a workaround for main-host content.

The proposed public form recipe is recorded as research-only, with explicit
election/date binding, bounded responses, paced requests and distinct referendum
IDs. Recurring collection, native preparation/import and publication remain
unapproved. All nineteen registered document-source configurations remain exact.

Wyoming's canonical `https://sos.wyo.gov/robots.txt` request failed with a transport
timeout before policy/content retrieval. No alternate host, cached guide or
content request followed. This is a transient access hold, not proof that Wyoming
has no measures or that its publisher prohibits collection.

## Local verification

Root lint, typecheck, both builds, 1,133 unit tests, 21 integration tests and
48 core accessibility cases pass; two optional database tests skip. The first
restricted unit run could not open a test loopback listener. Its diagnostic is
retained separately; the normally authorized local-listener run passes.

Additional checks pass: 42 CSV round trips, 42 detail identity/date matches,
eleven malformed-source rejections, four unchanged robots-guard rejections,
four source/compiled research-versus-native schema rejections and three runtime
data-exclusion checks. Twelve connected rendering/accessibility cases at 320px
and 1280px in light/dark modes and 58 API cases preserve all retained South
Carolina candidate IDs and clocks. Every research measure remains unavailable as
native coverage. No ordinary content dropdown, horizontal overflow, browser
error or accessibility violation occurs. Verification makes zero publisher calls.

Source evidence and recoverable predecessors remain in the indexed, ignored
local work area. The current pending data delta includes these five additions;
archive generation is distinct from receipt, import, release and public activation.
No source publication, server transfer, active import or production change occurs.
