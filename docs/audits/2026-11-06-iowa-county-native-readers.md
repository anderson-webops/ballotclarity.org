# Iowa county sample readers

## Source evidence

The independently published Monona and Woodbury County general-election pages
offer fourteen and seventy-three distinct sample PDF documents respectively.
All 87 documents were acquired on November 6, 2026 using normal TLS and serial
requests paced at least twenty seconds apart for each publisher. Original
documents, acquisition receipts and native extraction evidence remain outside
Git.

- [Monona County election publication](https://mononacountyiowa.gov/elections/2026_general_election_2026_11_03/)
- [Woodbury County election publication](https://elections.woodburycountyiowa.gov/elections/info/2026_general_election_2026_11_03/)

The 174 pages contain 3,895 named person or ticket-member occurrences. Two native
PDF extraction paths reconcile their names and positions, with original-source
hashes and visible-text/font checks. These counts describe the offered samples,
rather than distinct people or personalized ballots.

## Reader contract

`state-ballot-iowa-county-native.ts` reads the reviewed two-page, three-column
sample layouts. It binds both native and layout text to an explicitly supplied
county and general-election date. Media geometry, reviewed crop-coordinate windows, structural bounds, named
offices, printed party associations, complete joint tickets, vote instructions,
and separate judicial retention questions are validated before returning data.

The county-level reconciliation retains:

| County | Samples | Distinct candidate/ticket entries | Retention questions | Total entries |
| --- | ---: | ---: | ---: | ---: |
| Monona | 14 | 44 | 9 | 53 |
| Woodbury | 73 | 77 | 9 | 86 |

Monona has 25 local candidate entries and Woodbury has 51. Township names are
preserved as printed, with each source style's membership and name evidence
retained separately. Matching names alone do not establish a voter's eligibility.

The reader keeps unknown party labels distinct from offices explicitly grouped
as nonpartisan. Blank write-in spaces and offices without named choices do not
become candidate records. Vote limits, vacancies, joint ticket members, empty
printed contests and measure-column text remain separate facts. Measure text
does not automatically become an approved application measure.

Multi-style reconciliation rejects conflicting facts for a shared choice rather
than assigning a second identity. Each document retains its URL, PDF hash,
original acquisition clock, printed style label and count of newly contributed
entries. The collection timestamp is the earliest contributing acquisition;
reading or preparing the data does not advance it.

## Scope and remaining integration

The reader supports explicitly supplied, date-bound future general-election
fixtures, including presidential tickets. Changed layouts, judicial districts,
office vocabulary and incomplete columns require review. A supplied future date
is a parsing input, not evidence that a publisher has released that election.

The Monona county filing announcement and its older statewide/federal report
remain independent sources. Sample-ballot status does not upgrade filing
records, establish winners, or link people to current officeholder profiles.

This module is a maintained ingestion primitive. Publisher policy enrollment,
actual offered-election discovery, complete document-set selection, recurring
collection, original-PDF crop/visibility verification, durable snapshot integration and public route acceptance remain
separate work. Existing Story, Johnson and Polk configurations and the
state-publisher access hold are unchanged.
