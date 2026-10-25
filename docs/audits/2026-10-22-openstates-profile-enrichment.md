# Open States profile enrichment review

## Evidence and result

The independently published [Open States People repository](https://github.com/openstates/people/blob/5aad164685d03e48fdc221390817f27d2d7516b7/README.md)
explicitly dedicates its data under CC0. Its current-legislator YAML contains
role dates and occasional short professional fields absent from the existing
state CSV downloads. This is a distinct dataset publication, not permission to
fetch a denied original biography publisher or reproduce that publisher's prose.

An ordinary, unauthenticated GitHub API archive request pinned commit
`5aad164685d03e48fdc221390817f27d2d7516b7`. The documented redirect to GitHub's
archive host succeeded. The 5,350,624-byte capture has SHA-256
`86d8fa23475ec9d60e43e3b4131b6c907d67187083b8e1cc79d1bdcb0a5e5803`
and capture time `2026-10-22T21:40:52.980Z`. No original biography source,
alternative identity, denied-host mirror, credentials or challenge bypass was used.

All 1,495 existing exact candidate-to-legislator matches were found in current
legislator files. Identity checks retain the same UUID, normalized exact name,
state, chamber and literal district, and revalidate the candidate's source,
capture hash, status and district against the 50 reviewed local candidate
captures containing 25,031 records. No fuzzy aliases, guessed nominees or
individual ballot assignments are introduced.

The separate CSV/JSONL research output contains 1,463 profiles and 1,589 fields
across 32 states:

| Field | Count | Meaning |
| --- | ---: | --- |
| Current-role start date | 1,463 | Date recorded for that matched role, not first election or first-ever service |
| Occupation | 65 | Short publisher-listed structured value |
| Profession | 31 | Short publisher-listed structured value |
| Education | 30 | Short publisher-listed structured value, without inferred degrees |

The professional fields concern 97 people in five states. Open States describes
`extras` as unvalidated in its [schema](https://github.com/openstates/people/blob/5aad164685d03e48fdc221390817f27d2d7516b7/schema.md).
These are therefore explicitly publisher-listed research, not independently
verified employment or credentials. The archive capture date is not evidence
that the underlying job or education entry was updated that day. Original
abbreviations and incomplete entries are preserved rather than expanded by guesswork.

Each profile carries its candidate capture identity, repository commit, archive
hash/capture time, original YAML member path/hash, field pointer and immutable
public member links. The member hash covers YAML bytes inside the archive;
the linked HTML/raw pages were not separately downloaded. Source freshness is
not replaced with the preparation time.

## Quality exclusions

Historical chamber/district labels cannot be assumed reliable. For example,
April Weaver's repository entry includes an upper-chamber District 14 role
covering 2010–2020. An [Alabama Ethics Commission opinion dated August 6, 2014](https://ethics.alabama.gov/docs/pdf/AO2014-02pdf.pdf)
instead identifies her as a House member for District 49. The research output
does not silently repair or publish that historical role.

- All 395 past-role entries across 279 people are held for independent review,
  not declared to be 395 confirmed errors.
- Missing start dates remain unknown for 32 matched people. One empty and one
  null occupation are omitted, producing 429 field/role holds in total.
- A role with an end date after the capture date remains active. Two real
  records exercise this distinction; simply requiring an absent end date would
  incorrectly discard them.
- Biography prose, personal dates, contacts, family, religion, photographs,
  social accounts and unrelated extras are not included.

## Application boundary

No application behavior, public page, source configuration, existing reference
snapshot or collection schedule changes in this review. The current reference
contract pins an exact document set and attributes each record to one configured
document. It would be incorrect to add YAML-only facts while citing the
existing CSV. Duplicating the same people in a second collection would also add
unnecessary interface clutter.

The enrichment manifest is explicitly `election-reference-enrichment-review`
with `applicationImportReady: false`, not an accepted application snapshot.
Direct profile integration requires a reviewed provenance-contract extension
and field-quality decision. Automatic repository refresh is not enabled. Bulk
data and raw evidence remain ignored local files, outside Git and runtime/release
assets. Source publication, any private transfer/import and production activation
remain separate, unperformed actions.

## Local verification

- Twelve focused offline preparation tests cover role dates, future end dates,
  ended/future roles, ambiguous identities, invalid dates, exact districts,
  missing values, extra-field exclusions, immutable member provenance and CSV
  formula neutralization.
- All 1,495 original YAML member hashes and projected roles/professional values
  are checked again against the pinned archive without extraction or execution.
- Independent CSV/JSONL parity, fact/hold totals, candidate capture identity,
  source freshness and the two future-ended real-role controls are checked.
- Application importer negative controls reject the research formats rather
  than treating them as public reference snapshots: six rejections through
  source/compiled commands, with two valid imports as positive controls.
- Sixty focused existing reference/collector regressions pass. The initial
  sandbox loopback restriction is retained as a failed attempt; the same tests
  pass with approved local test access, without saved configuration changes.
- A local secret review identifies four scanner matches as public names followed
  by deterministic public profile IDs, reproduced from their documented hash
  derivation and matched to existing profiles. The raw scanner findings and
  nonzero result are retained; no scanner rule or data was changed to hide them.

The review does not change visible copy. No new explanatory banners, labels,
cards, toggles or links are added to the interface.
