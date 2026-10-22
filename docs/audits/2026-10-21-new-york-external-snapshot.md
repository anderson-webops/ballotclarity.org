# New York external-source review

## Source and scope

The [Monroe County Board of Elections](https://www.monroecounty.gov/elections)
links its [November 3 general-election certification](https://www.monroecounty.gov/files/boe/GE26%20Candidates%20List%20Certification%20%2810-6-26%29.pdf),
amended October 6, 2026 at 9:22 am. The normal original index and PDF requests
returned HTTP 200 with ordinary TLS verification. The publisher's robots file
contains comments, not active disallows. The state portal's earlier restriction
is unchanged; this is an independently published county document, not a workaround.

- PDF capture: `2026-10-21T12:15:08.446Z`, 231,798 bytes, ten scanned pages.
- Original SHA-256: `d96a6ff9124ea7c7fe28d6406f118171e432e465bb81143b37c5fbe124fc774b`.
- Composite document-set SHA-256: `731f55cd35a93b1ce9f410d73175d174fb8bfa2268d86c2ff8f3464082f60e04`.
- All ten pages were visually inspected. The eight candidate pages are 2 through 9;
  cover/signature pages are provenance, not candidate rows.
- Local OCR is assistance only. Every name, party line and heading was reconciled
  to original pixels, including candidate-only enlarged renders for ambiguous names.

## Reconciliation

There are 194 printed party-line claims, 106 distinct candidate/contest records
and 61 distinct contests. Eight records are statewide, two congressional, eight
Senate, eighteen Assembly and seventy local. Eighty records have multiple printed
party lines. Repeated endorsements do not create duplicate candidates or establish
party membership.

| PDF page | Printed claims | Candidate/contest records |
| --- | ---: | ---: |
| 2 | 29 | 14 |
| 3 | 27 | 15 |
| 4 | 22 | 14 |
| 5 | 25 | 13 |
| 6 | 23 | 15 |
| 7 | 23 | 12 |
| 8 | 24 | 13 |
| 9 | 21 | 10 |

All 194 row identities match the candidate/party-only OCR reconciliation after
original-pixel corrections: Carl Fitzsimmons rather than OCR `Cart`, Daniel E Aman
rather than the euro-like character, William A Smith, Jr rather than `Ir`, Ian
Winner rather than `lan`, and Dennis J Greco rather than a brace. Printed McIntyre,
VanWuyckhuyse and Heidi Woika spellings are retained. OCR variants of Working
Families are corrected; the Gates row's printed trailing punctuation remains in
the companion evidence.

Governor and lieutenant governor remain separate source sections. No ticket
pairing is invented. Office/term context keeps the Irondequoit one-year and
term-ending-2028 council races, Fairport regular and one-year trustees, town
supervisors and town/city judges distinct. A single listed candidate is not
declared elected or automatically removed. Missing write-in/withdrawal lists are
not manufactured. Residential addresses, personal contact information and inferred
campaign links are excluded.

The county's congressional District 25, Senate Districts 54/55/56/62 and Assembly
Districts 130/133/134/135/136/137/138/139 are retained. Only exact supported address
district matches may add these to the eight statewide records. ZIP/IP centroids
do not establish legislative eligibility, and none of the seventy local records
is assigned through a ward, court, township or generic district guess. This is
partial New York coverage, not a complete personal ballot or reviewed voter guide.

## External data boundary

`ny-monroe-2026` is explicitly `manual-snapshot` and `snapshotStorage: external`.
Without a valid imported external file, the repository returns unavailable and
retains normal limited-coverage behavior. It cannot crawl, OCR or load a bundled
fallback. The source transport independently rejects manual retrieval.

Canonical reviewed handoff files, their manifest, checksum list and data archive
are in `back-end/data/state-ballots/`. This application-data folder is excluded
from Git. No New York payload is added to `back-end/src/data/`, the runtime copy
script, required-assets list or immutable code contract. The existing sixteen
bundled snapshots remain unchanged. Ignored data must be backed up separately
before removing the checkout; worktree/Git snapshots do not save it.

The compiled management command accepts the reviewed JSON through the protected
service environment and stores validated facts in `STATE_BALLOT_DATA_DIR` outside
the release. Original capture time, document fingerprints and scope persist
through import/restart/export. No hosted path, scheduler, permission, credentials,
production data, service or deployment is changed by this local review.

## Verification

Fourteen focused source/storage tests pass, covering synthetic external-only
imports, absence without imports, no network/bundle fallback, private-field and
source/election rejection, fusion labels, separate offices/terms and local-district
suppression. The current full-source validation passes lint without warnings,
typechecks, both builds with 78 compiled back-end modules, 589 unit tests with
two existing optional PostgreSQL skips, 21 integrated smoke tests and the
15-entry native-binding verifier.

Compiled import, export and restart preserve all 106 records, 194 printed claims,
61 contests, 80 fusion records and original document fingerprints exactly. The
missing-import path fails closed without a publisher request or bundled fallback.
No New York bulk data enters Git or the runtime artifact. Five package/lockfile
hashes and 117 unrelated dirty paths across both checkouts remain unchanged;
heads, staging and the four registered worktrees are unchanged.

Eighteen current-build rendering/accessibility cases pass at 320, 390 and 1280
pixels in light and dark modes: six missing-import cases and six each for the
real-data ZIP and controlled-address cases. They render every eligible candidate,
preserve the active-location cookie and report no overflow, browser errors or
accessibility violations. The ZIP case has eight candidates in four contests;
the controlled address case has fifteen in seven. Controlled district fixtures
exercise application wiring, not independently verified Census eligibility.
Representative missing/imported, narrow and dark screenshots were visually
reviewed.

The initial missing-data contrast check failed during an in-page theme change.
Its retained timeline shows the correct settled dark foreground and a clean
subsequent accessibility result. The final review selects the real media
preference before reloading each page and retains every full accessibility
assertion. No application CSS, contrast rule or safety gate was weakened to
obtain the passing result.

An independent local Gitleaks scan of all 115 dirty canonical paths plus the
external New York JSON/JSONL/manifest/checksum inputs examined about 29 MB and
reported no findings. This is not a claim that an unavailable external scanner
passed. The separately retained transfer archive contains exactly the four
reviewed data files whose hashes were verified.

The national goal remains active. Registry configuration does not prove hosted
activation, and other states, local mapping, measures and profiles/news remain
unfinished.
