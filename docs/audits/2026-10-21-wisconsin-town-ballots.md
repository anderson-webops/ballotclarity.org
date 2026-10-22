# Wisconsin town sample ballots

## Sources

The [Town of Dane November 3 publication](https://townofdane.gov/2026/09/16/november-3-2026-general-election-information/)
explicitly links three school-area sample ballots and a county Type B notice.
Normal public requests captured all four PDFs on October 21, 2026. All eight
pages were visually reviewed. Candidate data is identical on the three samples;
the Type B notice corroborates the Senate/Assembly names without adding people.

The source index, document host and vendor privacy notice were inspected. Public
robots allow the relevant paths, and no applicable factual-reuse prohibition was
identified in the linked privacy notice. Ordinary redirects, descriptive source
identity, normal TLS and bounded requests were used. No credential or voter
lookup was needed. A separate Dane County index returns HTTP 403 and is not
retried. Sauk County's separately restricted website is not accessed: "Sauk" in
this permitted town sample identifies its school area, not that website's data.

## Reconciliation

Fifteen records in nine offices, from 45 repeated printed choices: nine statewide,
one CD 2, one Senate 27, two Assembly 81 and two county entries. Each sample has
seventeen named people because each of its two governor/LG choices is one joint
ticket. The source's five Republican, nine Democratic and one Wisconsin Green
choice labels reconcile independently through physical party-row text. No
person is split from a ticket or counted again because a different school-area
sample repeats the same choice.

The notice says nominations have been certified to or filed with the clerk;
the snapshot uses listed status rather than claiming every entry is certified.
One-person offices are not labeled unopposed or elected. Blank write-in lines,
the notice-signing clerk, polling officials and voter signature fields are not
candidates. Original names, initials, party labels, districts and county context
are preserved. Redundant vote-for-one instructions stay in factual claims rather
than being repeated in the interface.

Three statewide and four school questions are fully transcribed into external
factual companions with their original YES/NO choices. The thirteen repeated
question claims reconcile to seven unique questions. Lodi and Waunakee each have
two school questions; the Sauk sample has none. They are not application measures
or personal ballot assignments. Overlapping ward labels are not sufficient to
infer school eligibility.

## Storage and verification

`wi-town-dane-2026` is manual-snapshot/external-only. The ordered source-set hash is
`f72b2472025ba578f1dde54891b4134b7da3647f9b5247e663203d2449450718`.
Original PDF hashes, individual capture times and record contributions are in
the external manifest. Its snapshot date conservatively retains the earliest
document capture, `2026-10-21T20:44:59.158Z`, not a later import time.

The snapshot, candidate export, candidate claims, question texts, question claims
and manifest form an exact six-file archive with separate checksums. They remain
ignored in `back-end/data/state-ballots/`, outside Git and code releases. No
original graphics or private contact data is included. Back up the data package
separately before removing the checkout. Use the supported reviewed import;
automatic refresh and bundled fallback are refused.

Five new focused synthetic tests pass for this source. Final repository lint,
typecheck, both builds, 659 unit tests and 21 integrated tests pass; two existing
optional PostgreSQL tests are skipped. The compiled build verifies 79 back-end
modules and fifteen native dependency entries. Supported archive import,
restart and separate-process export reproduce the reviewed facts exactly.
Invalid imports preserve the prior cache, and automatic PDF refresh is refused.

All 29 retained snapshots reconcile 18,950 records across 204 bounded public
projections. Forty-four responsive rendering and WCAG A/AA cases pass with no
violations, page errors or horizontal overflow. Eleven final images were
visually inspected, including both keyboard-operated source disclosures. The
four document links now sit in a native Sources control instead of pushing
candidate content down the mobile page. The single-source link, election date,
capture time and material coverage limitations remain directly visible. No
introductory, reassurance or interface-explanation copy is added.

Six prior files are backed up and byte-bound to the starting state; three new
canonical files are added. All 131 unrelated paths, 68 previous external files,
five package/lockfiles, heads, staging and worktrees are preserved. There are
137 managed dirty paths and 83 external files, most belonging to earlier work.
The final local secret-scan and acceptance receipts bind the reviewed files.
Local services, browser and temporary stores are closed or removed. This is
local-only work, not publication, server transfer, hosted activation, a new
schedule or a change to permissions. The national collection and final
server-AI handoff remain unfinished.
