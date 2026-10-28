# Fulton County sheriff and district attorney

This year-independent source reads the current leadership cards on the two
official department pages and corroborates each person's identity against the
linked official profile. Names, roles, profile links, portrait references and
capture evidence are normalized. Deputy staff, promotional biography text,
political party, election qualification and inferred term dates are excluded.
These two offices are not a complete county-office inventory.

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
