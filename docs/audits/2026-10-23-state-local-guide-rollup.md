# Statewide measures with local questions

## Public view contract

A published, nonempty local guide now includes separately published statewide
measure-only guides for the same state and exact election date. This is a
response-only view, not a mutation or duplication of canonical guide records.
The local location, source scopes, original measure identities and separate
publication decisions remain intact. Computed content counts include the added
statewide questions. Coverage limits still identify incomplete local coverage.

Lookup selects that composed local guide when the supported state/local pair
matches the resolved geography. Empty statewide shells cannot displace useful
local questions. Different election dates, multiple local areas, unknown local
geography and unsupported scope relationships remain explicit rather than
guessed. Statewide guides with candidate races are not silently reduced to
their measures. Statewide routes never acquire county questions.

Composition uses only the existing public election view after workflow and
individual content suppression. Draft or hidden source questions are not added.
Stored `includedStatewideElectionSlugs` metadata grants no eligibility; the
response computes it again. Conflicting identities fail rather than replacing
one question with another.

Inherited measure links carry an explicit election context. The API verifies
that the requested ballot is published and actually contains the separately
published measure before returning that context. Malformed, unrelated,
withdrawn or unpublished contexts fail. A canonical measure URL without the
context retains its original statewide parent. Client data keys distinguish
these views; back-links, saved-plan links and reloads do not borrow another
saved location.

## Santa Fe County

Four November 3, 2026 county bond questions are prepared from the retained,
hash-verified
[county sample ballot](https://www.santafecountynm.gov/uploads/documents/Sample-SANT_PCT001.pdf),
PDF page 2:

- Roads: up to $14,035,000.
- Water and wastewater: up to $6,500,000, including necessary water rights.
- Parks, trails and open space: up to $7,010,000.
- Fire facilities: up to $17,455,000.

The response labels remain **For general obligation bonds / Against general
obligation bonds**. This explicitly supported binary pair uses the existing
yes/no storage keys without relabeling the ballot. Long labels use full-width
stacked controls and a short operational heading, not smaller text or a content
dropdown. Principal is distinguished from unknown total repayment, and the
general property-tax repayment source remains visible.

When both New Mexico guide packages are independently published, the county
ballot contains all eleven questions: seven statewide and four county. Outside
the county or without county geography, a statewide lookup does not acquire
county questions. Missing candidate, judicial and other local coverage remains
explicit. The prior statewide bundle, original county research export, capture
times, unknown publication dates and older review packet remain unchanged.

The new sixteen-member review-data packet contains both native drafts and both
six-file preparation bundles, plus a manifest and checksums. It excludes source
PDFs, held publishers, private operator instructions and active runtime data.
Preparation does not import or publish these guides.

## Verification

Local verification passes: 1,022 unit tests, with two optional PostgreSQL skips;
lint/types; both builds and 105 compiled runtime modules; 21 integrated checks;
48 core accessibility cases; and 100 connected desktop/mobile light/dark
rendering/accessibility cases with four keyboard/choice/reload/print journeys.
Eight unit publication/hidden-content configurations and four actual-data
publication configurations preserve both approval gates. The existing North
Carolina statewide/Brunswick pair is checked as four effective questions.

Thirty preparation outputs retain source/compiled parity. The seventeen earlier
guides, fifty candidate captures/25,031 rows, original capture times and all
predecessor canonical files remain intact. Three final screenshots are visually
reviewed, including the full eleven-choice print view and the mobile long-label
controls. No content dropdowns, horizontal overflow or WCAG A/AA violations are
observed in the connected cases. No new publisher request is performed.

Initial source/test diagnostics remain preserved: the state catalog includes
non-string metadata beyond its code/name columns; the typed synthetic contest
needed its literal jurisdiction type; and the old two-content-guide expectation
is replaced by stronger combined-content assertions while unrelated elections,
multiple areas and mixed candidate scopes still remain explicit. Formatter and
lint failures are retained with passing successors, not suppressed.

No release, production activation, private transfer/import or scheduler change
is part of this source/data cohort. Remaining national work includes candidate
enrichment, additional lawful sources and unsupported multi-level local scopes.
