# Official state ingestion acceptance

## Scope and release boundary

PR #34 merged the combined Claude redesign into `main` as
`75fd9a4302ae3534000e0a4e097426af8fc91315`. The published `v1.8.76` release is
labeled **last release of the old look**. Its immutable annotated tag and target
`70109422269ffef5f28561fe8216f00f61c28140` were not moved.

The follow-on change adds eight official candidate adapters, national official
election-office navigation, visible complete candidate lists, and a concise
limited-coverage status. See [the maintained source catalog](../state-ballot-sources.md)
for endpoints, status handling, privacy, expiry, and investigated access limits.

## Retrieved official data

The application transport retrieved and parsed all eight sources on October 21,
2026 UTC. Counts include inactive and local records retained for filtering; they
are not counts of candidates on an individual's ballot.

| State | Deduplicated source entries | Statewide entries rendered in the state-only API/browser review |
| --- | ---: | ---: |
| Delaware | 128 | 11 |
| Florida | 1,143 | 19 |
| Maryland | 369 | 8 |
| Michigan | 716 | 64 |
| New Mexico | 524 | 12 |
| North Carolina | 2,484 | 12 |
| Virginia | 38 | 2 |
| Wyoming | 151 | 16 |

All eight were exercised through `POST /api/location`, restored through the
encrypted active-lookup cookie route, and rendered in the built frontend using
the locally retrieved official records. Every eligible candidate reached the
page; no first-four/first-six truncation, collapsed candidate section, horizontal
overflow, or uncaught browser error was observed. Geographic inputs were
explicit state-only review fixtures, not assertions about a real voter's ballot.
District eligibility and ZIP/IP restrictions have separate regression tests.

## Local checks

- Root clean `npm ci` and standalone backend clean lockfile install passed.
- Lint and both application/test type checks passed.
- Unit suites: 479 passed, two optional PostgreSQL integration tests skipped
  because this local run did not configure a PostgreSQL test server.
- Built frontend/backend and all 21 integrated browser smoke tests passed.
- Accessibility: 48 route/theme checks plus four state-results desktop/mobile
  checks passed the configured WCAG 2 A/AA rule set. Light/dark rendering and
  real-data desktop/mobile screenshots were visually reviewed.
- Full and production-only dependency audits reported zero vulnerabilities.
- Linux ARM64 native-binding lockfile/installation checks passed for 15 entries.

The post-merge baseline CI audit exposed newly published transitive MCP SDK
advisories. Its server/core dependencies are refreshed to `2.3.1`; no audit gate
was relaxed. Root and standalone backend locks remain synchronized.

An independent local Gitleaks scan of the staged change set passed with no
findings. A fresh
GitGuardian CLI upload was not performed because automatic approval review
rejected external source upload without explicit authorization. The historical
hosted template/example alert is not represented as externally cleared.

## Reload and copy review

Browser persistence continues to strip ballot/provider content and street
addresses. A regression exposed Nuxt reusing a null hydration payload instead of
refreshing missing records. Only initial loads reuse that async-data payload;
refreshes request the signed-cookie result and restore candidate previews only
for matching location, input type, selection, ZIP, and districts. The browser
regression confirms eight candidates remain visible while storage retains zero
ballot previews.

Removed the redundant “Your next steps” heading, the local-cache implementation
message, and a generic official-tool instruction generated for resources without
substantive notes. Preserved source links, retrieval/election dates, explicit
qualification/coverage limitations, accessibility text, meaningful errors, and
the site's not-an-official-election-website disclosure. No new marketing,
prototype, reassurance, or implementation commentary was added to the interface.

## Delivery limits

Source delivery and immutable runtime-artifact acceptance remain separate from
production activation. No DNS, host services, credentials, permissions, saved
application configuration, or production deployment were changed by this work.
Unrelated main-checkout edits to `.gitignore`, `AGENTS.md`, and `GEMINI.md` are
preserved.
