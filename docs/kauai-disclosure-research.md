# Kauaʻi candidate-disclosure preparation

The independent [county Board of Ethics agenda index](https://www.kauai.gov/Government/Boards-and-Commissions/Board-of-Ethics)
offers memoranda listing people described as mayoral and County Council
candidates, with dates the board received their disclosures. These are factual
research references. Disclosure receipt does not establish ballot qualification,
nomination, an election date, a party, a result or current candidacy.

## Offline preparation

`back-end/dist/prepare-kauai-disclosures.js` reads original local PDF and agenda
index captures. It makes no publisher requests or imports. A strict JSON plan
pins the exact source URLs, SHA-256 digests and original capture timestamps:

```json
{
  "schemaVersion": 1,
  "type": "kauai-disclosure-research-preparation",
  "publication": {
    "path": "/external-research/original-packet.pdf",
    "sha256": "<original PDF SHA-256>",
    "url": "https://www.kauai.gov/files/assets/public/v/1/boards-and-commissions/board-of-ethics/2026_1016_boe-agenda-packet.pdf",
    "capturedAt": "<original ISO capture timestamp>"
  },
  "index": {
    "path": "/external-research/original-index.html",
    "sha256": "<original index SHA-256>",
    "url": "https://www.kauai.gov/Government/Boards-and-Commissions/Board-of-Ethics",
    "capturedAt": "<original ISO capture timestamp>"
  },
  "outputDirectory": "/external-research/new-preparation"
}
```

The output parent is an existing physical directory outside the checkout or
runtime. Existing output directories are retained and rejected for overwrite.
`STATE_BALLOT_PDFTOTEXT` selects an absolute maintained Poppler executable.

```sh
node back-end/dist/prepare-kauai-disclosures.js /external-research/plan.json
```

Preparation writes owner-only `kauai-disclosures.json` and
`kauai-disclosures.csv`. Identical captures produce byte-identical facts in a
new output directory, independent of preparation time. JSON has the distinct
`kauai-candidate-disclosure-research` type and is rejected by the ballot-candidate
snapshot parser. All publication, automatic-import and ballot-qualification
approval fields remain false.

## Source binding and limits

- The agenda must actually offer the selected county-hosted PDF. Its dated link,
  URL filename and packet cover must agree. The CLI accepts explicit cycle years
  in later publications rather than guessing a future election day.
- Newer offered agenda packets remain visible in the research output, including
  external links. Preparation leaves `latestPublicationVerified` false. It
  neither follows those links nor silently promotes an older document to latest.
- The independently bounded profile accepts up to 12 MiB of original PDF,
  100 pages, 4 MiB of native text and 3 MiB of index HTML. Existing global PDF
  defaults remain unchanged. Missing native-text capability requires review.
- Candidate disclosure memoranda require the office heading, report date,
  consistent cycle identity, both named-office sections and the reviewed footer.
  Invalid dates, unknown rows, duplicate names, conflicting same-date reports,
  changed layout and unsupported characters in the selected memorandum stop
  preparation. Unrelated financial forms are excluded from output.
- Received and updated dates remain separate. Literal names and source page
  numbers are preserved. Staff, contact information and financial assets from
  other packet pages are excluded. Each CSV row cites the original PDF page.

## Reviewed source

The [October 16, 2026 packet, page 57](https://www.kauai.gov/files/assets/public/v/1/boards-and-commissions/board-of-ethics/2026_1016_boe-agenda-packet.pdf#page=57)
contains a July 9 memorandum with 26 people: five mayoral and 21 council names.
One updated disclosure creates 27 dated events. The index also offers a November
20 packet on an independently unreviewed external host. October is therefore
neither a verified latest report nor a November general-election roster.

The original 78-page PDF is 11,134,338 bytes. A derived copy of page 57 and its
rendered proof can accompany factual research with the original parent hash,
URL and original page number. A selected-page copy is distinct from custody of
the full original. Raw captures and research datasets remain outside Git and
public runtime assets. Collection permission, reuse review, identity matching,
substantive publication and recurring host scheduling remain separate gates.

The county site's reviewed paths are independent of Hawaii's held statewide
candidate portal. This reader neither enables that portal nor adds a statewide
automatic ballot source.
