# Washington public pagination and Providence question review

## Authority and source access

This is local continuation of the national collection goal, not publication,
host transfer, deployment or server administration. The preceding accepted
Wisconsin/Arizona batch remains preserved. All existing dirty work, external
data, package/lockfiles and worktrees are retained. Final server-AI instructions
remain conditional on the unfinished collection/setup work.

Washington's normal [general candidate list](https://voter.votewa.gov/CandidateList.aspx?e=899)
explicitly selects GENERAL 2026 (11/03/2026) (General), not the 2027 default or
the August primary. All nine ordinary public pages returned HTTP 200. The prior
CSV-export HTTP 403 is not retried; no export, private voter lookup, identity
change, proxy or trust bypass is used. The candidate host's robots request was
404. The Secretary of State's complete robots policy allows the public policy
and pamphlet paths used in this review.

The full [Secretary of State privacy/public-domain notice](https://www.sos.wa.gov/web-sites-privacy-policy)
was captured at `2026-10-21T21:33:04.472Z`, SHA
`d1a96b3021a6c560d54c9205d5c16110d50d8e6c4357bfe61dc247ce5bd997cf`.
It allows reuse of public-domain information while distinguishing third-party
copyrighted material and protected private records. Only candidate facts are
packaged, not photographs, statements, contacts or original graphics. The
[state candidate guide](https://www.sos.wa.gov/sites/default/files/2026-02/StateCandidatesGuide2026.pdf)
distinguishes a candidate's party preference from a party nomination or
endorsement. King County's independent publication restriction is unchanged;
no restricted county source is imported through this work.

## Complete Washington facts

The nine pages reconcile 887 records: ten statewide Supreme Court choices,
twenty congressional, 41 Senate, 184 House and 632 local/regional. All source
statuses are Active, retained as filed rather than inferred qualification,
unopposed status, retention, election or victory. Two fire-district rows
explicitly say In General. Literal party labels, including INDEPENDANT,
DEMOCRAT, LABOR DEMOCRAT, NO KINGS and STATES NO PARTY PREFERENCE, are not
silently merged or converted into nominations. Blank preference stays blank.

Terms are 817 Regular, 47 Short & Full, nineteen Unexpired and four Initial
Full. Numerical source term lengths and ballot order are preserved; no unit
or remaining term is invented. House positions 1/2 and judicial positions
remain separate. Supreme Court records retain their statewide court context;
appeals and other regional courts remain local, not statewide retention choices.

Some 421 records use the literal district label County rather than a county
name. That source limitation is disclosed, not guessed from contact addresses,
row order or numerically similar districts. All local/regional records are
browsable but withheld from personal previews. Public guide identifiers remain
stable source identifiers; their URLs are not mislabeled as campaign websites.
The reference manifest's officeCount of 395 counts distinct printed
office/district/jurisdiction label groups, not a verified number of actual local
offices: generic County labels can combine otherwise separate county offices.
Mailing addresses, emails, phones and filing-date/contact columns are omitted
from application and companion facts.

## Automatic storage and recovery

`wa-general-2026` uses `washington-html`. The downloader follows only the
published next-page control after validating the configured election/date,
normal form target, unfiltered county and column controls, English selection,
exact headers, page sizes, order and advertised totals. It bounds each page,
the combined envelope, total pages and total records. A denied, filtered,
repeated, incomplete, changed-status or inconsistent page set cannot replace
accepted data. Future election/date/ID updates are declarative but still require
source-policy review and new acceptance evidence, not a blind year substitution.

The compiled default downloader, using the existing pinned transport without
custom headers or credentials, independently fetched all nine pages at
`2026-10-21T21:45:09.872Z`. Its raw envelope hash is
`29774753794b2e4539e943e7afb4d3891a5ff75b82eed504835ac5b219513575`;
all 887 parsed facts exactly match the earlier individual page captures.
The canonical reference snapshot conservatively retains the first capture,
`2026-10-21T21:34:13.603Z`, with all nine actual page times in its manifest.
View-state nonces can change a raw envelope hash without changing the facts.

Later live reads also varied the letter case of typed district labels. An
exact comparison first found two congressional District 9 labels; an independent
capture instead found six Legislative District 46 labels. A subsequent refresh
found four Legislative District 5 labels. Record IDs, names, offices, terms,
parties, status and normalized geography were otherwise identical. The initial
two-label-only expectation rejected the wider casing variation and remains a
diagnostic, not a passed capture receipt.

The original dated reference and its source claims remain immutable. The
current automatic cache preserves each latest literal label and capture hash;
its separate-process export, API and UI must match that current cache exactly.
Only cross-epoch reference comparison treats letter case as equivalent in the
typed congressional/legislative source-district label. It does not normalize
stored source facts or permit changed names, parties, offices, terms, status,
candidate identity or geographic codes. A focused regression also verifies
that letter-case variation preserves the stable record ID while retaining the
literal label. No application-parser or factual-package rewrite is needed.

The supported compiled `refresh WA` creates the host-owned persistent cache
outside all checkouts/releases. Reviewed `import` remains refused for this
automatic source. The ignored snapshot, export, claims, manifest, exact
four-member archive and checksums stay outside Git and code artifacts. Raw
contact-bearing HTML remains local review evidence, never a transfer package.

## Rhode Island factual companions

Providence's independently published [2026 election index](https://www.providenceri.gov/canvassers/2026-election-information/)
links a four-page bilingual warrant and six-page local-question publication.
Both PDFs returned 200 and all ten pages were visually reviewed. The complete
city privacy/copyright notice and robots policy were read before retrieval;
the allowed public upload paths are used without query-string or admin routes.
Copyrighted format, seal, imagery and explanatory prose are not transferred.

The [warrant](https://www.providenceri.gov/wp-content/uploads/2026/10/Warrant-Bilingual-election-11-3-2026.pdf)
was captured at `2026-10-21T21:32:12.934Z`, SHA
`54e18e8432697ad6728b80a55716bc654b3f1ba13634aa5f37552517801f643e`.
It identifies November 3, 2026 and precinct polling places, not candidate names.
Its canvassing officials are not imported as ballot candidates. No address or
polling-place assignment is inferred for a visitor.

The [local-question publication](https://www.providenceri.gov/wp-content/uploads/2026/09/November-2026-Local-Question-Explanantions.pdf)
was captured at `2026-10-21T21:32:23.599Z`, SHA
`d643b72f87eda5b6ca37cb7bf8b9f911d3cb2db2de3e91bf0f7057936bc75fea`.
Question 6 concerns a maximum $25 million housing-trust bond authorization;
question 7 is the printed divestment ordinance question. Two unique questions
retain four exact English/Spanish question texts and their Approve/Reject or
Aprobar/Rechazar choices. The Spanish question 6 actually begins Deberá, while
question 7 begins Debería; a failed extraction expectation was corrected to the
source, not by altering it. The factual question companion, manifest, exact
two-member archive and checksums are external-only reference data, not
application measures or evidence of personal eligibility. Rhode Island still
has no integrated candidate dataset, and the denied state portal is unchanged.

## Validation checkpoint

Fifteen focused synthetic tests cover complete pagination, field preservation,
typed geography, cross-format coverage notices, configuration-driven rollover,
public form identity, denial/incomplete-update refusal, bounds, private-field
exclusion, concurrent requests and persistent restart/export behavior.
Early formatting and JSON undefined-versus-absent test expectations remain
diagnostic evidence; no field or safety check was dropped to satisfy them.
The coverage-notice test revealed that automatic sources omitted configured
scope notices in lookup previews. That root cause is fixed for all formats,
with the configured notice included once rather than weakening the test.
The automatic-source preview keeps the qualification limitation and the
source-specific coverage notice, omitting the redundant generic local-coverage
sentence when a source-specific notice is present. Essential control labels,
dates, accessibility text and source links need no change. No onboarding,
reassurance or development commentary is added to the interface.

Final lint, typecheck, 674 unit tests, both builds and 21 integrated tests pass;
two existing optional PostgreSQL tests are skipped. The build verifies eighty
back-end modules and fifteen native dependency entries. The compiled refresh
at `2026-10-21T22:02:49.731Z` persists all 887 current records. Exact cached
snapshot and separate-process export copies are retained as factual evidence.
Invalid refresh leaves accepted disk bytes untouched, and reviewed import
remains refused for the automatic source. Both archives unpack to the exact
four/two declared members and hashes. Original reference data and all earlier
external files remain unchanged.

The local API verifies thirty per-source datasets/captures with 19,837 records
and 213 bounded projections, including all nine current Washington API pages.
All eighteen Washington directory pages, source filters, missing-cache state,
red election dates, three themes and 320/390/1280 widths are covered. Eighty-three
typed congressional/legislative matches preserve the expected candidates;
regional and local records stay outside personal previews. Washington, Kansas
and Montana saved lookups show their source-specific limits without the
redundant generic local-coverage sentence. A New York directory remains isolated
after a Washington lookup.

All 41 final responsive/WCAG A/AA cases pass with zero violations, page errors
or horizontal overflow. Eight final images were visually inspected. During
cached application verification there are zero publisher requests; the one
controlled missing-cache fetch is an intentionally throwing local fixture,
not an external request. Earlier fully passing copy checks and failed
cross-epoch casing assumptions remain separately labeled evidence, not the
final rendering result. All owned preview/browser/API services and temporary
stores are closed or removed, independently checked by recorded PIDs and ports.

Seven original files are backed up and three canonical files are new. The final
preservation receipt binds all 133 unrelated paths, 83 previous external files,
five package/lockfiles, unchanged heads/staging/four worktrees, 140 managed dirty
paths and 93 external files. The final local secret-scan and acceptance receipts
bind the current maintained files, factual data and fresh-cache/export evidence.
GitGuardian remains previously unavailable, not passed; it is not used as a
reason to wait or skip the independent local scan. No publication, host transfer,
deployment, credentials, permissions or saved configuration changes occur.

The maintained changes are `README.md`, `back-end/src/state-ballot-sources.ts`,
`back-end/src/state-ballot-fetch.ts`, `back-end/src/state-ballot-records.ts`,
`back-end/src/state-ballot-repository.ts`, the new
`back-end/src/state-ballot-washington.ts`, its new focused test
`back-end/test/state-ballot-washington.test.ts`, `docs/state-ballot-sources.md`,
`docs/state-coverage-2026.csv` and this audit. Existing navigation, control labels,
accessibility text and unrelated UI copy need no change.

Forty-four states plus DC are configured: nineteen automatic sources and
twenty-six dated sources, ten of them external-only reviewed imports. Arkansas,
Georgia, Idaho, Louisiana, Oklahoma and Rhode Island still lack a candidate
dataset. Maine remains municipal-only. Wider state/local mapping, amendments,
profiles/news, application measures and legacy bulk-data migration remain
unfinished. The goal stays active and the final server-AI instructions remain
queued rather than presented as operationally ready.
