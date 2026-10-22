# Interface simplicity review, October 22, 2026

## Scope and observations

The supplied West Union results screenshot and current local captures showed a repeated location form, parallel shortcuts to the same representative directory, repeated limited-coverage text, and an official-tool title followed by a second link repeating its name. Representative and district directories repeated attributes and secondary buttons in every row. Candidate-information rows mixed identity, office, authorship, multiple background facts, source links and timestamps.

The review covers public results, navigation, representative/district directories, ballot cards, source-record browsing and details, election dates and short voting-help answers. It does not change election eligibility, source registries, imported data, provider credentials, administration, or production configuration.

## Changes

- Results and plans no longer contain a second location form. Header Change links and legacy results/plan location-change hashes reach the existing home input. The home input receives focus at that entry point.
- Results retain one coverage limitation, one group of contextual record links and single linked official-tool titles. Representative and district data remain available in their directories and individual pages rather than being copied into the results view.
- About is a direct header link. Sources, coverage, voting help, contact, accessibility, privacy, terms, status and corrections remain linked through the existing About page or grouped footer. No page is removed.
- Representative and district rows use one whole-row detail link and one subdued supporting line. Repeated summaries, attribute labels and funding/influence/provider button clusters are removed from directory rows. Source and finance/influence access remains on the individual pages.
- Candidate and measure cards link to their existing full pages. Saving choices, comparing candidates and reviewing sources remain available there. They are no longer repeated as a button row on every summary card.
- Official candidate records and sourced references have whole-row links to exact record details. Full statuses, party labels, source status, ballot designations, candidate websites, background facts, provenance, source links and capture dates remain available on those pages. Empty factual lists and invented background placeholders are not rendered. Exact IDs and collection identity prevent substituting a similar name.
- Short help answers, essential candidate background, measure YES/NO outcomes and ballot logistics do not require an extra toggle. Large optional topic sections, source lists, matching evidence and histories retain meaningful disclosures. This is not a blanket expansion of all content.
- Calendar dates and freshness timestamps use ordinary text colors. Only the nearest relative timeline indicator and the home page's single upcoming-election countdown use red. Past dates move below upcoming dates into a secondary disclosure; their notes remain accessible.

## No-change findings and limits

The grouped footer already preserves important destinations without an additional sidebar. Large source/provider catalogs, change histories and matching evidence are genuinely secondary material, so their disclosures remain. Required coverage, attribution, privacy/legal and accessibility information remains accessible. Private administrative review tables retain their operational detail and safety gates.

No timed participant study was conducted. The two-second glance review and three-preferred/four-maximum summary budget are product heuristics, not laboratory-derived screen limits. Research interpretation, a reusable instruction set and a deep-research prompt are in [interface-simplicity.md](../interface-simplicity.md).

## Verification

Root and backend locked installs, lint, typecheck, both builds and 784 unit tests pass, with two existing optional PostgreSQL skips. All 21 browser smoke tests and 48 core route/theme accessibility checks pass. Twenty actual-data detail-page accessibility checks cover factual profiles, sparse identities, reporting and official records in light/dark modes at 320/1280px. Four date-color checks and four directory-row checks pass; a missing exact ID never substitutes a similar name. Current in-app-browser captures also verify results, directories, help, record details and the nearest deadline.

The isolated local data store contains the unchanged 60 reviewed reference collections/307 profiles and 50 official datasets/25,568 records; no publisher requests are enabled in that test. Full/production vulnerability audits, 1,227 registry signatures, 444 dependency attestations and native bindings pass. Source and staged/outgoing secret review and exact clean-source runtime acceptance are required before publication; their immutable evidence belongs to the release acceptance record, not this narrative.

All 362 canonical data files, unrelated physical-main changes and prior worktrees/tags are preserved. The reviewed v1.12.0 data package is unchanged; production data transfer/import remains an independent approved operator step, not part of this UI release. Temporary fixture-setup failures and obsolete presentation assertions were corrected; the final source, browser and actual-data runs are successful.
