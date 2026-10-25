# Congressional boundary provenance

## Finding

The Census Geocoder's `Current_Current` geography currently returns the 120th
Congress, which begins in January 2027. Reusing that district number to look up
the current House member can attach the wrong official. Conversely, a district
used by the current representative does not establish the 2026 ballot district.

The Census Bureau identifies nine states with changed 2026 congressional maps:
Alabama, California, Florida, Louisiana, North Carolina, Ohio, Tennessee, Texas
and Utah. Missouri is a separate correction case: the Bureau reports that the
2026 election uses the unchanged prior plan while some 120th products still
contain the superseded plan.

Sources:

- [Census congressional district products and correction notice](https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html)
- [TIGERweb current geography release](https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_main.html)
- [Texas current representation and election plans](https://redistricting.capitol.texas.gov/apportionment)
- [House explanation of current versus election districts](https://www.house.gov/representatives/find-your-representative)

## Direct observations

Normal documented Census coordinate requests were retained locally for public
capitol points in those nine states, Missouri and Georgia. Both `Current_Current`
and the explicitly advertised `ACS2025_Current` geography were captured. The
responses identify the congressional session in their layer names and
`CDSESSN` fields. These are point checks, not independent statewide boundary
surveys or proof of exact voter eligibility.

At the Texas capitol point, the current service returns district 10 for the
120th Congress and district 37 for the 119th. At the Missouri capitol point,
the same versions return districts 5 and 3 respectively, confirming that the
correction warning remains consequential for actual lookups.

The Census host's robots request returned an ordinary 404. Its published API
documentation expressly describes public developer use, coordinate lookup and
offered-vintage discovery. Requests used the normal HTTPS API without credentials,
alternate identities, hidden endpoints or an access-control workaround. No
personal address was collected for this audit. Raw responses remain outside Git.

- [Geocoder API documentation](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html)
- [Advertised geography vintages](https://geocoding.geo.census.gov/geocoder/vintages?benchmark=4&format=json)

## Implemented behavior

- Congressional matches retain their explicit session, geography vintage and
  state FIPS. Conflicting session attributes, unnamed-session layers and
  ambiguous multiple polygons are excluded.
- Current officeholder matching uses the session in office. When the main
  geography is for another session, the client discovers advertised historical
  vintages and makes a bounded coordinate-only lookup. It validates the returned
  session and state instead of inferring them from an ACS year.
- The offered-vintage inventory is reused for one day. Historical queries never
  repeat the submitted street address. A failure retains county, state and
  election geography but does not assign a future district's current official.
- Address and ZIP lookup share this behavior. ZIP centroids still do not create
  address-specific ballot claims.
- Election congressional matches travel separately through lookup responses and
  the encrypted saved context. The current representative directory continues to
  use current-officeholder matches.
- State candidate attachment requires the regular general election's explicit
  congressional session. The November date and session advance for future even
  years without guessing a publisher's file URL. Other election dates remain
  unmatched until their session semantics are reviewed.
- Missouri's 2026 congressional attachment uses the unchanged 119th plan rather
  than the currently inconsistent 120th product. This exception is confined to
  that election session. Current representation also uses that unchanged geometry
  during the 120th Congress, with a separate current-context session so the
  January handover still expires prior officeholder context. The exception ends
  with that congressional session instead of carrying into later elections.
- Existing source-level holds, including Texas and Williamson County, remain
  effective. This change supplies reliable map context but does not override
  independent source applicability or publication approval.
- Legacy address-cache entries are refreshed rather than silently trusted. A
  failed historical resolution is retried on the next lookup rather than treated
  as a complete cached result. Saved Census contexts without a valid current
  congressional session are rejected; existing encryption and expiry remain.

## Scope and validation

No candidate facts, identities, raw publications, source permissions, credentials
or canonical election-data files change. No new public explanatory copy is
introduced. Current/future session tests include the January congressional
transition, election-date validation, stale caches, saved-context round trips,
Missouri, conflicting state/session values and dependency failures. Future-cycle
cases are synthetic; they do not establish a future publication's availability.

Native checks and locally replayed real API/rendering evidence are required for
acceptance. Source release acceptance and receiving-host activation remain
separate. Broader state/local source coverage, complete ballot-style matching,
state-legislative boundary provenance and existing source-access holds remain
unfinished nationwide work.
