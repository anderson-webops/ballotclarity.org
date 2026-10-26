# Fulton and Cassia general-election publications

Local source/data review for November 3, 2026. No publication, production access,
transfer, credentials or permissions change is authorized by this review.

## Georgia

[Fulton's current sample index](https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/sample-ballots)
links the five-page consolidated sample and one-page County Commission District 5
qualified write-in notice. All six pages were visually inspected. Its combined
races are not an assigned personal ballot.

The snapshot has 98 records in 51 offices: 96 printed choices plus two explicitly
qualified county write-ins, Mark Baker and Lynn King. Scopes are 22 statewide,
six Congress, sixteen Senate, 37 House and seventeen local. Both PSC offices
remain statewide, corroborated by the
[official statewide-election scope page](https://georgia.gov/organization/public-service-commission).
PSC residency districts are not voter-eligibility or legislative districts.

Literal parties, spelling, diacritics, printed incumbency and the Commission
District 4 unexpired term are retained. No missing party, remaining term length,
voting limit or unopposed outcome is inferred. The resigned predecessor is not
another District 4 candidate. State/federal write-in names remain explicitly
missing: the separately linked state PDF was not retrieved after that host's
robots entry returned HTTP 403.

Seven question texts remain external companions only: TSPLOST, Sandy Springs
redevelopment powers, Palmetto's tax exemption, ESPLOST and three constitutional
amendments. ESPLOST's literal `new 10 and replacement schools` is preserved.
These are not application measures, legal interpretations or voter assignments.

| Source document | Capture (UTC, October 21) | SHA-256 | Candidate contribution |
| --- | --- | --- | ---: |
| Consolidated sample | 22:12:05.210 | `e1b4186e5f8c0ff8188cc4175fe18c0a18fa6bfb158fca08cb3da190793dd60d` | 96 |
| County qualified write-ins | 22:12:15.915 | `a6a7ed428a8d44f973c6c30d9c6baf1f1731ae03f7cf164fc772b611a90443bd` | 2 |
| Official PSC scope page | 22:18:23.937 | `05e446cb1339d5cd06f3215280ffdacd0c84510b1244440adbb18fca23f4e903` | 0 |

Fulton's robots rule excludes only its springboard path, not these publications.
Its linked Privacy Statement and Georgia.gov's Privacy and Security policy were
read. No additional applicable public-fact reuse restriction was identified.
Original graphics and irrelevant prose are not republished. The ordinary
same-host privacy redirect was followed; the denied state entry was not bypassed.

## Idaho

[Cassia's current index](https://www.cassia.gov/sample-ballots) links a two-page
general sample, a one-page American Falls Joint School District 381 levy sample
and a one-page Rock Creek fire-district sample. All four pages were visually
inspected. Positioned PDF words distinguish columns and exclude the diagonal
SAMPLE watermark; extraction alone is not accepted as visual proof.

The snapshot has 39 records in nineteen offices: 22 statewide, five Congress,
two Senate, two House and eight local. House District 27 seats A/B stay separate.
The named Cassia magistrate retention question is one local record; Yes/No are
choices, not people, and Judicial District 5 is not Senate District 5. Pro-Life
is one candidate with a former-name annotation, not another candidate named
Marvin Richardson. Literal party codes and county terms are retained. Blank
write-in spaces, single-name offices and absent parties do not imply extra
candidates, unopposed status or election outcomes.

Six question texts have ten source occurrences: HJR 4, HJR 6, Proposition 1, the
six-choice state-gun advisory question and the school/fire levies. Four statewide
texts repeat in the Rock Creek sample and reconcile independently. These remain
external companions, with no school/fire assignment inferred from precinct names.

| Source document | Capture (UTC, October 21) | SHA-256 | Candidate contribution |
| --- | --- | --- | ---: |
| General sample | 22:13:38.429 | `aefe91742f0b9ac3938e558b292cae055bdabd46f3cee1bd5aaeea381f1d4327` | 39 |
| American Falls levy | 22:13:49.727 | `4b83224e9c2bdb5002569f6fe826408405a2b2c83c51ace547f9c61e9560d674` | 0 |
| Rock Creek sample | 22:14:00.988 | `d56ec0dbdc67d986d750cb14ed0aff359d5053a55be35fa27d74b7cc484e6617` | 0 |

Cassia's robots policy permits these paths and excludes only search actions. Its
full index/link inventory disclosed no separate applicable reuse policy. This
does not imply unrestricted downstream licensing. Factual records and ballot
texts are prepared, not artwork. Blaine's independent policy entry returned 403
and was not followed; the inaccessible state tool was not bypassed.

## Storage and verification

Both sources require reviewed imports into `STATE_BALLOT_DATA_DIR`, outside the
code/release directory. No automatic PDF/OCR refresh is implied. Ordered URLs,
hashes, capture times and contribution counts include supporting/question-only
documents with zero candidate records. Changed elections require fresh review.

Ignored `back-end/data/state-ballots/` packages named `georgia-2026` and
`idaho-2026` contain snapshots, exports, claims, question companions, manifests,
checksums and archives. Raw PDFs, page images and contact-bearing HTML stay in
local evidence outside those factual archives. New bulk data stays outside Git
and application artifacts. Historical bundled-data migration remains separate.

The focused tests cover external-only operation, provenance, exact cache/export
restart, invalid imports/private fields, typed district isolation, statewide PSC
scope, distinct House seats, retention, terms and former names. Local acceptance
evidence is in `.ai-work/runs/20261021-remaining-general-publications/`.

## October 26 Cassia recheck

The sample index still offers the same three PDFs. Fresh normal HTTPS captures
match all three original document hashes exactly, so there is no changed
candidate packet to transfer. The full robots policy is unchanged. The current
index and homepage link an accessibility statement, which was reviewed without
finding an automated-access restriction; neither inventory offers separate
website-use terms. This county review does not lift the separate Idaho state
portal hold or imply unrestricted republication rights. Cassia's source remains
a reviewed external import until its document parser and future discovery are
implemented and validated.

## Remaining-source findings

- Washington County, Arkansas has permitted federal through municipal and runoff
  tables. Unofficial/unopposed legends need full validation before integration.
  The statewide portal still identifies the earlier primary/judicial election.
  Sebastian disallows all automated paths; Benton returned 403. No bypass.
- Oklahoma County's September 29 notice identifies November 3 samples but directs
  voters to the personalized OK Voter Portal, not a published bulk ballot. No
  personal voter query was made. The linked public Terms of Use was read after
  its ordinary same-host redirect.
- Rhode Island Current and Louisiana Illuminator publish reference-use signals
  and training restrictions. Their guides are reported-information leads, not
  official qualification records. No news text is imported or relabeled official.

Arkansas, Louisiana, Oklahoma and Rhode Island still lack integrated candidate
datasets. Maine remains municipal-only. Broader profiles/news, application
measures, local eligibility and legacy-data migration are unfinished; final
server-AI operating instructions are not yet ready.
