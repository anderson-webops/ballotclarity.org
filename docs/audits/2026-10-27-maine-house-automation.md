# Maine House candidate collection

## Source and scope

The [House Clerk's candidate list](https://mainelegislature.org/house/Documents/CandidateList)
contains 276 candidate references for the 133rd Legislature, covering all 151
House districts. Its five party labels, residences and 95 incumbency markers
reconcile with every posted candidate row. Names remain in the publisher's
ordering. Residence municipalities remain evidence, not voter jurisdictions.
The Clerk explicitly calls the list unofficial and compiled from multiple
sources. No certification, personal eligibility, judicial choice, Senate race,
federal race or election outcome is inferred.

`me-house-clerk-2026` exposes these references as unofficial candidate records.
The source-specific ballot-preview exclusion is intrinsic, including future
cycles and callers that remove the configuration flag. Existing Maine town
ballots and their 63 records remain independent.

## Election context

The candidate page names a legislature rather than an election date. Context
uses the reviewed 133rd Legislature/2026 anchor and the
[Maine Constitution](https://mainelegislature.org/ros/LawsOfMaine/App/views/constitution.html),
Article II, Section 4, which establishes the biennial November schedule.
Future dates are calculated from that rule as the published legislature number
advances. They are not described as dates printed on the candidate page or as
evidence of ballot qualification. The exact constitutional document is bound
to its reviewed fingerprint. A changed rule or document requires review rather
than silently continuing the mapping. Future examples are synthetic tests,
not assertions that those candidate lists have been published.

## Collection and freshness

Seven ordinary, bounded, spaced HTTPS requests check canonical robots, the
legislature and House homepages, the linked policy hub, the
[legislative disclaimer](https://mainelegislature.org/lio/legislative-information-office-disclaimer/31),
the constitution and the candidate page. Each response retains its actual
retrieval time and byte digest. No scripts, styles, photos or other rendering
assets are downloaded or republished. Only candidate facts and provenance enter
the normalized data packet.

Two independently retrieved pages preserve identical candidate facts while
their displayed last-updated clock advances with the requests. That clock is
excluded from publication-date fields. Semantic content fingerprints preserve
idempotency despite such header changes. Accepted-person loss, changed policies,
unknown layouts, contradictory counts or party labels, hidden meaningful text,
active candidate markup and older accepted captures fail closed. Public readers
use durable snapshots without collection requests. Source delivery, recurring
host collection, private-data receipt and public activation remain distinct.

## Other source leads

- Allegheny County's canonical robots request still returns 403. Its workbook
  remains uncollected; the linked reuse policy also merits review for the
  intended use. This is not an alternative route around Pennsylvania's portal.
- Alabama's robots, homepage and accessibility page return 200. The linked
  policy host still resets the normal HTTPS request, so candidate collection
  remains held. Existing certifications remain unchanged.
- Wayne County, Indiana, permits the inspected public paths and publishes its
  own disclaimer. Its candidate page lists identical names and parties beneath
  both State Comptroller and Auditor of State headings. That unresolved office
  overlap is retained as a lead rather than published as two verified races.
  The statewide portal's separate reuse hold remains unchanged.
- Maine's statewide robots endpoint returns 403. The independent legislative
  publisher does not grant access to that endpoint or the earlier blocked state
  workbooks. No alternate host, identity or access challenge is used to retrieve
  them.
