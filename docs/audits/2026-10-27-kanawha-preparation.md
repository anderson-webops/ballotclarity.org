# Kanawha County pre-election roster preparation

## Source and scope

The [county election index](https://kanawha.us/county-clerk/election-center/)
independently publishes a [public test report](https://kanawha.us/wp-content/uploads/2026/10/Zero-Test-2026-General.pdf).
Normal public-address-pinned HTTPS returned its original 30,200 bytes on October
27, SHA-256 `2f58ca0763d7268d9f5175ec51716c80ae19d44853642a2e11290b874f30dfb5`.
All 13 pages name Kanawha County, the general election and November 3, 2026.
The printed publication clock is October 14 at 9:49 a.m., with minute precision
and no stated time zone. It is distinct from retrieval and the PDF metadata clock.

The report contains 110 candidate/office records in 60 contests: three U.S.
Senate, three U.S. House, nine state Senate, eighteen House of Delegates and 77
local records. County, municipal, ward and unexpired-term contexts remain
separate. Explicit voting limits remain voting limits, not inferred seat counts.
Printed party codes retain their source spelling alongside factual labels;
unprinted parties remain absent. Names are not independently resolved to people.

This is a zero-vote pre-election test roster, not election results, certification
or proof of personal eligibility. Aggregate voter statistics, zero vote counts,
empty nomination slots and write-in totals are not imported as candidates or
outcomes. Four question headings and their printed choices form an inventory,
not complete ballot wording or application measures. Full sample ballots and
levy text remain separate work.

## Bounded native prerequisite

`readKanawhaTestDocument` is an offline preparer, not an enabled source family.
It reuses maintained bounded QPDF and Poppler workers. The reviewed PDF uses one
unembedded Helvetica Type 1 font with WinAnsi encoding. Unknown font dictionaries,
custom Unicode maps, active/optional content, encryption, attachments, forms and
changed page boundaries require review. The native object inspector retains its
20-page bound; text retains its 12-MiB input, 4-MiB output and 12-second bounds.

The reader requires complete sequential pagination, consistent printed dates
and clocks, the known general-election layout, zero reporting and voting totals,
complete contest blocks, literal party codes and valid question-choice pairs.
Duplicate identities and unfamiliar fields require review. Future examples are
synthetic, not observed future publications. Empty validated candidate blocks
stay empty rather than generating people or successful application imports.
Structural validation is not a claim of complete future rendering fidelity.

## Collection review

The county's reviewed wildcard robots rules exclude the administrative path,
not these public publications. Homepage, index, privacy, accessibility and
non-discrimination pages were inspected before the report request. Observed
same-host canonical trailing-slash redirects on policy pages were recorded and
their exact targets inspected; no candidate-document redirect was followed.
These pages contain no observed automated-collection prohibition. The copyright
notice is not a blanket republication grant: only factual fields are prepared;
original PDFs and artwork remain outside Git and release assets.

The separate West Virginia statewide candidate host retains its TLS/access hold
and all 564 existing reviewed records. This county source is not an alternate
transport or trust override for that host. The county's voter-specific sample
ballot form, candidate certificates and campaign-finance documents were not used.

Minneapolis was also investigated. Its missing robots files return HTTP 404,
which is absence rather than an access denial. Its linked [terms of use](https://www.minneapolismn.gov/about/terms-of-use/)
require written consent for reuse or republication of website text. This review
does not establish permission for that reuse; no candidate text was collected
or republished. Independence's independently published index and privacy/SMS
policies remain separate leads, with its existing 78 records preserved.

## Remaining integration

Reliable unattended import still needs date-bound discovery from actually
offered report links, recurring policy checks, capture/snapshot provenance,
durable waiting and retention, verified native rendering, source configuration
and real-data API/browser acceptance. Existing source counts, canonical data,
the pending server packet and the accepted runtime are unchanged by this
preparation. No source URL or future election date is guessed.
