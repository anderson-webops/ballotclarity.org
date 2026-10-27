# Goffstown election discovery preparation

## Verified publication

The town's [elections page](https://www.goffstownnh.gov/325/Elections) explicitly
offers its November 3, 2026 general-election sample separately from September's
party primaries and March's town/school election. Ordinary public-address-pinned
requests retrieved the index, robots and linked notices on October 27, 2026.
The offered [two-page sample](https://www.goffstownnh.gov/DocumentCenter/View/6157/Goffstown-SAMPLE-BALLOT---State-General-Election-110326-PDF)
is 60,787 bytes with SHA-256
`740d817ffcffe002814ddf75f58301d107d3c9845045346eaf6cb4a454e33996`,
identical to the original retained for the earlier three-town review. One preceding
download attempt failed the response-contract check without retained response
metadata; its cause is unresolved. A subsequent identical request returned HTTP
200 and the exact accepted PDF, without a changed identity, alternate host or
redirect workaround.

The reviewed robots groups permit the tested election, notice and document paths.
The wildcard group requests a ten-second delay; the named AI group additionally
excludes expensive calendar, news, search and similar routes. Discovery uses an
eleven-second delay, the exact reviewed robots fingerprint and a fixed five-page
request inventory. Changed rules, redirects, denials and TLS failures halt it.
The linked [copyright notice](https://www.goffstownnh.gov/copyright) reserves
rights. The [privacy notice](https://www.goffstownnh.gov/privacy) and
[accessibility statement](https://www.goffstownnh.gov/accessibility) contain no
additional automated-collection authorization. Discovery does not establish a
blanket license to republish statements, artwork or complete pamphlets. No new
public election content is imported by this change.

## Reusable discovery

`state-ballot-goffstown-discovery.ts` recognizes the explicit November heading,
validates its Tuesday/even-year date, and accepts only the document actually
offered under that heading with the same date in its label and canonical URL.
Document identifiers are discovered, not generated. Primary and town publications
are separate. Missing publications remain empty discovery, not an accepted empty
roster. Duplicate dates, additional document roles, ambiguous headings, query
variants and changed legal inventories require review.

The retained capture includes original index and policy bodies, hashes and
timestamps. Reading it revalidates every body and notice. Annual copyright-year
increments normalize within the observed year while changes to rights, ownership,
policy links and future-dated notices remain held. Synthetic 2028 controls test
rollover; they do not assert that a future ballot or candidate exists.

## Import boundary

Both original pages were visually reviewed against the same accepted PDF bytes.
The native text correctly exposes candidate names but misencodes some visible
quotation marks as `<` and `=`. A readable text layer alone is insufficient
evidence for unattended candidate or question ingestion. Its three embedded CID
TrueType subsets need source-specific mapping and visible-glyph validation.

The existing reviewed sample has 35 candidate/office records before shared
three-town deduplication, including one candidate printed in both major-party
columns. Its two questions concern the probate-office amendment and Goffstown
school tax-growth limit. County-named House districts, multi-seat limits, party
columns and uncertain personal applicability remain distinct. No district number,
nominee, winner or personal ballot assignment is inferred.

This preparation is intentionally not registered in the runtime source-family
catalog. It adds no automatic imports, canonical data, scheduled jobs or claimed
coverage. The reusable family count remains 40. All 76 existing three-town New
Hampshire records and the current private data-transfer packet are preserved.
Native parsing, capture fidelity, durable import and connected acceptance remain
the next integration boundary. The state SOS access hold and the independent
Bristol/Alton fidelity holds remain unchanged.
