# Fulton County offices

This year-independent source reads sheriff and district-attorney leadership
cards and their linked profiles, plus the solicitor-general and tax-commissioner
department publications. The independently published Clerk homepage, About page
and offered personal profile now supply the fifth office. Names, roles, official links, available portrait references and
capture evidence are normalized. Deputy staff, promotional biography text,
political party, election qualification and inferred term dates are excluded.
These five offices are not a complete county-office inventory. The solicitor's
role heading must agree with the named banner. The tax commissioner's name must
come from the explicit elected-office statement under the department heading.
Department graphics and seals are not treated as portraits.

## Collection and storage contract

`back-end/dist/manage-fulton-county-officeholders.js` accepts `collect DIRECTORY`,
`import DIRECTORY SNAPSHOT.json`, `export DIRECTORY` and `csv DIRECTORY`.
`FULTON_COUNTY_OFFICEHOLDER_DIRECTORY` optionally connects the API to that external
retained directory. The source remains independent of the commission roster;
either can be configured separately. A configured invalid source returns an
explicit service error rather than a healthy empty record set.

Collection checks the reviewed county robots and privacy policy before visiting
the departments and their offered profile links. Pinned public DNS/TLS,
same-host profile/portrait boundaries, zero redirects, bounded documents and
eleven-second spacing apply. Refreshes and failed retries have a six-hour
minimum interval. Ambiguous leadership, changed policy links, mismatched profile
identities or changed layouts retain last-good state for review. Explicitly
vacant cards produce vacancy records, not fabricated people.

Version 2 captures and snapshots contain all four configured offices. Version 1
two-office captures, snapshots and their original configuration-bound envelopes
remain readable without changing their bytes or clocks. A successful expanded
collection atomically replaces the retained envelope and keeps its exact
predecessor for recovery. A legacy configuration digest cannot authorize a
version 2 inventory. An unavailable new publication retains the last accepted
inventory rather than silently omitting its office.
Imports preserve monotonic source clocks and cannot downgrade an accepted
four-office inventory to two offices. Recovery retains the exact predecessor
alongside its matching runtime contract.

Version 3 adds the Clerk of Superior and Magistrate Courts. Both original
two-office and four-office snapshots and configuration-bound envelopes remain
readable without byte or clock changes. A successful expanded import retains
its exact predecessor. A five-office inventory cannot be downgraded or admitted
under either older configuration fingerprint. Keep the corresponding source
configuration and inventory with the recoverable runtime.

The Clerk site has an independently reviewed, exact robots fingerprint. Both
wildcard and named-AI rules allow these public paths; generic robots review is
unchanged. All substantive linked copyright and legal-disclaimer content remains
checked, with only the paired copyright-range end years normalized. Twenty-second
spacing, the pinned public HTTPS host, zero redirects, document and aggregate
capture bounds apply. The homepage must actually offer the About page, which
must offer exactly one matching Clerk profile. Current leadership statements
must agree, and the profile heading must corroborate that identity. Changes,
incomplete publications, ambiguous names and interrupted-run cooldown preserve
last-good records for intervention.

The existing `collect DIRECTORY` command retains its four-office network scope.
Expanded collection requires explicit `collect DIRECTORY --include-clerk`
selection after separate host/source approval. Importing five-office data does
not opt an existing scheduler into the new host. A stale five-office inventory
requires that explicit scope before any publisher request; it is never silently
downgraded or partially refreshed. This is a one-time source-scope choice, not
an election-year or person-specific edit.

Only the Clerk's name, role and official profile link are published. Promotional
biography, personal contacts, protected photos, party, appointment/election
status, terms and ballot qualification are excluded. The homepage's land-record
Good-Thru date is not a publication date for the officeholder. CSV exports name
their capture clock `retrievedAt`, not `sourceAsOf`; publisher dating remains
unknown where not stated. Existing CSV files remain unchanged.

`fulton-county-offices.json` contains an atomically written, configuration-bound
envelope; its exact predecessor is `fulton-county-offices.previous.json`.
`county-office-captures/` retains source bodies. `county-office-automation/`
records actual attempt, import, success and failure clocks. The exclusive lock,
filenames and journals are distinct from the commission collection, including
when both sources share an external directory. Neither source data nor writable
state belongs in the immutable runtime artifact or Git.

Warm repeats do not contact publishers or advance successful clocks. Public
requests only read validated retained data. Hosting automation owns scheduling
and activation; this command does not install a timer.

## Public scope

The county page combines these records with available commissioners. Profiles
retain office-specific labels, official websites, portrait attribution and
sources. County-level matches can include these countywide offices without
inventing individual commission districts. Other states, municipal districts
and state-only location matches do not acquire Fulton County officials.
Officeholding does not establish current ballot qualification. Portrait URLs
are publisher references, not copied image assets or a blanket reuse license.

- [Sheriff's office](https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Sheriff)
- [District attorney](https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/District-Attorney)
- [Solicitor general](https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Solicitor-General)
- [Tax commissioner](https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Tax-Commissioner)
- [Clerk of Superior and Magistrate Courts](https://www.fultonclerk.org/)

The separate [State Court](audits/2026-10-28-fulton-court-directories.md) and
[Magistrate Court](fulton-magistrate-court.md) directories collect current judges
independently, without treating them as county commissioners, ballot candidates
or a complete judicial roster for the county.
