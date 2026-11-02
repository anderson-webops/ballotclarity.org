# Georgia certified write-ins

The Georgia Secretary of State's final certificate, published September 15,
2026, is available through Fayette County's official election index. The
normally retrieved PDF contains 21 certified write-ins: ten statewide, six
congressional and five state-house records. Its original bytes have SHA-256
`7b9274b86ef4dd385f159b345d3b269611a0afce4122ae8ec6d9f4588adf9993`.
Retrieval occurred November 1, independently of the printed publication date
and the county's filename/query timestamp.

Source: [Fayette elections](https://fayettecountyga.gov/departments/elections/index.php),
[state certificate](https://fayettecountyga.gov/Documents/Departments/Elections/Sample%20Ballots/2026%20Certified%20Write-In%20Candidates%20v3.pdf?t=202610131910270).

## Import and future editions

`ga-certified-writeins-2026-11-03` is an external, manual-snapshot source.
`prepare-georgia-writeins SOURCE_ID /absolute/certificate.pdf CAPTURED_AT_UTC
/absolute/output.json` uses maintained Poppler via `STATE_BALLOT_PDFTOTEXT`.
It performs no network access, import, publication or scheduling. It discovers
the printed election/publication dates, offices and candidates without hardcoded
current names or totals. The output uses the existing validated snapshot/import
contract. Existing files are not overwritten.

The parser accepts the reviewed one-page final-certificate layout and rejects
unsupported offices, missing completeness evidence, invalid dates, duplicate
entries and empty sections. Compatible future editions use their own reviewed
source configuration and original capture provenance. Layout changes require
review rather than silently dropping records.

Fayette's robots response was HTTP 404 and its index offered no linked reuse
policy. This does not establish unattended collection approval or a blanket
reuse license. No recurring acquisition family or schedule is enabled. The
state publisher's separate access hold remains intact. Extraction retains only
factual candidate names, offices and qualification status, not the document's
artwork or narrative. Original documents and mutable snapshots stay outside Git
and public runtime assets.

## Applicability and reconciliation

An opt-in stored-data supplement joins certified write-ins only to nonlocal
office slots already present in the primary source, within the same state and
election. The retained Fulton roster's 98 records therefore gain ten statewide
write-ins, not the certificate's unrelated district races. Each added record
retains its own source identifier, document and capture evidence. ZIP lookup
continues to expose statewide races only; an address must independently establish
any district match. Parties and incumbency remain unknown when not documented.
Missing or unavailable supplements preserve the primary data.
Explicit archived-source reads retain these supplements after the election;
default current-source discovery remains time-bound.

The earlier Heard County research spells one governor write-in differently,
including a different Roman-numeral suffix. The state certificate's printed name
is preserved literally. Those names are not treated as aliases, and the older
research remains unchanged and unimported. Heard's county-commission record is
outside this state/federal certificate and remains separate research.

Receipt, substantive approval, import, publication and recurring collection are
separate milestones. This source change authorizes none of the latter steps.
