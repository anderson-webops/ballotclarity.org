# Vermont: South Burlington general-election sample ballots

## Source and access

The [official city election index](https://www.southburlingtonvt.gov/211/Elections-Voting)
links five November 3, 2026 sample ballots, in index order CHITTENDEN-10, -11,
-12, -8 and -9. Each is two pages and explicitly identifies the general election.
All ten original pages were visually reviewed, not treated as current based on
search snippets or a PDF filename alone.

Normal anonymous requests returned HTTP 200 PDFs under ordinary TLS verification.
The city's published ten-second crawl delay was honored with 10.5-second spacing.
The election index and DocumentCenter paths are not disallowed. No authentication,
challenge, user-agent impersonation, alternate restricted state host or TLS override
was used. The city copyright page has no explicit extraction prohibition; retained
application data is public ballot facts, not site design or marketing material.
The separate Vermont state candidate page's earlier HTTP 403 is not bypassed.

| House ballot | Captured October 21, 2026 UTC | Original bytes | SHA-256 |
| --- | --- | ---: | --- |
| CHITTENDEN-10 | 14:50:41.754 | 169,945 | `a0643713c6dbbb8be50d92431fdccea15feee553eea99566a1908f80e8492fbc` |
| CHITTENDEN-11 | 14:50:52.554 | 169,868 | `67da974dd09f56946acfefdebd9e587ab4b62611c1b7ade284cd395272b1d84f` |
| CHITTENDEN-12 | 14:51:03.366 | 169,641 | `622ef9d117af79a153a430515141b87c575b306c4b4e61473b192a1918d37267` |
| CHITTENDEN-8 | 14:51:14.172 | 170,408 | `dddb35ed59a51caedaee09b46bb90424e784f9591f4b1781ce96ce511275a411` |
| CHITTENDEN-9 | 14:51:24.982 | 169,877 | `0b2530766e4755ea8290bc2afd51c4f595ae365a9cc26df6a37845a38b969188` |

## Reconciliation and scope

All 266 printed named-candidate rows match a manually reviewed transcription,
native raw text and independent bounding-box name/party rows. District 8 has
54 named rows; each other ballot has 53. Blank write-in spaces are excluded.
The 208 repeated claims across ballot variants link to the same record identities,
leaving 58 candidate/contest records in 19 contests. Contributions to the unique
record set in source-index order are 53, 1, 1, 2 and 1.

- 23 statewide candidates in seven contests, including at-large U.S. House.
- Six House candidates across five named CHITTENDEN districts.
- Six Senate candidates without a printed Senate district name.
- 23 local candidates in six contests, including fourteen city justices of the peace.

The [official U.S. House directory](https://www.house.gov/representatives) confirms
Vermont's at-large geography; incumbent identity is not ballot-qualification
evidence. Candidate facts come from the sample ballots. The separate governor and
lieutenant governor sections are not paired into invented tickets. `DEM/PROG`
and `DEM/REP` remain literal printed party labels, not inferred membership or
multiple independently printed endorsement claims. Single-candidate offices are
not labeled elected or unopposed. Printed maximum selections of one, two, three
and fifteen remain in the claim companion rather than being inferred from counts.

Original pixels resolve omitted extraction spaces in RYAN P. WALTON, MOLLY GRAY,
LYNN LAFLEUR, T.J. DONOVAN, MICHEL ST. GERMAIN and LYNN VERA. Printed nicknames,
initials and other spellings are retained. Candidate residential city labels,
personal contacts, inferred campaign sites and candidate biographies are not
manufactured or copied into the application data.

House labels remain full `CHITTENDEN-N` names. They do not match bare Census
district numbers. Senate records have an empty district because these ballots
do not identify the Senate district. Local records are never assigned using a
House, ward, county or generic numeric match. ZIP-only previews therefore contain
23 statewide candidates in seven contests. An exact named CHITTENDEN-8 fixture
adds its two House candidates, not Senate or local records. This is partial
Vermont coverage, not a complete personal ballot or statewide district inventory.

## External data and measures

`vt-south-burlington-2026` is `manual-snapshot`, `reviewed-pdf` and
`snapshotStorage: external`. It requires the existing validated external import;
missing or invalid data fails closed. No source-specific bulk payload, new
dependency, PDF parser, automatic crawl or bundled fallback is added to Git or
the immutable runtime artifact.

`back-end/data/state-ballots/` contains the snapshot, candidate JSONL, all 266
linked printed claims, two proposal questions, provenance manifest, checksum list
and exact five-file data archive. These are Git-ignored application data and
require a separate backup before removing the checkout. New York's existing
six-file transfer set and checksums are preserved byte-for-byte.

The measure companion preserves Proposals 3 and 4, their exact question text,
YES/NO choices and source fingerprints. All five variants contain identical
questions. Both print Article 23, which is retained rather than silently
corrected. No legal interpretation, enacted-status claim or application measure
integration is implied. Complete local mapping, other Vermont districts,
candidate profiles/news and later ballot changes remain unfinished.

## Verification

Nineteen focused source/storage tests pass, including Vermont's external-only
boundary, complete five-document provenance, at-large Congress, literal party
labels, separate governor/LG offices and negative numeric/Senate/local matches.
Current source validation passes lint without warnings, typechecks, 594 unit
tests with two existing optional PostgreSQL skips, both builds with 78 compiled
back-end modules and fifteen native-binding entries.

The actual five-file archive unpacks and imports through the compiled command.
Restart/export returns the exact candidate JSONL bytes and original document
fingerprints without a publisher request. A missing import fails closed; automatic
refresh is refused. ZIP fixtures expose 23 candidates in seven contests; the
exact named CHITTENDEN-8 fixture exposes 25 in eight. These controlled geography
fixtures verify application wiring, not independently verified Census eligibility.
All 266 companion claims retain their source page, row, printed party label,
vote-for maximum and canonical candidate identity.

All six package input/archive hashes and six pre-existing New York files are
verified. The four intentional prior-path changes reverse in memory to their
exact starting hashes; 114 other dirty paths across both checkouts are byte-exact.
Five package/lockfiles, staging, heads and all four worktrees are unchanged.
Only the Vermont synthetic tests and audit are new canonical source paths.

The first unit attempt lacked sandbox loopback access and failed `EPERM`.
The supported command-scoped local-test approval passed without changing saved
configuration or permissions. An initial compiled test placed active storage
inside the checkout and was correctly refused; the final test uses an isolated
outside-checkout temporary directory. No application safety gate was weakened.

A preliminary 18-case rendering/accessibility review passed. Visual review then
removed unnecessary implementation commentary from the new source notice,
retaining only the House coverage limit. The factual payload and printed claims
are unchanged; the export/package hashes are refreshed to bind the shorter notice.
A later attempt overlapped integration tests that rebuild the same preview
output, producing a missing red-date style and an unrelated incomplete
representative render. These failures are retained and are not accepted as
passing. The final sequential run passes all 21 integrated smoke tests and all
18 actual-source rendering/accessibility cases: missing-import, imported ZIP
and imported named-House contexts at 320, 390 and 1280 pixels in light/dark modes.
Every eligible candidate, printed party label, source date and coverage notice
renders correctly; active-location cookie restore, red election dates and local
scope suppression pass without overflow, browser errors or accessibility findings.
The review receipt and image timestamps distinguish these final results from
older screenshots. Five final desktop/narrow/missing/imported images were visually
reviewed after the copy change.

Independent local Gitleaks scans of all 117 dirty canonical paths and eleven
external factual/checksum inputs examined about 29 MB without findings. The
transfer archive contains exactly the five hashed reviewed inputs; no original
PDF or unrelated local data is included. No external source upload was performed,
and an unavailable external GitGuardian scan is not described as passing.

No hosted import, configuration, scheduler, permission, service, source
publication or deployment is performed. The nationwide goal remains active.
