# Fulton County Magistrate Court

The official [judge roster](https://www.magistratefulton.org/157/Judges)
provides 22 named judge cards and publisher-linked directory profiles. The
[chief's page](https://www.magistratefulton.org/223/Chief-Magistrate-Judge) and
court homepage separately agree on the chief magistrate's name and role.
These 23 office records are independent of the State Court directory, county
commission and election candidate records. They establish neither ballot
candidacy, elected versus appointed status, term dates nor a complete county
judicial inventory.

## Reusable source

`magistrateCourtPublication` owns the year-independent publications, policy
fingerprints, byte bounds and refresh intervals. Names and actual offered
profile IDs come from the roster, not code or election-year guesses. Every
profile must agree with the roster and explicitly belong to the Judges
department. A shortened heading is accepted only when its opening biography
explicitly supplies the full roster name; conflicting names or suffixes require
review. Original spellings remain intact. Biographies, personal contacts,
photographs and inferred political or election attributes are not published.

The current profiles redirect to a same-host public mobile directory. The
collector admits only the observed one-hop 302 mapping from an offered EID to
that identical EID. Different identities, hosts, methods, protocols, additional
redirects and access failures stop collection. No user-agent substitution,
certificate exception or access-control workaround is used.

The generic election robots parser correctly stopped for multi-agent review.
The independently reviewed exact robots body allows these paths under both its
wildcard and named AI groups. Its disallowed administrative, search, alert and
other paths remain outside the collection. Exact robots changes require review;
the generic parser is unchanged. Every request uses verified HTTPS, pinned public
addresses, one host, bounded responses and twenty-second spacing.

The linked copyright notice is checked in its main content region, together
with the complete policy-link inventory on publications and profiles. Only its
two printed copyright-range end years are normalized; substantive text, rights
conditions, additional notices and unexpected future dates require review.
The notice reserves rights. This is factual identity extraction, not a grant to
republish biographies or photographs. Original capture bodies stay private and
outside Git and runtime artifacts.

## Retained data

`back-end/dist/manage-magistrate-court.js` supports `collect DIRECTORY`,
`prepare CAPTURE.json`, `import DIRECTORY SNAPSHOT.json` and `export DIRECTORY`.
The optional `MAGISTRATE_COURT_DATA_DIR` connects public readers to external
retained data. It is independent of `COURT_DIRECTORY_DATA_DIR`; both can use
the same external folder because their files, locks and journals differ.
The runtime artifact contract explicitly requires the compiled collector and
management modules and declares both court directories as optional retained
state. Adoption of that additive contract remains part of protected acceptance.

`ga-fulton-magistrate-court.json` is configuration-bound; its exact predecessor
is `ga-fulton-magistrate-court.previous.json`. Collection and import share an
exclusive lock. Atomic replacement preserves the last accepted bytes on source,
policy, identity and persistence failures. Six-hour freshness and failed or
interrupted-run backoff bound routine requests. Older evidence cannot replace a
newer accepted snapshot. A configured invalid source is unavailable, not a
healthy empty record set. Public requests never contact publishers.

The county page links to `/courts/fulton-magistrate` only when retained data is
valid. The dedicated page separates the chief and other judges, without
fabricated divisions, empty sections or ballot labels. The legacy State Court
API and stored data remain unchanged. Admin Operations reports this source's
actual records, freshness, attempt/import clocks and failures independently.
Host scheduling, substantive cohort adoption, publication and protected runtime
activation retain their existing separate approval and recovery boundaries.
