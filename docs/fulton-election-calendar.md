# Fulton election calendar

The calendar collector follows the explicitly year-labeled link on the county's
[elections index](https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections)
to its rolling [key-dates publication](https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections/Election-Key-Dates).
The published year and election heading must agree. Later actually offered
editions reuse the same configuration, parser and external storage.

`FULTON_ELECTION_CALENDAR_DIRECTORY` optionally connects the same external store
to authenticated Operations, Datasets and Exceptions. Inspection reads stored
evidence without collecting, creating directories, changing source clocks or
publishing deadlines. Calendar events stay separate from candidate records and
deadline imports. Review detail retains the printed conflicting date and its
election context, with a link to the official calendar. Missing, invalid, failed
and overdue collection evidence remain distinct from a validated current source.
An unconfigured directory adds no calendar section. The optional store is
declared in the versioned runtime contract; host activation remains separate.

```sh
node back-end/dist/manage-fulton-election-calendar.js collect /absolute/external/calendar
node back-end/dist/manage-fulton-election-calendar.js prepare /absolute/external/calendar capture.json
node back-end/dist/manage-fulton-election-calendar.js export /absolute/external/calendar
node back-end/dist/manage-fulton-election-calendar.js csv /absolute/external/calendar
```

`collect` checks the existing reviewed county robots and privacy fingerprints
before requesting the index or calendar. It uses normal bounded native HTTPS,
eleven-second request spacing, a six-hour refresh/retry floor and process-held
ownership shared with `prepare`. Interrupted processes release ownership while
their durable journal preserves the retry floor. Fresh captures return from
external storage with zero publisher requests and unchanged source clocks.

`prepare` validates an existing four-document capture with its original times
and hashes. Both paths retain immutable source captures, the current envelope
and exact previous envelope. Reads revalidate source policies, publication
identity and every derived event. Collection journals contain bounded status
and error categories. Archives stop at 256 entries or 128 MiB for retention
review. Readers and writers refuse redirected or nonregular data files.

The inventory preserves General Election and General Runoff sections separately,
with date-only events, audit ranges and postmark conditions. A conflicting
printed weekday preserves its literal wording and withholds normalized dates.
Unfamiliar labels/layouts, changed policies and disappearance of retained
unexpired events preserve the previous inventory for review. Valid later-cycle
rollovers retain the historical capture without guessing dates or annual URLs.
Explicit November runoff dates are accepted alongside December dates, with the
runoff strictly later than its general election. The county's
[turnout archive](https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/early-voting-turnout-information)
lists a November 30, 2021 municipal runoff. Controlled future-year fixtures verify
that date-layout case without asserting a future election or calculating one
from a statutory interval.

The November 13, 2026 capture contains fourteen general-election events and
eleven runoff-calendar events. The runoff equipment-testing row prints
"Monday, November 11"; that date is a Wednesday in 2026. Its normalized date
remains empty. Capture time is distinct from a publisher-issued timestamp,
which the page does not establish.

This output is a review inventory with `publicationApproved:false` and
`electionOccurrenceConfirmed:false`. A runoff calendar does not establish that
a runoff will occur. Date-only rows supply no poll-closing hour. Existing
substantive review, published-guide, geographic applicability and recurring
host-activation gates remain separate. The public API and voter deadlines
continue using the existing reviewed stores; exporting this inventory does not
publish or import deadline changes.
