# Judicial profile sources

## Reviewed content

The independently published North Carolina 2026 judicial voter guide supplies
eight profiles and sixteen short background facts, covering both candidates in
each of its four appellate races. The publisher explicitly identifies the
submissions as candidate-provided. Facts summarize education and professional
experience, not campaign arguments, endorsements or claims about opponents.
Each name and statewide office reconciles with the retained Brunswick sample.

New Mexico's Supreme Court biographies supply two retention profiles and six
background facts. The Santa Fe sample independently establishes the matching
retention names and offices. Bacon's additional initial in the biography is
documented; no other justices are inferred to be on the ballot. The new
`official-biography` kind is labeled distinctly from candidate submissions and
reporting. It does not establish qualification, an evaluation or a personal ballot.

## Source and policy evidence

- [NCSBE judicial guide](https://www.ncsbe.gov/voting/upcoming-election/judicial-voter-guide-2026-general-election):
  captured October 22, 2026 at 04:10:03.647 UTC; SHA-256
  `f4c6ddbc5ed7d14487b2aec66f0f2c1ffa6716c84172621a01ef0b024f106744`.
- [New Mexico court biographies](https://supremecourt.nmcourts.gov/about-this-court/supreme-court-justices/):
  captured October 22, 2026 at 04:10:04.826 UTC; SHA-256
  `85657a7778fed5da8d2fe1e5f70079f2e420aaedc4e4fa299bd185153ad3d812`.

Both ordinary public paths are permitted by the retrieved robots policies.
North Carolina's linked state terms/privacy copyright and fair-use sections were
reviewed, including its unaltered non-image noncommercial distribution permission.
The court page retains an all-rights-reserved footer. Neither is treated as a
blanket license for campaign prose or images: only short factual summaries and
attribution are distributed. No publication date is inferred. Original-byte
fingerprints and original capture dates remain distinct from import time.

The excluded NC distribution host and NM candidate host remain untouched.
Washington's ordinary public guide returned 200, but its linked script request
returned 406. The helper requested HTML for both resources; the cause is
unverified. No retry, alternate identity, cached-contract fallback or candidate
handler request follows, and no host-wide prohibition is inferred.

## Storage and operation

The existing strict reference schema, source-configuration-bound atomic external
storage, compiled importer/exporter, state endpoint, filtering and independent
pagination are reused. There is one reviewed collection per state; no new scraper,
credential, environment variable or personal lookup integration is introduced.
Earlier LA/ME/WA collection fingerprints remain unchanged. New NC/NM references
are unavailable until explicitly imported, and expire with the existing election
window. Official candidate totals and source selection remain independent.

Ten factual snapshot/CSV/JSONL/review/manifest files and the three operator-package
companions remain in the ignored data directory. The v1.10.1 addendum has exactly
two supported snapshots and its manifest. The older v1.10.0 package remains
unchanged. Neither is a Git or runtime artifact or an authorized production data
transfer. Current server-AI instructions pin both packages and their independent
acceptance requirements.

## Local verification

Root and standalone back-end locked installs, lint, type checking, both builds,
752 unit tests and 21 integrated smoke tests pass. Two existing optional
PostgreSQL tests remain skipped. All fifteen native-binding checks pass, and full
and production dependency audits report zero vulnerabilities. Package metadata
and both lockfiles are unchanged.

All five collections import/export through the compiled command and survive a
new repository instance, preserving 35 profiles and 94 facts. Twenty-one actual
data API cases verify state, source attribution, filtering, pagination, malformed
queries, missing imports and corruption recovery. Official county totals remain
39/46; controlled state-only personal previews remain 12/18 and contain no profile
facts or reference IDs. Browser/provider traffic is restricted to loopback during
acceptance, with no publisher retrieval or production change.

Seventeen actual-data browser cases pass WCAG A/AA checks and have no horizontal
overflow or page errors at 320px and desktop widths. All three color schemes,
light/dark modes, red election dates, meaningful errors and keyboard retry are
covered. The rendered profile sections were visually inspected, not only their
page headers. The repository's additional 48 accessibility cases pass.

The independent local secret scan finds no secrets in the nine changed source
files and thirteen new factual/package files. A fifteen-second GitGuardian quota
probe times out; that service is unavailable, not passed. Existing hook delegation
and all other safety gates remain unchanged. All 221 prior canonical data files,
three prior collection configurations, five package/lockfiles, four worktrees and
three unrelated physical-checkout modifications are preserved.
