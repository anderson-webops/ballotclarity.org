# Alaska and Oregon candidate profiles

## Content and identity

Alaska contributes fifteen individual statewide/federal profiles and 47 background
items. The current public `26genr` candidate index identifies the November 3, 2026
general election and directly links these fifteen statements. They reconcile with
eleven of seventeen statewide/federal ballot-choice rows in the retained official
snapshot. Six rows have no statement link; missing statements are not withdrawals.
Governor/lieutenant-governor members remain distinct individual references without
increasing official ballot-choice counts. The two Senate candidates named Sullivan
are not merged. Candidate-authored statements are not independent verification.

Oregon contributes all fourteen submissions indexed in the eastern-county edition,
with 42 background items. Six are statewide, two congressional, one legislative
and five for county offices. Eleven names reconcile with retained official filings.
The Baker commissioner pair and Lake sheriff submission have no independently
matched retained filing, so they remain references only. Oregon's 279 official
records and personal assignment rules are unchanged. Gary Lyndon Dye remains in
the official list despite lacking a statement in this edition. The edition is not
complete Oregon/local profile coverage.

## Source and policy review

- [Alaska's current candidate index](https://www.elections.alaska.gov/candidates/?election=26genr):
  October 22, 2026 at 04:39:36.518 UTC, SHA-256
  `a430ee24839021718585b32601a4444ba958ef4c71515e49fe2569a4347e58ed`.
- [Oregon's English edition index](https://sos.oregon.gov/elections/Voters-Pamphlet/Pages/Voters-Pamphlet-English.aspx):
  October 22 at 04:39:42.901 UTC, SHA-256
  `dd168d7b623eb2f159e32dd474e4fa6e121462daa22814b5a9ddaeea695fe366`.
- [Oregon's linked edition](https://sos.oregon.gov/elections/Voters-Pamphlet/Documents/VP_G26-Book19_web.pdf):
  October 22 at 04:42:36.296 UTC, SHA-256
  `ee2b834d1402f3ed999a0b9259dceae687370fff5f334e34a3be95432fb97eb0`.

Fresh robots policies permit the ordinary public paths. The Alaska document
host's robots request redirects to the same publisher's already checked canonical
policy, not a denied host or mirror. All fifteen actually linked PDFs return 200.
Normal Node certificate validation still fails; the existing system curl route
uses ordinary HTTPS validation, reports verification result zero and changes no
trust, identity, host, credentials or saved configuration. No insecure option or
private voter lookup is used. Index and document requests are sequential/bounded.

Both publishers' current disclaimer/terms and the pamphlets' authorship notices
were reviewed. Alaska identifies statements as candidate-provided and paid for,
without state endorsement; Oregon explicitly says statement accuracy is not
independently verified. Neither is treated as a blanket redistribution license.
The package contains only short factual summaries and attribution, never campaign
arguments, photographs, contacts, family details or full source text.

## PDF and factual review

All twenty-four candidate pages were visually inspected. Columns are extracted
using each PDF's measured dimensions, not an assumed page size: Alaska's pages
are 504 by 720 points and Oregon's 540 by 774. The initial letter-sized scratch
crops were replaced before any factual output was accepted. Each reviewed fact
must also match short evidence phrases in the correct visible candidate column.
Long wrapped proof phrases were split into their actual supporting clauses,
without weakening their attribution or changing source facts.

Off-page extraction artifacts do not supply background facts. School attendance
is not made into a degree, a family's military service is not made into the
candidate's own service, and a candidate's legal-outcome claim is not imported as
an independently established outcome. No publication date is inferred from a
PDF's creation time, filename or page/region placeholder.

## Storage and operator boundary

The existing strict reference parser, compiled importer/exporter, atomic external
storage, filtering, pagination and election expiry apply. One collection per state
is retained. Earlier five collection configurations and all 234 preceding canonical
files remain unchanged. New records never enter official candidate counts or
personal lookup previews. Missing imports stay unavailable rather than loading
fixtures or scraping statements automatically.

Ten factual snapshot/CSV/JSONL/review/manifest files and three operator-package
companions remain outside Git/runtime. The exact three-member v1.10.2 addendum
contains only the AK/OR supported snapshots and its manifest. The CSV/JSONL
companions are research transfers, not importer inputs. Retain both earlier data
packages unchanged. Source publication neither transfers nor imports production
data; separately approved operator delivery remains necessary.

## Verification

Root/back-end locked installs, lint, type checking, both builds, 753 unit tests
and 21 integrated smoke tests pass. Two existing optional PostgreSQL tests remain
skipped. Fifteen native-binding checks and full/production/signature audits pass,
with zero dependency vulnerabilities. Package metadata and both lockfiles are
unchanged.

Seven actual-data compiled imports/exports preserve 64 profiles and 183 factual
items. Thirty-two API cases cover source attribution, independent pagination,
state/scope/search isolation, the two distinct Sullivan profiles, degree-attendance
semantics, profile-only county search, missing imports, corruption and immediate
recovery. Three new local submissions do not become official records. The retained
AK/OR official totals stay 155/279, and controlled state-only previews stay 18/7.
Earlier NC/NM counts and previews remain unchanged. No profile IDs or background
facts enter personal lookup results.

Seventeen actual-data browser cases and all 48 additional repository accessibility
cases pass. All three color schemes, light/dark, 320px/desktop, red election dates,
meaningful errors and keyboard retry are checked. Source profile sections were
visually inspected, with no horizontal overflow or page errors. Acceptance uses
loopback-only services with external browser/provider traffic blocked.

Independent local source/data and outgoing-change secret scans are required before
delivery. The initial source/data scan is clean; GitGuardian's fifteen-second quota
probe times out and is recorded as unavailable, not passed. Existing hooks and
all other gates remain unchanged. The five intended source paths, thirteen new
canonical outputs, all 234 prior data files, five earlier collection fingerprints,
four worktrees and three unrelated physical-checkout changes are reconciled.
