# Ballot and civic views

Candidate previews group source-provided names under the corresponding office.
Each valid name is a navigation link, not a selection or vote control. Summaries
show party and source-provided status; designation and source details belong on
the person's detail page. Filing remains distinct from qualification.

State records link to the existing source-bound record page. Other providers use
the ballot-record page, which resolves exact source and candidate IDs. It does
not match people by name or treat campaign websites as verified local profiles.
Public lookup context in these links is limited to a five-digit ZIP and an
existing selection identifier. Street addresses stay out of the URL.

The view uses explicit source/election dates and the public source catalog.
Within a 90-day UI focus window, offices and candidate records take priority.
Outside it, representatives take priority; any actually published later-election
records remain available below them. Past candidate previews do not become a new
ballot. Dated links to the original publications remain reachable.

A date-only election stops being current at noon UTC on the following day,
after that date has ended in every civil time zone. This is a presentation
boundary, not a calculation of polling hours, certification or term changes.
Undated data is not assigned an invented election date. Missing dates alone are
not proof that no election exists.

The clock initializes in request-local Nuxt state, then updates after hydration
and once a minute while the component is mounted. Source catalogs can supply
cycle dates even when a candidate snapshot has expired. Aging saved lookup
contexts refresh through the existing API, with the original location, input,
selection and district-matching checks preserved. Representatives come from
officeholder data, never from candidate status or an inferred winner. Stale
off-election officeholder cards yield to a directory link until refreshed.

Future rosters require published source data. Incumbency, fundraising filings,
previous primary results and guessed election URLs do not generate candidates.
Actual future-cycle ingestion, review and geographic/publication gates remain
independent of this presentation layer.
