# Everett native candidate preparation

The independent City of Everett election library offers three November 3, 2026
sample ballots. The retained originals contain 66 candidate occurrences across
twelve offices, representing 24 distinct candidate/ticket records. Thirteen
records have an explicit reelection caption and three are joint tickets.

The reader verifies the native XML against rendered SVG outlines, placement,
color, clipping, contrast and paint order. Its reviewed catalog contains 69
characters and 762 outline hashes. The three source pages reconcile 275
substantive fields and 6,074 glyphs. Unexpected names, shapes, clipping, covering
paint or candidate overflow onto another page require review. Optional header
signature artwork is unrelated to candidate facts; when present its content,
mask and placement remain pinned.

`prepare-reviewed-candidates` accepts `input.format: "everett-ballots-pdf"` with
the configured source fingerprint and exact document set. It uses the bounded
`STATE_BALLOT_PDFTOHTML` and `STATE_BALLOT_PDFTOCAIRO` executables on local PDFs.
The first document is the plan input; all document hashes, original capture
times, page counts and reviewed candidate pages must match. Preparation makes
zero publisher requests and writes snapshots, NDJSON, provenance CSV, review
metadata and a hash manifest outside the application checkout.

Repeated candidate identities are checked for conflicting facts, then merged
while retaining every source-page claim and the printed ballot-style labels.
Document included-record counts assign each unique record to its first source,
giving 22, 1 and 1; the provenance CSV and review retain all 66 occurrences.
Congressional district 7 is explicit. Named legislative districts and regional
labels are retained as printed, with legislative personal-ballot matching held
pending a verified crosswalk. Ward suffixes such as `3` and `3A` remain distinct.
The reader exports no home contacts, inferred winners or current-term status.

Explicit source selections retain access to historical saved records across
restart, using verified local snapshots without publisher requests. Automatic
current-ballot lookup retains its election-window cutoff. Future captures,
changed source configurations and invalid stored data fail closed.

The historical 2026 cohort is a reviewed external snapshot. Publication,
automatic import and scheduling remain unapproved by preparation. Public record
readers use persisted facts and invoke neither native extraction nor publisher
requests. The independent city publisher's policy enrollment and recurring
document discovery remain separate work. Existing Massachusetts state,
Cambridge and Somerville holds are preserved.

The qpdf object-count warning on the original PDF remains recorded. Original
bytes are preserved; this reader uses a separately bounded Poppler XML/SVG
pipeline and makes no claim of qpdf acceptance. Future-date and style examples
in unit fixtures are synthetic parser checks rather than future candidate data.

## Official documents

- [Election library](https://cityofeverett.com/city-hall/departments/elections-department/)
- [Ward 2, precincts 1 and 2A](https://cityofeverett.com/wp-content/uploads/2026/09/STATE-BALLOT-WD-2-PCT-12A.pdf)
- [Ward 1, precincts 1, 2 and 3A; Ward 2, precincts 2 and 3; Wards 3–6](https://cityofeverett.com/wp-content/uploads/2026/09/STATE-BALLOT-WD-1PCT-123A-WD-2-PCT-23-WD-3-6.pdf)
- [Ward 1, precinct 3](https://cityofeverett.com/wp-content/uploads/2026/09/STATE-BALLOT-WD-1-PCT-3.pdf)
