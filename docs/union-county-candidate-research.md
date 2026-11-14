# Union County candidate research

The New Jersey [Union County Clerk's candidate index](https://unioncountyvotes.com/whos-running/)
offers separate general-election and school-board lists. The maintained research
collector follows the newest explicitly offered general-election edition and its
two dated links. A future year uses the same plan and parser when the publisher
offers compatible documents. Years, election dates and URLs are never advanced
speculatively.

## Collection

The compiled command is `back-end/dist/collect-union-candidate-research.js`.
It accepts this strict JSON plan:

```json
{
  "schemaVersion": 1,
  "type": "union-candidate-research-collection",
  "outputRoot": "/external-research/union-candidates",
  "accessReview": {
    "robots": "<reviewed complete robots fingerprint>",
    "privacy": "<reviewed privacy-region fingerprint>"
  }
}
```

```sh
node back-end/dist/collect-union-candidate-research.js /external-research/plan.json
```

The source's reviewed robots policy requires thirty-second spacing. Every request
is serial and separated by at least thirty-one seconds. Collection retains the
robots, index, privacy notice and both original PDFs with exact hashes and clocks.
The supported HTTPS transport retains public-address pinning, hostname and
certificate validation, explicit host bounds and no redirect following. A denial,
challenge, changed policy, unknown legal link or persistence failure stops further
requests. Collection has no state-portal fallback.

`STATE_BALLOT_PDFTOTEXT` identifies an absolute maintained Poppler executable.
The intake is held by the shared process-owned lock and uses a new private
directory each time. Each body and capture metadata are synchronized before
collection continues. Incomplete intakes remain available as evidence; they have
no completed `capture.json`. Previous intakes remain unchanged.

Bounds are five fetched bodies, two PDFs, twelve MiB per PDF, two MiB per policy
or index, twenty seconds per request, fifty landscape pages per PDF and four MiB
per extraction. The existing bounded native worker supplies ordinary layout and
positioned word extraction. Public readers invoke neither the publisher nor PDF
tools.

## Offline preparation

```json
{
  "schemaVersion": 1,
  "type": "union-candidate-research-preparation",
  "capturePath": "/external-research/intake/capture.json",
  "captureSha256": "<original capture manifest SHA-256>",
  "outputRoot": "/external-research/prepared"
}
```

```sh
node back-end/dist/collect-union-candidate-research.js prepare /external-research/prepare.json
```

Preparation verifies the pinned manifest, complete source inventory, policy
fingerprints, original bytes, earlier CSV and original clocks before writing a
separate result. It makes zero publisher requests. Repeated preparation produces
identical CSV and JSON without changing capture or source-as-of dates.

The CSV contains literal names, office wording, municipality/publication context,
party codes where printed, positions, explicit row term labels, source pages,
URLs, hashes and clocks. Addresses, email addresses and campaign slogans are
excluded. `Dem`, `Rep` and `Ind` remain source codes; slogans do not become party
affiliations. Blank party cells remain blank. Repeated positions in different
wards remain distinct. Nomination placeholders and empty-filing notices are
retained only in the research inventory and never become people.

The native reader requires every page's election date and footer revision date
to agree with the offered edition. Names and comparison fields agree between
layout and positioned extraction. Both use Poppler, so this checks extraction
and layout consistency rather than independently confirming the publisher.
Unknown columns, missing fields, unrecognized party codes, date conflicts and
unconsumed table data require review instead of partial preparation. Original
selection instructions and congressional area descriptions remain research
context; no personal district mapping is inferred.

## November 14, 2026 review

Ordinary native acquisition returned both official lists. The general list is
dated September 3 and supplies 125 named entries across twenty-nine pages. The
school list is dated August 12 and supplies 59 entries across eighteen pages.
Both explicitly identify November 3, 2026. All forty-seven page inventories were
reconciled, with rendered review of the complete page set and closer inspection
of wrapped names, blank parties, repeated ward positions and nomination notices.

Both publications retain a warning about confirming positions after September 1.
The school list predates that date. These outputs are candidate-reference research;
final ballot qualification, position confirmation and personal applicability
remain unverified. Single-name lists establish no unopposed or elected status.
Incumbency and results are not inferred. Existing federal New Jersey records stay
unchanged; independent ballot corroboration and reviewed integration precede
publication or recurring host activation.

Source acquisition, offline preparation, substantive review, import, publication
and scheduling remain separate milestones. Raw source bytes and research data
stay in external storage rather than Git or public runtime assets.
