# Bucks County candidate collection

## Official publication and scope

The [county candidate index](https://www.buckscounty.gov/1221/Running-For-Office)
offers a two-page general-election candidate listing. The retained publication
contains 34 named people representing 31 ballot entries across 15 offices:
three Governor/Lieutenant Governor joint tickets, two congressional candidates,
six state-senate candidates and twenty state-house candidates. Each joint ticket
remains one choice, with both printed names and the printed party preserved.

The [county election notice](https://www.buckscounty.gov/2136/Official-Notice-for-Military-and-Oversea)
explicitly identifies November 3, 2026. Election identity requires agreement
between that notice, the candidate index and the offered document. The PDF's
workbook-title update suffix disagrees with its other metadata; it supplies no
inferred as-of date. Provenance retains the actual acquisition timestamp and
original PDF SHA-256:
`0a0d0f20dd720b2c528009a2a26577767ab7a6aeff9572c5febf32631cbc1135`.

Only factual names, offices, districts and printed party labels become records.
No nomination, qualification, incumbency, unopposed status or ballot order is
inferred. County-wide records do not establish an individual's ballot style.
Address-specific preview matching remains disabled. Pennsylvania's independent
statewide access hold and other counties' holds remain unchanged.

## Native extraction and recurring discovery

The PDF's filled compound rectangle paths define the table's merged office
cells. Bounded native Poppler text and SVG extraction preserves those physical
boundaries, including joint-ticket rows. Every text token must reconcile to a
consumed table cell. Unknown offices, overlapping or incomplete cells, omitted
text and malformed geometry require review rather than text-order guessing.
The shared filled-rule reader accepts only bounded thin orthogonal rectangles;
its default grid behavior and existing resource limits remain intact.

`pa-bucks-2026` uses the rolling index and explicit notice. Later general
elections use `pa-bucks-general-YYYY-MM-DD` after those publications identify the
date. No future document URL is guessed. A future election with no offered
candidate document is pending, not an empty accepted roster. Future fixtures
exercise pending-to-available collection, years without a governor race and
restart; they are not forecasts of actual future ballots.

The publisher's short document URL returned an ordinary 301 to the same host
and the same DocumentCenter ID. Only that one-hop, date-bound canonicalization
is accepted. Cross-host, different-document, unexpected-query, challenge and
other redirect responses stop collection. Acquisition uses the unchanged
public-address-pinned importer, normal TLS, bounded responses and at least
twenty seconds between requests.

## Policy and custody

The [robots file](https://www.buckscounty.gov/robots.txt),
[copyright notice](https://www.buckscounty.gov/copyright) and
[privacy policy](https://www.buckscounty.gov/privacy) were read before collection.
Every applicable wildcard and AI-agent rule is intersected. The rights notice
reserves copyright; this integration normalizes factual candidate data rather
than republishing the PDF or other authored prose as application content.
The privacy policy's substantive region is `mainWrapTS`, not the empty
`contentarea` region.

Reviewed policy bodies, legal links and footer semantics remain fingerprinted.
Only the randomized fragment of the publisher's opaque email-protection links
is normalized for semantic comparison. Contact paths and labels remain checked;
no address is decoded or followed. Original capture bytes and hashes are never
rewritten. New policies, changed terms, access denial and new layouts require
review.

Accepted records persist in the existing external snapshot store, outside Git.
Public reads remain offline. Repeated collection, restart, publisher outages,
missing accepted candidates and missing publications preserve accepted data.
Source validation and packet receipt remain distinct from protected host import,
publication and recurring-schedule activation.
