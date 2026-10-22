# Colorado Blue Book measure review, October 22, 2026

## Scope and provenance

The [2026 Blue Book publication page](https://content.leg.colorado.gov/publications/2026-blue-book)
lists Legislative Council Staff as publisher and September 21, 2026 as the
publication date. It links the
[2026 State Ballot Information Booklet](https://content.leg.colorado.gov/sites/default/files/2026-blue-book-en-accessible.pdf),
Research Publication No. 842, for the November 3, 2026 general election. The
104-page PDF is 2,278,823 bytes, captured at 2026-10-22T15:26:02Z, SHA-256
`137ba55ce1c6880e871d67a077312072686e6aec9a475c387e482d9700164248`.
The capture time is not a publication date.

Both hosts' `robots.txt` files were reviewed; neither restricts the publication
page or `/sites/default/files/`, and neither sets a crawl delay. The PDF was
fetched once, alongside four page and policy requests. Normal HTTPS verification
succeeded with no identity, header or mirror changes. No terms-of-use or reuse
notice was found; the legislature's privacy policy does not address reuse. That
is not treated as a license: apart from the official ballot titles and the
one-sentence vote statements below, no PDF, analysis prose, table, measure text
or image is packaged or committed.

## What the collection contains

`co-blue-book-2026` holds all 14 statewide measures: Amendments 81 to 87,
Proposition NN and Propositions 132 to 137. For each measure:

- the ballot title and the booklet's one-sentence "yes" and "no" statements are
  extracted verbatim from the PDF text, not retyped;
- the summary, explanation, current law, proposed changes, fiscal items,
  arguments and measure interactions are short paraphrases of the analysis,
  with the analysis, arguments, fiscal and text pages recorded for links.

The Blue Book's arguments are written by nonpartisan Legislative Council Staff to
represent each side, not by campaigns. Every argument printed for each measure
is kept, in the booklet's order, so both sides keep their number of points. The
measure page says the arguments are shortened from that staff text.

Paraphrases keep the booklet's qualifiers: estimates stay estimates, "may" stays
"may", and fiscal amounts keep their budget year and scope. The booklet's own
statements of uncertainty (Amendment 87 with Proposition 136, Proposition NN
with Proposition 137, and Proposition 134 with the Colorado Anti-Discrimination
Act) are kept as considerations attributed to the booklet.

Not included: the judicial performance evaluations, the Front Range Passenger
Rail District local measure, organization lists and the Spanish edition.

## Application and operator boundary

Measure references use a separate strict schema (`measure-references`) beside
candidate references. Pages are served at `/measure/co-2026-…` and listed for
Colorado on the records page. They are not part of any saved ballot, so the
ballot-plan control is hidden, and the collection stops being served two days
after the election, like candidate references.

The ignored `back-end/data/state-ballots/` directory holds the reviewed snapshot,
a review JSONL that records which page each field came from, and a manifest:

| File | SHA-256 |
| --- | --- |
| `colorado-blue-book-2026-measures.json` | `0cdc8394ba56016b810e9d5d5560e5a543e6f53f5a768d5e533c13a651db4bee` |
| `colorado-blue-book-2026-review.jsonl` | `8217703961917c05edc2f8f8ccb2e2f9c1ca0b6c53f0067e21e7d6a72cd774f3` |

The snapshot is the only importer input. Production needs a separately approved
transfer, then `manage-election-references.js import-measures` with the accepted
runtime. No production connection, transfer, import, scheduler or configuration
change is made here.
