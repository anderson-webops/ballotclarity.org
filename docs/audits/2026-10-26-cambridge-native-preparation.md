# Cambridge native candidate preparation

## Scope

The [Election Commission](https://www.cambridgema.gov/departments/electioncommission)
and its [dated election article](https://www.cambridgema.gov/departments/electioncommission/news/2026/10/november32026stateelectionvotingoptions)
offer the November 3, 2026 candidate publication. Its 73,899 bytes retain SHA-256
`f295146bd0d96e738343a7c83ad4a3ee76dbdd74baf0de11d4e613a15611509b`,
matching the October 21 reviewed original. All three pages carry the election
heading. The first two contain 32 records; the third contains ballot-question
references, not additional candidates.

The new offline reader replaces hand transcription with bounded native PDF
extraction. It preserves the existing record IDs, literal names, three joint-ticket
labels, parties and named districts. Counts remain fifteen statewide, two
congressional, four Senate, six House and five regional records. Middlesex & Suffolk
and Suffolk & Middlesex remain distinct. Residential addresses are validated only
as row boundaries and are excluded from every generated record and export.
Neither numerical legislative-district conversion nor personal eligibility is
inferred. No new candidacy or complete Massachusetts coverage is claimed.

## Collection hold

The current [privacy statement](https://www.cambridgema.gov/privacystatement)
and [disclaimer](https://www.cambridgema.gov/disclaimer) are independently reviewed.
The disclaimer limits intended use to individual, noncommercial use and requires
prior written consent for commercial downloading, copying or republication.
Service-wide collection and reuse permission remains unresolved, so **automatic
Cambridge collection is not enabled**. Existing reviewed data and its source
identity remain unchanged. Further collection requires an applicable permission
assessment, not another user agent, host or transport exception.

The initial local legal-link inventory omitted the separately linked disclaimer.
A single current candidate file was retrieved before this omission was corrected;
it is byte-identical to the retained original. The disclaimer was then inspected,
and the proposed collection integration was removed before source delivery.
The offered uppercase `Files` URL returns an ordinary same-origin lowercase
canonical redirect. This is recorded as transport evidence, not used to avoid the
reuse restriction. No subsequent candidate request or automatic import is made.

## Local preparation contract

`prepare-reviewed-candidates` accepts `input.format: "cambridge-candidates-pdf"`
only for the exact configured manual source, original document URL, pinned bytes,
capture clock, page count and reviewed candidate pages. Its output remains outside
the application checkout and includes the existing six draft/provenance files.
The Cambridge source's existing storage descriptor is preserved; this native-only
case does not enable generic CSV preparation for other implicit-storage sources.
Publication, automatic import and personal-assignment approvals remain false.
The tool performs zero publisher requests and retains the supplied original
capture time. A parser's ability to process a document is not reuse permission.

Synthetic tests exercise Unicode, party labels, tickets, district distinctions,
page provenance, duplicates, malformed rows, unsupported formats and incomplete
documents. They contain no real residential addresses. The native preparation
and runtime checks additionally compare all 32 existing fields and IDs against
the retained local dataset; future-year fixtures are synthetic only.
