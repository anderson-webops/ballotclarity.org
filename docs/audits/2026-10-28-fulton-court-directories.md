# Fulton court directories

The State Court's public [judiciary roster](https://fultonstate.org/judiciary/)
provides twelve judge cards and official profiles. The independently rendered
primary navigation agrees with their identities and chief-judge designation.
The collector corroborates every name and division against its offered profile.
Names, roles, divisions and official URLs are the only imported personal fields.
Biographies, staff contacts, protected images, logos and court documents are
excluded. These current office records do not establish election candidacy,
party affiliation, term dates or voter-specific ballot eligibility.

## Reusable collection

`courtDirectoryPublication` in `back-end/src/court-directories.ts` owns the source,
policy fingerprints, byte limit and refresh interval. People and election years
are discovered from the publication, not configured in code. The optional
`COURT_DIRECTORY_DATA_DIR` points to managed local storage outside the runtime
artifact. The compiled `manage-court-directory.js` supports `collect DIRECTORY`,
`import DIRECTORY SNAPSHOT.json` and offline `export DIRECTORY`.

Collection checks the exact robots body and the named main region of all three
offered policy pages before roster access. The reviewed notices contain no
automated-access prohibition for these public URLs. That finding is not a
license for protected expression or an assurance of complete legal compliance.
Changed policy text, policy-link inventories, navigation/card disagreement,
duplicates, changed identity fields or profile discrepancies require review.
Only the named HTTPS host is permitted, with verified TLS, public-address checks,
bounded responses, no redirects and eleven-second request spacing.

Collection and import share an exclusive local lock. Six-hour freshness and
failure/interrupted-run backoff bound publisher traffic. Atomic private files
retain the exact accepted predecessor; failures preserve the last accepted
records. Per-document clocks and configuration identity are validated on reads
and imports. Public API reads never contact the publisher. A refreshed local
snapshot is visible without restarting the API. Collection failures and
freshness appear under admin Operations independently of county-office sources.

The county page links to `/courts/fulton-state` only when the local snapshot is
valid. It shows a dedicated, division-grouped directory rather than mixing judges
into the county commission, representative list or ballot candidates. Each judge
has one link to the official profile. `/api/courts` and `/api/courts/fulton-state`
distinguish unconfigured data from an unavailable configured dependency.

## Other Fulton sources

- The Superior Court's offered judge roster returned HTTP 202 with an empty
  response in native collection. Cached search snippets are not accepted data.
- The Probate Court's offered privacy URL returned HTTP 404. Automated
  integration remains held pending a complete policy review.
- The Magistrate Court's active judge page and separate chief page are
  accessible. Its staff directory has a different inventory; staff listings
  are not substituted for current judge cards. Integration remains separate
  work, with appointed judges distinguished from ballot candidates.
- The Clerk's public legal disclaimer is accessible. Its current identity and
  document layout remain a separate integration task.

## National scope

The current registry has 48 reusable election families spanning 39 states and DC.
These are discovery/collection capabilities, not claims of complete ballots or
future election certification. Eleven states lack reusable family discovery:
Alabama, Alaska, Colorado, Hawaii, Louisiana, Massachusetts, Minnesota,
New Mexico, Oklahoma, Pennsylvania and West Virginia. Existing reviewed or
single-cycle sources remain available where supported. Publisher restrictions,
TLS failures and access challenges retain their existing holds. This court
directory does not change that denominator or replace statewide ballot work.
