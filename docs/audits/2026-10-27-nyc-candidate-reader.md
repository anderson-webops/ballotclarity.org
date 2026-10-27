# NYC candidate publication reader

## Scope

The [NYC Board of Elections candidate index](https://www.vote.nyc/page/list-candidates)
offers the November 3, 2026 tentative general-election list as PDF and RTF.
Five ordinary public requests on October 27 confirm unchanged robots rules,
the home/index pages and both offered publications. No linked legal notice was
identified on the inspected home page. This is a factual roster review, not
permission to republish biographies, addresses, logos or other expressive work.

The PDF has 44 physical pages covering New York, Bronx, Kings, Queens and
Richmond. Its printed date is September 11, 2026, not the collection date.
The PDF prints 10:26:11 AM and the RTF prints 10:36:13 AM. Every native text
field reconciles between the two formats after accounting for their printed
clock difference, whitespace and the RTF's nonbreaking hyphen representation.
These normalizations do not replace either original source clock.

Rendered review also identifies a publisher-layout limitation: some long
proposal headings are cut off by their printed heading frame. Native text
and RTF reconciliation do not prove that every extracted character is visible
in the PDF. This distinction remains part of the worker's pending visual gate.

## Implemented

- Bounded native geometry, field/style inventory and complete five-borough
  pagination, including each borough's independently restarted page numbering.
- All 486 candidate/party/office line occurrences produce 256 distinct
  candidate or explicitly printed ticket records. Repeated borough appearances
  and fusion-party lines retain their individual source-page claims.
- Five citywide proposals retain all 25 borough occurrences, official text,
  Yes/No choices and physical PDF page references. Conflicting or incomplete
  repeated proposals require review.
- Explicit seat counts, legislative and regional judicial districts, tentative
  status and the printed publication date remain distinct. A printed number
  to be elected is not silently converted into a voting instruction. Mailing
  addresses are excluded from the resulting facts.
- Discovery follows the actual visible date, heading and offered PDF/RTF
  links. Synthetic 2028 examples verify future-date reuse; filenames and
  publication dates are not guessed. Empty future availability stays empty.

The index's current link accessibility labels still mention the primary
election. Discovery uses the mutually consistent visible heading/link labels
and document election identity, rather than treating that stale attribute as
the election date.

## Remaining integration

This reader is preparation, not an enabled collection family or a claim of
published NYC coverage. The worker still needs bounded font/glyph and visual
verification, source-policy binding, managed capture/import, durable revision
recovery and connected route acceptance. Those gates remain intact. Existing
Monroe County data, the canonical data folder and the current server packet
remain unchanged. Native source files and local reconciliation evidence stay
outside Git and release assets.
