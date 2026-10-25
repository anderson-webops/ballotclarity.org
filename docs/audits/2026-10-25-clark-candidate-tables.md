# Clark County candidate-table preparation

## Source and evidence

The county's [current election index](https://www.clarkcountynv.gov/government/departments/elections/26g-info)
offers the ten-page [candidate table](https://www.clarkcountynv.gov/adobe/assets/urn:aaid:aem:1db09a57-4c1b-47e1-94d9-e7782c442571/original/as/officesup-26g.pdf).
Its [elections landing page](https://www.clarkcountynv.gov/government/departments/elections/)
independently offers the thirteen-page [fall newsletter](https://www.clarkcountynv.gov/adobe/assets/urn:aaid:aem:228bc80b-da3b-42da-bc72-25cce75470d1/original/as/cced-newsletter-fall2026.pdf).
Fresh normal HTTPS downloads on October 25 match the previously reviewed originals:

| Publication | SHA-256 | Candidate panels | Named rows |
| --- | --- | --- | ---: |
| Candidate table | `f9e256f97332833676ec2362fb0e80aaf16497dc568f067e616b86df52e353e6` | 1–10 | 254 |
| Fall newsletter | `0e6d08a0a23adedb782d03af33f0466d815f6c5ec63d1c581a4e72741fe777d2` | 3–11 | 254 |

Every ordered first/last name, political label, printed office, term and section
reconciles independently across the two publications. All 254 names also match
the acknowledged reviewed dataset. The two copies are 508 printed claims, not
508 people. Eight distinct `None of these candidates` options remain separate
from people and retain their printed offices.

## Reader behavior

`state-ballot-clark-tables.ts` reads complete physical rows from bounded PDF
geometry. Header and name-column identity, contiguous panels, page dimensions,
party codes, term text, section labels and cross-publication agreement are
checked. Missing name/party cells and unfamiliar or inconsistent fields require
review instead of producing partial facts. Printed city and township context,
vote instructions and unexpired terms remain source text, not inferred voter
eligibility or a recommendation.

The shared geometry worker now has a separate table reader for opaque black
filled rules used by Excel-produced PDFs. Thin rules must form axis-aligned
rectangles; large backgrounds, other colors, invisible rules, unsupported
transforms and excessive geometry are not accepted as table borders. Existing
Connecticut grid callers retain their prior strict stroke-only interpretation.
Process, byte, page, path, operation and document-time bounds remain unchanged.

The independent newsletter comparison caught an early prototype omitting eight
names because its minimum filled-rule length excluded short contest borders.
The corrected reader retains those actual borders and all 508 claims. Regression
tests include the affected short rows, not just aggregate counts.

## Current integration boundary

This is a reusable extraction component, not an enabled automatic Nevada source.
The existing `nv-clark-2026` reviewed snapshot, 254 IDs and public behavior remain
unchanged. Candidate normalization, actual current/future election discovery,
durable source migration, collection receipts and unattended import acceptance
still need integration before this source can run automatically.

The county's current robots, policy links and full privacy/use notices match
the earlier access review. Downloads preserve at least eleven-second spacing,
validating pinned HTTPS and zero redirects. Only factual table data is retained
in source fixtures; original PDFs and newsletter graphics remain outside Git.
The [county policy](https://www.clarkcountynv.gov/government/privacy-policy)
prohibits mining that degrades access and reserves intellectual-property rights;
this is not a blanket republication license.

Alabama remains an independent hold. Its public election index is readable,
but the actually linked statewide policy host again reset a normal HTTPS robots
request on October 25. The acknowledged 300 Alabama records are preserved, with
no new certification-PDF acquisition or automatic Alabama family enabled.
