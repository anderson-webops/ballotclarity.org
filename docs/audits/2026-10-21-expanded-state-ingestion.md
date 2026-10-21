# Expanded state-source ingestion review

## Scope

This follow-up adds Colorado, Kentucky, and North Dakota to the eight adapters
reviewed earlier on October 21, 2026. The registry now has eleven states, not
complete national or local-ballot coverage. `docs/state-coverage-2026.csv` lists
all fifty states and DC, distinguishing integrated sources from fifteen other
investigated jurisdictions and twenty-five still awaiting research.

## Retrieved records

| State | Source records | Status evidence | Statewide entries rendered in a state-only lookup |
| --- | ---: | --- | ---: |
| Colorado | 404 | 393 qualified, 10 write-in, 1 withdrawn | 41 |
| Kentucky | 210 | 199 listed, 7 write-in, 4 inactive | 4 |
| North Dakota | 717 | 717 listed; 12 unnamed vacancies excluded | 21 |

Colorado uses the official HTML roster rather than adding an XLSX dependency.
Kentucky requires the four configured federal/legislative pages and its
closed-status page, all selecting the same general election. North Dakota uses
the normal public unfiltered search with observed form fields; no challenge,
authentication, or TLS controls are bypassed.

The dated JSONL transfer document preserves source URLs, retrieval timestamps,
hashes, statuses and record counts. It includes 1,331 candidate records and one
source-published campaign link, but no residential/contact fields. Local records
remain distinguishable by county/jurisdiction and are not presented as an
address-specific ballot. Existing Wyoming records also retain safe campaign
links. North Carolina local office identities no longer collapse across counties.

## Copy review

Removed the footer's redundant project tagline and the district list's obvious
ordering explanation. Replaced the email failure's incorrect reference to a form
"above" with `Email unavailable.` Source provenance, election date, qualification
and coverage limits, ZIP uncertainty, contact/navigation controls, accessibility
labels and the unofficial-site disclosure remain.

## Verification

- Root `npm ci` and standalone back-end locked installation passed; no dependency
  or lockfile changes were required. Full and production audits found zero vulnerabilities.
- Formatting, lint, type checks and both production builds passed.
- 487 unit tests passed; two optional PostgreSQL tests were skipped.
- All 21 integrated browser tests and 48 route/theme accessibility checks passed,
  plus four focused state-candidate checks across mobile/desktop and light/dark themes.
  Fifteen Linux ARM64 native binding declarations/installations passed verification.
- All eleven configured feeds succeeded during live checks. Wyoming first had a
  transport failure, then succeeded on a secure bounded retry with 151 records and
  11 campaign links; no fallback weakened transport validation.
- Actual retrieved CO/KY/ND records passed local API lookup, signed-cookie
  restoration and built-page checks at 320, 390 and 1280 pixels. Every eligible
  statewide entry rendered, campaign links matched source output, and no browser
  errors or horizontal overflow occurred. ZIP fixtures did not establish district
  eligibility. Desktop/mobile screenshots received visual review.
- Local Gitleaks scanning found no leaks. A fresh GitGuardian source upload was
  not authorized and was not retried through another route.

Source publication and artifact acceptance do not establish production activation.
The remaining national source, local mapping, measure and candidate-profile/news
research goal is still active. No production host access or configuration changes
are part of this review.
