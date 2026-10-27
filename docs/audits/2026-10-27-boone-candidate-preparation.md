# Boone County native candidate preparation

## Source and scope

The independently published [county election page](https://boonecounty.in.gov/offices/clerk/election-information/)
links a [general-election candidate workbook](https://boonecounty.in.gov/wp-content/uploads/2026/09/2026-General-Election-Candidates-August-13-2026.xlsx).
Its heading describes candidates who have filed, not certified nominees.
Ordinary public-address-pinned HTTPS requests returned the original 28,515-byte
workbook. This preparation retains 86 named filing entries, 47 office/area
contexts and their original worksheet row numbers. One explicit instruction,
`Do not put on ballot`, remains a ballot exclusion, not an inferred withdrawal
reason or active ballot qualification.

`readBooneCandidateDocument` is an offline prerequisite, not a configured source
family or public-data import. It supplies no election date, candidacy status,
personal jurisdiction match or coverage claim. County, township, court, town and
school labels remain separate source contexts. Precinct descriptions and school
area names remain provenance rather than voter assignments. The source's
August 13 filename is not promoted to a verified publication clock.

## Bounded workbook handling

The existing reader rejects the workbook's binary printer settings. The explicit
`boone-candidates` profile permits only the internal
`xl/printerSettings/printerSettings1.bin` role, bounded to 16 KiB, with its exact
reviewed content-type and internal relationship shape. Its bytes are checked for
archive integrity and ignored, never decoded, executed or exported. The default
workbook profile still rejects it. Unknown binaries, macros, encryption, formulas,
entities, corruption and resource overflows remain rejected. The Boone profile
also holds hidden rows/sheets, strikethrough and alternate drawing/conditional
formatting for review.

The native preparer keeps names, office paths, literal party codes, district
labels and explicit ballot instructions. It excludes residential addresses,
contact fields, email links, private workbook metadata and inferred personal
eligibility. Unknown headings, conflicting districts, party codes, columns,
instructions or duplicate entries require review. R, D and I retain their
literal codes alongside Republican, Democratic and Independent labels.

## Collection review and remaining integration

The current county robots document has two wildcard groups. Both are retained
and reviewed; their combined rule excludes an unrelated plugin metadata path,
not the inspected election publications. The captured homepage and election
page offer no separate policy, legal or accessibility link. A generic CAPTCHA
keyword initially matched contact-form error strings, not an access challenge;
the canonical page and its actual title were then independently inspected.
No challenge, script, alternate identity or access-control workaround is used.

The same election page offers a separate vote-center DOCX that explicitly names
November 3, 2026. Its bounded acquisition is research evidence only. Reliable
automatic import still requires a maintained native date/context reader, binding
both actually offered publications and the active general-election year, current
policy checks, durable cycle synchronization, removal/older-source holds and
real-data API/browser acceptance. Future filenames and dates are not guessed.

Existing Indiana records, source configuration, live coverage, the current
server-data ZIP and deployed runtime remain unchanged by this preparatory work.

## Verification boundary

Synthetic tests cover the scoped printer exception, preserved default rejection,
unsafe/oversized metadata, hidden content, native office/area distinctions,
explicit exclusion, private-field omission and changed-source review holds.
The actual workbook is additionally reconciled with independently read original
XML cells and a native Quick Look preview. This establishes preparation, not
current ballot completeness, recurring collection or receiving-host acceptance.
