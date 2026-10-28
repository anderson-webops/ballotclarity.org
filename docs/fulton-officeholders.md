# Fulton County current officeholders

The county commission collection is independent of candidate filings and election
cycles. It normalizes office, name, official profile and portrait references from
the county roster, and verifies each district against the county district finder.
An explicitly vacant seat is an office, not a missing person or candidate.

The two official publications currently identify seven commission seats: an
at-large chair, five other occupied seats, and a vacant District 4. This is a
commission-seat inventory, not coverage of every county office. Political party,
election qualification and individual address applicability are not inferred.

## Storage and collection contract

`back-end/dist/manage-fulton-officeholders.js` supports `collect DIRECTORY`,
`import DIRECTORY SNAPSHOT.json`, `export DIRECTORY`, and `csv DIRECTORY`.
The directory is absolute, external writable state, separate from Git and the
immutable runtime artifact. `FULTON_OFFICEHOLDER_DIRECTORY` optionally connects
the API to that retained directory. Unconfigured installations retain their
existing officeholder source; a configured but invalid or missing snapshot
returns a service error rather than a healthy empty board.

Collection has no election year or person-name configuration. It checks approved
robots and linked privacy-policy content before requesting the two publications,
using pinned public DNS/TLS, no redirects, bounded responses and eleven-second
spacing. A six-hour minimum interval applies to refresh and failed retries.
Changed policies, ambiguous layouts, inconsistent names or seat counts require
review. No CAPTCHA, access denial or policy restriction is bypassed.

`fulton-board.json` is an atomic validated envelope. The exact preceding envelope
is retained as `fulton-board.previous.json`; raw collection evidence is retained
under `captures/`. An exclusive collector lock prevents overlapping writes.
Collection/import clocks and source capture clocks remain distinct. A failed
refresh keeps the last-good data and records the failure. A warm repeat does
not contact the publisher or advance successful clocks. Scheduling belongs to
the existing protected automation system; this CLI does not install a scheduler.

Public requests read retained data without contacting the publisher. County
pages show the full commission and explicit vacancies, grouped separately from
available [county offices](fulton-county-officeholders.md). District members have
individual public profiles and district pages. A generic Fulton county location
matches only the at-large chair until trusted commission-district geography is
available. Officeholder records never establish current ballot candidacy.

Operations identifies this source as current officeholders, separately from
candidate and reference collections, with capture, attempt, import and failure
evidence. The initial collection includes official portrait references and
attribution, not copied biographies or a blanket image-reuse license.

## Official publications

- [County commissioners](https://fultoncountyga.gov/commissioners)
- [Commission district finder](https://fultoncountyga.gov/Commission-District-Finder)

The source policy receipts are versioned with the parser. Test fixtures use
fictional people and synthetic markup, including future officeholder changes,
filled vacancies, conflicting sources, policy changes, inaccessible sources,
symlinks, restart reads and competing collectors.
