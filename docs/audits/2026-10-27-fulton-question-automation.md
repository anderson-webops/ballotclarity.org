# Fulton County ballot-question collection

The existing Fulton collector now retains ballot questions alongside candidate
records instead of skipping their text. Actual dated publications drive future
general-election discovery; question titles and resolution numbers are read from
the publication, not a fixed 2026 list.

## Current source evidence

An October 27 normal, policy-bound collection made eight paced requests and
retained all 98 existing candidate records plus seven questions from the county's
[consolidated sample](https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/sample-ballots).
The five-page PDF remains 181,020 bytes, SHA-256
`e1b4186e5f8c0ff8188cc4175fe18c0a18fa6bfb158fca08cb3da190793dd60d`,
captured at `2026-10-27T21:34:08.743Z`. The separate county write-in PDF remains
156,171 bytes, SHA-256
`a6a7ed428a8d44f973c6c30d9c6baf1f1731ae03f7cf164fc772b611a90443bd`,
captured at `2026-10-27T21:34:19.758Z`. Both match the preceding retained originals.
The maintained bounded Poppler worker performed the actual extraction.

The question inventory includes transportation, Sandy Springs redevelopment,
Palmetto's city tax exemption, education sales tax and the three constitutional
questions. Page references, literal wording and Yes/No choices are retained.
The transportation question's exclusion of Atlanta, Palmetto's stated year and
city-only exemption, and the education question's distinct tax/debt amounts
remain source text rather than broadened eligibility or fiscal claims. Printed
wording such as `new 10 and replacement schools` is not silently corrected.

## Import and review boundaries

Question inventories persist outside the checkout through the existing snapshot
and cycle import path. They are not published measure dossiers, reader advice or
an address-matched ballot. Every question retains
`voterApplicabilityVerified: false`. The already prepared state, city and county
measure drafts retain their independent acceptance and publication workflow;
the transportation geography hold remains open.

Existing reviewed and older automatic snapshots remain readable. Added question
inventories require this compatible runtime; restoring an earlier runtime also
requires its exact compatible external-data snapshot. Candidate identities and
document contribution counts remain unchanged.

Malformed headings, choices, columns, partial questions, cross-page continuations,
unexpected metadata and changed or missing previously accepted questions retain
the last good data for review. Failed collection or persistence does not advance
successful import clocks. A future-dated snapshot remains invalid. Synthetic
future-election tests demonstrate parser reuse, not observed future elections.

Local collection, repeated/cold imports and connected API/rendering verification
are source-side evidence. Receiving-host capability, scheduled operation,
publication and production activation remain separate acceptance milestones.
