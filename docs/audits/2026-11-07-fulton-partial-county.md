# Fulton partial-county measure preparation

Native measure preparation supports an explicit `county-area` reference area
with a county and excluded municipalities. This closes the package-model gap
for Fulton's transportation question without assigning that question to Atlanta
or to an entire cross-county city.

The same configuration works with another state, county, exclusion list and
election date. Future-cycle tests change the configured election to 2028;
they establish reusable preparation, not an observed future publication.

## Retained evidence

The new one-measure review draft uses two previously retained county publications:

- [Election notice](https://fultoncountyga.gov/-/media/November-3-Election-notices/Call-for-Election--TSPLOST-Revised-8252026.pdf),
  page 1, 77,305 bytes, SHA-256
  `383b4d147c5a6fdc6c401f85f25c16dd9655a98a35df09cf4e7f89c19cd30429`,
  captured October 27 at `22:28:06.403Z`.
- [County transportation tax overview](https://fultoncountyga.gov/tsplost),
  259,782 bytes, SHA-256
  `d8b802f29e675e651e62f6454b7e6d0d0bfdf66685fc9435350dbbedb99f5f82`,
  captured October 27 at `22:28:17.608Z`.

The notice was visually rechecked against its exact retained PDF. Its question
uses “additional”; the county overview describes renewal at the existing 0.75%
rate. The draft preserves the official question and attributes the renewal
context rather than describing an additional rate increase. The notice supplies
April 1, 2027 through March 31, 2032 and a maximum five-year duration. Its dates
remain proposed implementation dates, with no election outcome inferred.

No new publisher request, inferred publication date or refreshed data-update
clock accompanies this offline derivation. Original capture times and digests
remain pinned. The derived content uses a short factual summary and cited
official ballot wording, rather than republishing the county overview.

## Scope and acceptance

The area label is `Fulton County outside Atlanta, Georgia`. Scope metadata
survives native preparation, guide packages, jurisdiction summaries and APIs.
Draft/plan disagreement, missing exclusions, whole-county relabeling, duplicate
scope aliases and unsupported automatic matching fail closed. Existing
whole-county content and its publication decisions remain unchanged.

The new kind is reference-only. ZIP, postal-city and address lookups leave it
unselected; a separate boundary-aware contract is needed for verified residential
applicability. Older matchers also leave this new jurisdiction kind unmatched.
Normal substantive review, publication, import and compatible runtime/data
rollback acceptance apply independently of package preparation or private receipt.
Offline append preparation combines all seven draft questions while preserving
the existing primary election, jurisdiction, location and three additional
guides exactly. The six earlier questions retain their own scope and review
state; the new area starts with a draft workflow and unknown coverage metadata.

Connected rendering also exposed missing source-directory entries for citations
held only in additional guides. The directory now collects citations from
published candidates, measures and contests. Draft-only sources remain private;
the same publication checks cover directory listings and individual source pages.
Source detail pages omit unknown or invalid dates rather than throwing during
rendering, inventing a publication clock or displaying a missing-date placeholder.
The scoped election heading carries the geographic boundary without repeating
the generic missing-coverage note; editorial coverage metadata and review gates
remain unchanged.
