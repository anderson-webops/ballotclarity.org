# Louisiana parish sample research

[Power Coalition for Equity and Justice](https://powercoalition.org/sampleballots/)
publishes independently authored parish-wide sample guides. This nonprofit
publication is an unofficial factual research source. It is separate from the
held Louisiana election portal and from ballot qualification or personalized
ballot assignment.

## Reusable collection

`back-end/dist/collect-louisiana-parish-samples.js` accepts a strict JSON plan:

```json
{
  "schemaVersion": 1,
  "type": "louisiana-parish-sample-research-collection",
  "parishes": ["West Carroll", "Caddo"],
  "outputRoot": "/external-research/louisiana-parish-samples",
  "accessReview": {
    "robots": "<reviewed robots fingerprint>",
    "privacy": "<reviewed privacy-region fingerprint>",
    "terms": "<reviewed mobile-terms-region fingerprint>",
    "secureNavigation": "upgrade-insecure-requests"
  }
}
```

```sh
node back-end/dist/collect-louisiana-parish-samples.js /external-research/plan.json
```

`STATE_BALLOT_PDFTOTEXT` selects an absolute maintained Poppler executable.
The external output root coordinates one process-held intake at a time.
Each new intake retains separate content-addressed source files and per-URL
capture metadata. Prior intakes remain unchanged. Every body is synchronized to
disk before collection continues. The final `capture.json` identifies source
hashes and original clocks, collection/preparation outcomes, factual references
and the CSV digest. An interrupted intake has no completed manifest and remains
available for review.

The same command supports offline re-preparation after a reviewed parser update:

```json
{
  "schemaVersion": 1,
  "type": "louisiana-parish-sample-research-preparation",
  "capturePath": "/external-research/intake/capture.json",
  "captureSha256": "<original complete capture manifest SHA-256>",
  "outputRoot": "/external-research/prepared"
}
```

```sh
node back-end/dist/collect-louisiana-parish-samples.js prepare /external-research/prepare.json
```

Preparation verifies the pinned manifest, original CSV, complete input bytes,
catalog, source navigation and capture clocks before extracting facts. It makes
zero publisher requests and writes a separate external result. Identical inputs
and parser versions produce byte-identical CSV and JSON, preserving the original
intake and its earlier review outcomes.

Selection is limited to 25 named parishes per invocation. Discovery follows the
actual dated election section and its public download controls. It preserves
malformed or missing controls as exceptions. Page titles and unrelated historical
headings do not date the selected publications. Later editions reuse the dated
section and offered identifiers rather than generated yearly URLs. Changed
election types or ambiguous sections require review.

## Transport and publisher boundaries

The reviewed publisher supplies `Content-Security-Policy:
upgrade-insecure-requests`. Some normally offered download controls return a
same-host HTTP-form PDF location. A source-specific adapter applies the
publisher's enforced upgrade directive before requesting that document, as
specified by [W3C secure navigation](https://www.w3.org/TR/upgrade-insecure-requests/#navigational-upgrades).
Both the current index and redirect must carry the directive. The request keeps
the exact offered host and path and uses HTTPS exclusively, including public-DNS
pinning and normal TLS verification. Native Chromium independently exhibits that
same HTTPS navigation. The generic document transport still follows no redirect
and exposes only bounded metadata; all other collectors retain their existing
redirect policy. There is no plaintext fallback, host alias or guessed PDF URL.

The current robots, privacy and mobile-terms fingerprints precede source
collection. Unknown policy links, changed terms or absent secure-navigation
evidence stop intake. Requests are serial and separated by at least eleven
seconds, including controls and their document requests. Authentication failures,
access denials and rate limits hold later publisher requests. The independent
state-portal and other parish-host holds remain intact.

Bounds are 12 MiB per fetched body, 64 MiB retained per batch, twenty seconds per
request, 50 pages per PDF and 4 MiB of extracted text. Required native tools stay
in the collection process; no public reader invokes them.

## Candidate-reference output

`candidate-references.csv` retains parish publication context, explicit election
date, literal name, office, source-stated party, stated selection limits, original
PDF page, unofficial-reference marker, URL, hash and capture time. A source's
`No Party` is retained literally. Race, gender,
registration instructions and explanatory advocacy prose are excluded.

Native preparation requires matching parish/election labels and a reviewed
candidate-row structure. A candidate group must follow a recognized office
heading directly. Reviewed court/jurisdiction continuations and explicit seat
counts remain separate from explanatory paragraphs; unknown associations are held.
Collection and preparation outcomes remain separate, so a retained PDF can still
require native review. Questions remain in the original evidence and are not
silently converted into application measures.

The research manifest retains `official: false`, `officialQualificationVerified:
false`, `personalApplicabilityVerified: false`, `publicationApproved: false` and
`automaticImportApproved: false`. Independent verification, substantive publication
and recurring-host activation remain separate decisions. Raw publisher documents
and research datasets stay outside Git and public runtime assets.
