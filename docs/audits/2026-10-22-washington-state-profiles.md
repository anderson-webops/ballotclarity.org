# Washington statewide and legislative profiles

## Source review

The normal [Washington candidate list](https://voter.votewa.gov/CandidateList.aspx?e=899)
and [public guide](https://voter.votewa.gov/genericvoterguide.aspx?e=899&c=)
were rechecked on October 22, 2026. The selected general election is November 3,
2026, ID 899. All nine normal public list pages were captured through the existing
pagination adapter. The normal guide explicitly has preview mode disabled; its
current client declares the public candidate-handler and both race/detail routes.
Only observed race/candidate associations were used, with empty county selection,
`b=0`, English, verified HTTPS and eleven-second spacing. No preview, private-voter,
submission, denied-export, King County publisher or alternate-identity request
was made.

The exact voter host returned its normal 404 for robots.txt. The Secretary of
State's robots file and [reuse/privacy notice](https://www.sos.wa.gov/web-sites-privacy-policy)
were captured and reviewed. The notice's third-party copyright qualifications
remain applicable: this review does not infer a blanket license for campaign
prose or photos. Public factual paraphrases and attribution are exported; raw
statements, encoded media and contact fields remain local research evidence.
An internal approval flag is not publication permission or factual verification.

The fresh 887-record roster has the same ordered identities, offices, election and
statuses as the retained official snapshot. Six District 46 labels changed case;
one PUD record changed case in two label fields. The exact eight differences were
reviewed offline rather than relaxing the maintained parser or replacing the
preceding canonical data.

## Accepted factual data

There are 125 newly configured races and 231 selected identities, excluding the
four preceding LD1 profiles and twenty congressional profiles. All 125 public
responses succeeded; 229 contained nonempty matching statements. The factual
review accepts 227 profiles/450 facts: 176 House, 41 Senate and ten statewide
Supreme Court profiles.

Four exact official identities are held:

| Official association | Name | Reason |
| --- | --- | --- |
| `187019/1602364` | Kerry Hills | No nonempty statement in the normal public response. |
| `187063/1602366` | Chris Elder | No nonempty statement for the selected House association. |
| `187053/1602085` | Joseph Segault | Submitted factual sections provide no usable background. |
| `187067/1602110` | John P Gibbons | Submitted factual sections provide no usable background. |

All official identities remain available. Another local official association also
uses the name Chris Elder; it is neither merged nor used to fill the House
background by name. Missing submissions imply neither no experience nor
disqualification. Degree completion is not inferred from attendance, coursework,
institution lists, in-progress study or ABD. Campaign claims, endorsements,
qualification ratings, family/medical details and contacts are omitted.

The new registry ID is `wa-state-statements-2026`. Every source remains explicitly
candidate-authored even though VoteWA hosts it. There is no new personal ballot
matching, eligibility claim, state completeness claim, or automatic fact approval.
Most local background remains uncollected.

The offline preparation command validates exact plan keys, preceding collections,
configured normal-public URLs, official/election/office identities, captured-byte
hashes, statement hashes, factual-section anchors and resource bounds. Sequential
capture reads avoid hundreds of simultaneous 12 MiB buffers. It processes the
87,910,783 captured bytes without downloading or importing anything. Its compiled
Node output is byte-exact with source preparation:

`2da2bdcfd52e6f26a5e875fd2b5a9e37be1e32b3f36f177a1d93333edba088e8`.

Matching an anchor does not prove semantic truth; explicit factual review remains
required. New elections require reviewed source configuration, current policy and
client-contract checks, new observed IDs, tests, accepted runtime and separately
approved data import. See [preparation instructions](../washington-statement-preparation.md).

## Storage and delivery boundary

The unchanged fifty official datasets contain 25,568 records. The combined 61
reference collections contain 534 profiles/1,120 facts across fifty states plus
DC. This is geographic reference coverage, not all candidates or complete ballots.

All 362 preceding canonical files, sixty reference configuration fingerprints,
three unrelated physical-main modifications, original worktrees and published
tags are preserved. New snapshots, factual CSV/JSONL and operator packages remain
ignored local data, outside Git and immutable runtime assets. The new cumulative
package has 95 flat members and 789,533 compressed bytes; original capture dates
and healthy preceding data remain intact.

Archive SHA-256:
`fa4c7a4d929d5dae23d2b46cc453ec7e14cc0b8c3ecf8e417a426a6e827d7f53`.

Manifest SHA-256:
`948123f44610d9684f14645691fddc0602f8ffd4e7bee75386accc715ba386db`.

Source publication, protected runtime acceptance, served release identity and
approved data transfer/import are separate states. No source-agent production
administration, upload, import, credential, permission or infrastructure change
is performed. Nationwide/local collection remains unfinished.

## Local checks

Visual review caught a redundant Supreme Court prefix in the new source title and
statewide profile subtitle. The new metadata and profile projection now show the
court only once in each, retaining exact office/position and term information.
Official source labels and preceding datasets are unchanged. The affected court
pages receive a final responsive/theme/accessibility recheck.

Root and standalone backend locked installations, lint, typecheck, both builds,
792 unit-test passes with two optional PostgreSQL skips, 21 browser smoke tests,
48 core accessibility checks, zero full/production audit findings, registry
signatures/attestations and native bindings are recorded. Three new modules are
independently required among 91 compiled backend modules. Final actual-data API,
responsive rendering, accessibility, secret and clean-source artifact receipts
are retained separately with this change's release acceptance evidence.
