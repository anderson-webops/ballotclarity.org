# Kansas and Nevada source collection

## Scope and delivery

Local-only source/data work. No commit, push, tag, release, hosted transfer,
deployment, service/credential/permission or saved-configuration change occurs.
Existing uncommitted work and forty previous external data files remain protected.

| Source | Statewide | Congress | Senate | House | Local/regional | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kansas, Johnson County | 23 | 3 | 0 | 45 | 27 | 98 |
| Nevada, Clark County | 18 | 11 | 12 | 57 | 156 | 254 |

These publications are partial state coverage. Neither supplies a verified
personal ballot or a complete substantive candidate profile collection.

## Kansas automatic source

The [official election index](https://www.jocoelection.org/events-elections/november-3-2026-general-election)
links the public candidate page with election ID 6023 explicitly selected. Its
normal 200 response selects November 3, 2026 General Election and all jurisdiction
and office levels. All twenty server-rendered result groups yield 98 records.
The reviewed HTML capture is dated 2026-10-21T18:07:52.953Z, SHA-256
`f03f8484479b44a24ab624ac59e7568487f048427a4702a739163ced93e02eb4`.

The linked [revised election notice](https://www.jocoelection.org/sites/default/files/2026-10/11-03-2026%20-%20Notice%20of%20Election%20%28candidates%29%20-%20REVISED.pdf)
was captured at 18:25:43.973Z, 267,285 bytes, SHA-256
`e81226e9b849b7ea39a379c398949772e1eb1647fd22f2a31c03bbb60ec4e7ea`.
All six candidate/retention pages were visually reviewed; the remaining sixteen
pages contain voting locations, not imported candidate facts.

The election host's robots permits these routes; the linked county government
legal disclosures were read in full. The separate government host's PDF/`/sites/`
restrictions are not treated as permission to download forbidden paths there.
No state-portal HTTP 403, protected email, private voter tool or authentication
mechanism was bypassed. Homes, mailing addresses, phones, emails and residential
city fields are excluded. Only explicit campaign website fields are imported.

The maintained parser requires the exact election/date and unfiltered controls,
one complete result container and an explicit all-candidates indicator. It
refuses pagination, unknown office/party/incumbent vocabulary, malformed cards,
duplicates, orphan records and broken governor tickets. Twenty-seven House
districts are printed; no missing Senate race or other district is invented.
School/education, county, township, city and judicial districts remain local.
Two empty clerk offices in the notice do not become candidate records.

Governor/LG tickets remain paired. Eighteen judicial retention seats remain
distinct, seven statewide and eleven in the tenth judicial district. Incumbent
markers are not election outcomes. All 98 portal records retain listed status,
31 explicit incumbent designations and 48 explicitly published campaign links.

One real source discrepancy remains: the portal says **Tara A. Combs**, while
the revised notice says **Tara A. Combes**. The portal spelling is retained with
the local source-status note `Revised notice: Tara A. Combes`. It is neither
silently corrected nor duplicated into another person. That narrowly scoped
2026 note disappears if the portal name matches the notice on a later refresh.
The existing directory search also checks public source-status notes so either
official spelling finds the same record; no private contact field is searchable.

A normal supported downloader request succeeded with all 98 records unchanged
despite changing HTML wrapper/email-obfuscation bytes. Fresh capture at
2026-10-21T18:38:54.706Z had SHA-256
`716940394dd4989ca93f0b0b9d2be283638eb4dea986ab797be1e4cc4adc6ed2`.
Only validated public fields persisted in an isolated server-style directory;
restart loaded exact facts without another request. No production job was enabled.

The final compiled management command also performed a normal fresh `refresh KS`
at 2026-10-21T19:04:25.365Z, source SHA-256
`e8ae871d4370a8ca1617812b73c50f2517205ed8c9955887b3d5d37fd5e868a7`.
All 98 public records remained exact. A separate-process export and restart loaded
the persistent facts without another publisher request. A controlled unreviewed
withdrawal notice failed closed and preserved the prior good disk cache. Automatic
snapshot import remained refused. The built API returned all public fields exactly;
both official surname spellings found one record, and the state-only ZIP preview
contained 23 candidates in thirteen offices without assigning the 27 local records.

## Nevada reviewed publications

The [official general-election index](https://www.clarkcountynv.gov/government/departments/elections/26g-info)
independently publishes the candidate table and current fall newsletter.
The county robots permits public paths; its full privacy, security, public-access
and intellectual-property notices were read. Collection does not impair access
or reproduce protected newsletter graphics. Only attributable source facts enter
the transfer. No voter identity or state anti-bot workaround is used.

| Original | Capture, UTC | SHA-256 |
| --- | --- | --- |
| Ten-page candidate table | 2026-10-21 18:07:42.245 | `f9e256f97332833676ec2362fb0e80aaf16497dc568f067e616b86df52e353e6` |
| Fall newsletter | 2026-10-21 18:25:33.372 | `0e6d08a0a23adedb782d03af33f0466d815f6c5ec63d1c581a4e72741fe777d2` |

All ten table pages and newsletter candidate pages 3–11 were visually reviewed.
Independent column-bound extraction reconciles all 254 ordered names and party
labels across both originals after whitespace/typography normalization. Four
wrapped name fields were checked against pixels. All 508 printed candidate claims
remain linked to their original document/page; the duplicate newsletter contributes
zero new records but remains mandatory provenance. The source-set digest is
`7e61cba23f18294536225641c2f4c8e32386d7b51c9867a86352e5b35f77ea1f`.

Governor and lieutenant governor are separate elections, unlike Kansas's joint
tickets. Ordinary Nevada judicial elections are not retention questions or
inferred unopposed outcomes. Supreme Court seats B/D, family departments A–Z,
district court departments, regent/school districts, local wards and distinct
unexpired terms remain separate. Multi-seat limits remain in the factual claims.
Eight `None of these candidates` options remain non-person companion records,
never candidate names. The source's distinct No Political Party and Nonpartisan
labels are not collapsed into party membership guesses.

## Storage and interface

New payloads remain in ignored `back-end/data/state-ballots/`: Nevada snapshot,
candidate/printed-line JSONL and manifest, plus exact four-file archive/checksums;
Kansas snapshot, candidate JSONL and manifest, plus three-file archive/checksums.
Neither raw PDFs nor HTML contact details enter these packages or code releases.
Kansas supports permitted automatic download and persistent TTL-controlled cache.
Nevada requires validated external import and refuses automatic PDF refresh.
Automatic snapshots deliberately cannot enter through the reviewed-file import
command. Kansas's transfer is for factual review/backup; the hosted flow downloads
through `refresh KS` and exports its validated cache. This existing gate is preserved.

The existing directory, source links, partial-coverage notice and red election
dates display the new facts without new layout, reassurance or instructional copy.
The only new uncertainty text is the consequential local name-discrepancy note.
The new Nevada scope notice omits the repeated phrase `and later changes` because
the adjacent existing freshness notice already states that limitation. That
essential notice, source links and partial-county scope remain intact.

## Changed files

- `back-end/src/state-ballot-sources.ts`: the two source definitions and concise scope notices.
- `back-end/src/state-ballot-records.ts`: explicit Kansas adapter dispatch.
- `back-end/src/state-ballot-portal-records.ts`: bounded, fail-closed public Kansas parser.
- `back-end/src/state-records.ts`: search the public source-status field, including the disclosed spelling difference.
- `back-end/test/state-ballot-kansas-nevada.test.ts`: ten synthetic parser, storage, import and eligibility regressions.
- `README.md`: current source counts and current collection audit reference.
- `docs/state-ballot-sources.md`: source coverage, persistent storage and supported automatic/manual operations.
- `docs/state-coverage-2026.csv`: Kansas/Nevada scope and remaining work.
- `docs/audits/2026-10-21-kansas-nevada.md`: source reconciliation, checks and delivery boundary.

Eleven new ignored data/package files accompany the two sources. They are not
staged, tracked, copied into compiled code assets or published. No dependencies,
package manifests, lockfiles, front-end layout or shared styles change in this batch.

## Verification

- Final lint and typecheck pass. All 636 unit checks pass with two existing optional
  PostgreSQL skips. Both builds, 79 required compiled back-end modules/runtime assets,
  all 21 integrated browser checks and fifteen native-binding entries pass.
- The corrected whole retained-data harness passes 48 rendering/WCAG A/AA cases
  across source records, filters, pagination, source links, typed geography, missing
  data, surname discrepancy, retention, family/Supreme Court offices and lookup.
  All 25 retained snapshots reconcile exactly: 18,401 records across 196 bounded
  pages, unchanged source capture times and zero publisher requests during this review.
- Kansas's final live compiled refresh, export, disk persistence/restart, invalid-update
  refusal and built API checks pass. Nevada's compiled reviewed import, separate-process
  export/restart and exact archive members/checksums pass; manual PDF refresh is refused.
- All original candidate pages and factual reconciliation pass. Eight non-person
  options remain companion facts, not people. No local eligibility, winners or measure
  payloads are inferred, and saved lookups remain isolated from directory browsing.
- Preservation verifies 124 unrelated paths, seven byte-bound original backups,
  forty prior external files and all five unchanged manifests/lockfiles. Both heads,
  empty staging and all four worktrees are unchanged. The current managed dirty-file
  count is 130, including all earlier protected work, not 130 newly edited files.

- The final warning-only follow-up passes ten additional WCAG A/AA cases on the
  directory and state-only lookup pages, including all three palettes in light/dark
  mode and 1280/390/320-pixel widths. Ten representative final/base images were
  visually reviewed. There is no horizontal overflow, incorrect local assignment,
  source-link loss, hidden spelling conflict or uncaught page error.
- Independent local Gitleaks 8.30.1 scans all 130 changed source/document paths
  plus 43 non-archive external data inputs, 173 files total, with zero findings and
  no external upload. GitGuardian remains previously unavailable, not a passed scan.
  Final preservation and scan receipts bind the completed documentation bytes.

The first browser harness correctly reached all 48 page checks, then failed at its
incorrect assumption that an automatic Kansas capture could use reviewed-file
import. The application gate was not relaxed. The corrected harness verifies
Nevada's reviewed import, Kansas's existing cache export and the expected refusal
of Kansas reviewed import; a separate fresh compiled `refresh KS` proves Kansas's
supported bootstrap. Initial fixture/formatting diagnostics were corrected before
the final full checks. No failed check or unavailable scan is reported as passed.

No-change findings: the existing record directory, filters, source-link treatment,
red consequential dates and local-eligibility boundary already support these facts.
No additional headings, cards, onboarding, progress commentary or reassurance are
needed. The surname note is retained because removing a real source conflict would
hide consequential factual uncertainty.

## Remaining scope

Thirty-nine states plus DC now have configured sources, seventeen automatic and
twenty-three dated, including seven external-only reviewed imports. Eleven states
still lack candidate datasets. Maine is municipal-only. Complete local eligibility,
measures, substantive profiles, later amendments and legacy bulk-data migration
remain unfinished. Final server-AI instructions remain queued, not ready.

The next reviewed leads are a separate Montana public general-election CSV export
and Pima County's independently published official general candidate/write-in
originals. They are captured for review, not integrated. Nashville's reuse terms,
Milwaukee's robots HTTP 403, Providence's 307 without Location and earlier state
restrictions remain respected. These leads do not change the current source count.
