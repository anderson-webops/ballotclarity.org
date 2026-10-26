# Cassia County ballot automation

The county's [sample-ballot index](https://www.cassia.gov/sample-ballots) offers
one general sample and two supporting school/fire samples. Bounded word geometry
reconciles all 39 existing candidate records, identifiers and factual fields in
nineteen offices: 22 statewide, five congressional, two Senate, two House and
eight local. The original reviewed packet remains unchanged.

The parser validates the printed election date, three candidate columns, office
sections and vote-for-one instructions. House seats A/B remain distinct. Literal
party codes, county terms, the single former-name annotation and the named local
magistrate retention question remain intact. Blank write-in spaces, Yes/No and
question options are not candidates. No party, nomination, election outcome,
joint ticket or personal ballot eligibility is inferred.

All four PDF pages remain accounted for. Ten question occurrences represent six
distinct questions, including a six-choice advisory question. Repeated statewide
questions must agree across the general and fire samples. Supporting documents
retain their hashes, capture times and zero candidate contributions. This is
question evidence, not approval to publish interpreted native measure pages.

## Reusable collection

`id-cassia-2026` supports the existing automatic cycle/import configuration.
Explicit dated index headings and actual offered PDF links determine each
election and its complete publication set. No annual PDF path is guessed.
Changed links invalidate cached imports. The same URLs are reacquired after
the normal freshness interval, so in-place document updates are not frozen.
An explicitly pending future publication can become available without changing
the source definition. An accepted unexpired publication disappearing requires
review. Future examples are synthetic, not future candidate evidence.

The full reviewed [robots policy](https://www.cassia.gov/robots.txt), linked
[accessibility statement](https://www.cassia.gov/accessibility-statement/) and
homepage/index legal-link and footer inventories are checked before collection.
Requests are serial, bounded, normal verified HTTPS with no redirects. The
voter-record portal is not followed. The separate Idaho state-source hold remains
effective. New policy, office, geometry or publication formats require review;
this county adapter is not statewide coverage or a blanket republication license.

The optional bounded PDF text worker is needed for collection only. Accepted
facts remain externally stored and readable without network or converter access.
Reviewed legacy snapshots remain readable; an approved automatic replacement
first preserves their exact original storage envelope in a recoverable backup.
Failed acquisition or persistence preserves the previous durable records.
Explicit source allowlists, host authorization and publication/recovery gates
remain unchanged. Bulk data, raw PDFs and private handoffs are excluded from Git
and runtime artifacts.
