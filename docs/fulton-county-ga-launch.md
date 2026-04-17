# Fulton County, Georgia Launch Brief

This document records the current first-jurisdiction choice for Ballot Clarity's production rollout and the source stack selected for that launch.

## Launch jurisdiction

- County: Fulton County
- State: Georgia
- Current election target: `2026 General Primary Election and Nonpartisan Election` on `May 19, 2026`
- Next election target: `2026 General Election and Special Election` on `November 3, 2026`

## Official systems to prioritize

1. Fulton County Registration and Elections
   - Primary county office for voter education, contacts, absentee guidance, and election updates
   - <https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections>
2. Fulton County elections contacts
   - Office phone, addresses, and service contacts
   - <https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/elections-contacts>
3. Georgia My Voter Page
   - Official statewide voter portal for registration status, precinct, sample ballot, absentee ballot status, and voting details
   - <https://mvp.sos.ga.gov/s/>
4. Georgia election calendar and events
   - Official statewide calendar and elections schedule
   - <https://sos.ga.gov/index.php/page/election-calendar-and-events>
5. Georgia 2026 elections calendar summary
   - Current-cycle statewide deadlines and milestones
   - <https://sos.ga.gov/2026-elections-calendar-summary>

## Selected provider and normalization stack

### Address and district matching

- U.S. Census Geocoder
  - Official address normalization and geography lookup
  - <https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html>
- TIGER/Line geography
  - Versioned geography files for reproducible district joins
  - <https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html>
- Georgia Reapportionment Office
  - Official state district maps and geography references
  - <https://www.legis.ga.gov/joint-office/reapportionment>

### Ballot packaging and election logistics

- Official county and statewide election systems first
- Normalized provider layer for scale:
  - Democracy Works as the preferred nonprofit normalization reference
    - <https://democracy.works>
  - BallotReady as a commercial fallback/reference pattern
    - <https://www.ballotready.org>

### Candidate and officeholder enrichment

- Georgia General Assembly
  - Official state legislative site
  - <https://www.legis.ga.gov>
- Open States
  - Practical normalization layer for state legislative data where official feeds are incomplete
  - <https://openstates.org>
- Congress.gov API
  - Official federal legislative activity API
  - <https://api.congress.gov/>

### Money and influence

- Georgia Ethics Commission
  - State campaign finance and ethics records
  - <https://ethics.ga.gov>
- OpenFEC
  - Official federal campaign finance API
  - <https://api.open.fec.gov/developers/>
- LDA.gov
  - Official federal lobbying disclosure system
  - <https://lda.senate.gov/system/public/>

## Product implications

- Fulton County launch should go live with official logistics, official verification links, and transparent coverage limits before full personalized ballot matching is promoted as live.
- Personalized Fulton ballot lookup should stay off until Census-based address matching, Georgia district geography, and a verified contest crosswalk are all in place.
- Public status, coverage, and corrections pages are part of the production launch surface and should stay public even before full contest coverage is live.

## What still has to be provisioned outside the repo

- Managed Postgres
- Object storage or CDN for mirrored source files
- Secret management for admin bridge secrets and provider credentials
- Scheduled jobs for source checks and future live coverage imports
- Provider agreements or API credentials where required
