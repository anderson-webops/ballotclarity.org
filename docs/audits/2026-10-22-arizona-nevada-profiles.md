# Arizona and Nevada profile review, October 22, 2026

## Sources and authorship

Eight independently published public pages supply eight profiles and 23 short
background/position items. Exact publication URLs, publishers and source kinds
are pinned in `back-end/src/election-reference-sources.ts`. Original captured-byte
hashes, times, factual proof phrases and identity decisions remain in ignored
review companions. Unknown publication dates are not inferred from page footers,
search dates or current office.

Arizona uses the governor's Hobbs biography, Biggs's congressional biography,
Risa Lombardo's candidate statement and two Hourihan campaign pages for Teri Ann
Hourihan and Angela Harrolle Mohan. Official biographies and candidate-provided
claims retain different source labels, even within the same collection. Nevada
uses the attorney-general, governor and lieutenant-governor offices' Ford,
Lombardo and Anthony biographies. These are official office publications, not
independent qualification checks or blanket verification of every assertion.

Exact-host access policies and available copyright/privacy notices were reviewed.
Normal HTTPS verification and a stable descriptive review identity were used;
Arizona governor's ten-second delay was respected. Biggs's copyright notice
identifies federal government content except where otherwise noted. No state or
campaign notice is assumed to license third-party prose or media. Only newly
written short factual/position summaries are transferred, not source text,
photographs, contacts, family details, medical history, faith or allegations.

## Identities and limits

Arizona's five people match four retained governor/lieutenant-governor ticket
rows by exact surname/given-name member and explicit ticket slot. Harrolle Mohan
is the running mate, not a fifth governor choice. Giles, Kerr and Castillo have
no profile in this collection; absence is not withdrawal. The official 207-record
dataset is unchanged, and its geography is not new personal ballot assignment.

Nevada's three profiles match three of six retained governor/lieutenant-governor
rows, with an explicit Joe/Joseph Lombardo name-variant review tied to Nevada's
public governor office and retained Governor row. Risa Lombardo is not that person.
Danielle Ford and Aaron D. Ford are also separate candidates. Nevada's official
254 records stay unchanged. No missing submission is turned into disqualification.

Biggs's dated term/committee descriptions and Hobbs's inconsistent election-day
date are omitted rather than silently made current. Education fields and degree
levels follow the source wording; Hobbs/Harrolle graduation is not assigned an
unstated degree. Harrolle's honorary commander role is not military enlistment.
Candidate-authored policy positions are presented as positions, not independent
findings about opponents or government conduct.

## Excluded and unresolved sources

Danielle Ford's biography returned 403. No alternate campaign route, identity or
mirror was used. The Clean Elections index and its current general-election PDF
link were reviewed, but the document host returned 400 for its policy request;
no PDF, alternate-container policy or document mirror was retrieved. That guide
is not an accepted profile source. The independently authored pages above are
not replicas of it. Search-only int/prod Nevada governor hosts were not requested:
the actual public governor homepage links the accepted www biography.

## Consolidated operator package

The ignored `server-reviewed-election-data-2026-v1.10.4.tar.gz` is one cumulative
transfer package with exactly 44 flat members: 33 unchanged reviewed official
snapshots (17,662 records), ten reference snapshots (88 profiles/236 factual items)
and a manifest. Its 716,788 compressed bytes replace the four-package transfer
procedure without changing any historical package, tag, original timestamp or
preceding reference configuration. Seventeen permitted automatic sources remain
separate server downloads, subject to current policies and the source allowlist.

Each member's source/election/schema, byte hash, configuration fingerprint and
count is validated against maintained source. Source PDFs/HTML, review CSV/JSONL,
contacts and credentials are excluded. Bulk data stays outside Git and protected
runtime artifacts. The source agent has neither uploaded nor imported the package.
Approved operator transfer/import remains separate from protected runtime activation.
The local-only operator handoff retains exact hashes, acceptance and recovery,
including retaining new collection files during rollback to v1.10.3.

## Local acceptance

Root and standalone back-end locked installs, lint, typecheck and both builds pass.
All 755 unit tests pass, with two existing optional PostgreSQL skips; all 21 smoke
tests pass. Ten compiled reference imports/exports round-trip 88 profiles/236 facts.
The compiled official importer accepts all 33 reviewed snapshots and preserves
17,662 records, source identities and original capture dates. These are controlled
local imports, not production data activation.

Actual-data acceptance covers 86 API cases and all 33 imported official source
totals. Seven retained datasets still populate at 39/46/155/279/255/207/254 records,
with synthetic state-only previews unchanged at 12/18/18/7/7/23/18. The official
repository uses a controlled clock after the latest fixture capture; no data is
retimestamped or runtime freshness policy relaxed. Publishers and browser provider
requests are blocked. Reference IDs/facts never enter personal lookup responses.

Seventeen actual-data responsive/theme WCAG checks and 48 core accessibility checks
pass. Representative Arizona/Nevada mobile/light/dark and desktop renders are
visually reviewed, including attribution and red election dates. An unpublished
degree summary was made explicit about B.S./M.S./M.A./Ph.D. levels before acceptance;
only compact revision hashes remain, not superseded duplicate packages. Existing
missing/corrupt-profile recovery and earlier collection behavior remain intact.

Full/production audits find no advisories. All 1,227 registry signatures, 444 package
attestations and fifteen native bindings verify. Independent local secret scans
cover changed source and every cumulative package member. The bounded GitGuardian
availability probe times out, so it is unavailable, not passed. Old data, unrelated
work, dependency manifests/lockfiles, publisher exclusions and safety gates are
preserved. Clean-source runtime and protected publication verification remain
separate delivery gates rather than being inferred from these local checks.
