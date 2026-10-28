# Safari navigation and hydration

## Separate failure modes

The served v1.14.54 election-to-location transition reproducibly stopped
responding in Safari. A native process sample recorded a 10.8 GiB physical
footprint and repeated JavaScript microtasks, JSON serialization and browser
storage writes. A bounded console probe also captured repeated civic-store
persistence. The process was contained before attempting to reproduce the
reader-reported 65 GB exhaustion.

The already published v1.14.55/v1.14.56 source replaces self-tracking page
effects with explicit data watchers. A local comparison using the exact
v1.14.56 frontend and read-only public API responses remained responsive
through repeated election/location navigation. After five minutes its heartbeat
still advanced, with five civic-store writes rather than an unbounded write
loop. This source comparison is not evidence of protected host activation.

## Timestamp hydration mismatch

A direct location-page reload still produced a separate hydration warning in
Safari with v1.14.56. Development-mode inspection identified this exact text
difference in the update timestamp:

```text
rendered on server: " Updated Apr 24, 2026, 8:00 AM"
expected on client: " Updated Apr 24, 2026 at 8:00 AM"
```

The production console only exposed the generic message
`Hydration completed but contains mismatches.` Both engines had the correct
date, clock time and time zone. Their English date/time separator differed.
It was not necessary to reset browser storage, change time zones or alter
hydration lifecycle hooks to address this discrepancy.

`formatCivicDateTime` now obtains locale-aware calendar and clock fields with
`Intl.DateTimeFormat.formatToParts`, explicitly selects a twelve-hour clock,
and joins those fields with consistent punctuation. Offset-aware timestamps
still convert to the reader's zone; offset-free reporting timestamps retain
their stated calendar fields. Date-only formatting is unchanged.

The regression fixture substitutes different Intl literal tokens. It retains
the original failing output and verifies that platform-specific punctuation
cannot alter the final timestamp. A browser regression also checks direct
guide loads with retained context, bounded persistence and a responsive
JavaScript heartbeat. Safari reload verification is separate from the
Chromium automated coverage, which did not reproduce the original separator
difference.
