# Explicit historical reference access

Default reference lookup, public search and personal matching retain the existing
two-day election expiry. A configured future election without retained data does
not fall back to an expired collection.

`GET /api/election-references/STATE` accepts optional `source=COLLECTION_ID` and
`electionDate=YYYY-MM-DD`. Either explicitly selects historical material. Combined
pins must identify the same configured collection/election. Invalid dates,
repeated values, cross-state sources, unsupported dates and conflicting pins
return HTTP 400. A missing retained snapshot stays unavailable; corrupt storage
returns HTTP 503. A repository returning another state, date or source is rejected
rather than overriding the requested selection. Existing provenance validation,
no-store responses and throttling apply to both current and historical reads.

`GET /api/election-references/STATE/catalog` lists only dates with at least one
validated, populated reference snapshot. It does not enumerate missing sources
as available information. Dates are discovered from existing configured sources
and imported storage; no publisher request or native converter runs in a reader.
Each date needs only one verified stored snapshot for discovery, without loading
all historical records into memory. Snapshot reads use their verified file size
within the unchanged twelve-MiB limit, rejecting symbolic links and detected size drift.

Directory reuses its existing Election control, grouping retained reference dates
under Profiles. `referenceElection=YYYY-MM-DD` selects profiles only and suppresses
the unrelated default official-record request. Selecting an official historical
source also binds accompanying profile information to that source's election
date. State changes and Current election clear historical profile selection.
Pagination preserves explicit selection. Invalid selections remain errors rather
than silently becoming current lookups.

Reference detail links bind their collection ID, keeping reloads/deep links
readable after expiry. An explicitly selected historical official record can
attach background only from its own election. These reads preserve the original
source dates and attribution and assert no new candidacy, current officeholding,
qualification, election outcome or personal applicability.

Catalogs and dates reflect retained source metadata, not evidence that every
candidate or jurisdiction is covered. Existing access/rights restrictions,
publication approvals and protected import/scheduling gates remain unchanged.
