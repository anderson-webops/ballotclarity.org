# Georgia candidate-context reconciliation

## Verified publication

[VoteGA's open-data catalog](https://www.votega.org/open-data) offers a public
JSON/CSV election dataset, with a separate data license and reuse notice. Normal
bounded requests captured commit `d2f971a631cbeb50374d06b57e7606df34418e26`
and its four immutable data/rights files on November 2, 2026. The publication's
own `updatedAt` is October 30, not the later capture date.

The generic document Accept header initially received HTTP 415 from GitHub's
JSON API. Its supported JSON representation succeeded; no access control,
authentication or challenge bypass was used. All four immutable file responses
were HTTP 200. Original capture hashes remain in private research evidence.

## Fulton-first result

The repeatable exporter reconciles the retained 98 official Fulton candidates
against 442 eligible federal/state context entries for the exact general-election
date. Seventy-five identities match by name, party, office and district. Their
unverified context includes 74 safe-format HTTPS website leads, 50 occupation
entries and 50 residence-county entries. These are not new qualification claims
or newly published biographies. Website ownership and reachability are untested.

Five identities remain unmatched: Tyler Harper, Fitz Johnson, Josh Tolbert,
Rich McCormick and Devanta “Sully” Sullivan. Different names, phases or seat
representations are not silently reconciled. Eighteen local/judicial records
remain outside this exporter's reviewed office mapping. Neither group is
removed from the official roster, nor presented as an absence of candidates.

The output records every official identity, including unresolved cases. It
copies no biography or image and infers neither incumbency nor personal ballot
applicability. JSON/CSV identity disagreements and schema changes stop
preparation. Unsafe website values are held independently. The report cannot
be consumed by the existing candidate/reference importers.

## Rights and automation boundary

VoteGA's compilation is CC BY-SA 4.0. Its original `LICENSE` and `NOTICE.md`
accompany the adapted report. The publisher explicitly leaves underlying-source
reuse terms separate. This review does not establish those permissions or
approve publication of the extracted context. Matching a candidate also does
not verify that a campaign link is still controlled by that candidate.

`prepare-votega-leads` supports explicit phase/date and future-cycle captures
without guessing dates or promoting primary candidates into general elections.
It is deterministic offline preparation, not an enrolled network collector or
an unattended import. Existing official-source, source-access, publication,
geographic and scheduling gates are unchanged. See the
[source-side contract](../candidate-context-leads.md).
