# Washoe County official candidate publication

## Evidence and scope

The [county election page](https://www.washoecounty.gov/voters/information/)
prints the November 3, 2026 general-election date, 57 candidate offices and three
ballot questions. The factual roster contains 103 person entries: 18 statewide,
three congressional, six state Senate, fourteen Assembly and 62 local/regional.
These are candidacies, not a count of distinct people or a personalized ballot.
Local district, ward, school and improvement-district applicability remains
unverified. The source includes congressional district 2, which Clark County's
publication does not cover.

The county explicitly reports Lance White's death and continued printed presence
for District Court Judge, Department 13, Family Court. His record is inactive,
with the notice retained; 102 other entries are active. This is not an inference
about votes, succession or election outcomes. Eight "None of these candidates"
options are not person records. State questions 6 and 7 and Washoe County's
advisory, nonbinding question 1 are retained separately. Existing native Nevada
measure content is unchanged; this candidate importer does not publish questions
as native measures.

Published DEM, REP, IAP, NPP and LPN labels are normalized without ideological
inference. Nonpartisan offices have no inferred personal party. Printed two-,
four- and six-year terms and vote-for-one/two/three instructions are retained.
Seven candidacies carry a vote limit of two and five a limit of three. The
published "Breitmeyer, III, Martin W." becomes "Martin W. Breitmeyer, III".

## Access and reuse review

The election menu's `information/index.php` link returned 404. The separately
indexed official `information/` page returned 200 using the same normal public
downloader. No access-denial workaround or alternate identity was used.

Robots rules allow these paths. The named `ia_archiver` and `FessWC` groups were
reviewed explicitly; the general group excludes unrelated cgi-bin, repository
and large_files paths. Global policy links and the canonical privacy page were
reviewed. Its offered slash redirect was inspected before explicitly requesting
the canonical URL with redirects disabled. The privacy text concerns visitor
data and makes no blanket public-domain or republication grant. Imported facts
and short ballot questions retain source attribution; no full voter pamphlet or
candidate-authored statement is republished.

The collector pins robots, home-policy links, privacy text and election-page
policy links before accepting data. Starts are serial and at least eleven
seconds apart. Requests use validated public HTTPS, a two-MiB text bound, a
25-second timeout and zero automatic redirects. Parsing does not execute site
scripts. A changed policy fingerprint stops collection for review.

## Independent publication limits

The actually offered contest workbook was retained: 18,294 bytes, SHA-256
`5604642ba869b95e029c937930373b691ff73fa74cf76df34079a4cc8e38ad18`.
Its printer-settings binary caused the existing strict workbook archive guard
to reject it. It is not imported, stripped or relabeled to pass that guard.

The offered English sample booklet exceeded existing download byte/encoding
bounds and was not retained or retried with looser limits. The separately
retained 30-page question PDF is the statewide guide for questions 6 and 7;
it is not evidence for county question 1. Thus neither workbook nor booklet
provides an accepted independent roster reconciliation. The HTML publication
stands on its own verified structure, rather than a claimed second-source match.

## Automatic current and future acquisition

The automatic family `nv-washoe-2026` uses durable external snapshots, not Git
datasets. Discovery reads the actual printed election date from the same public
page. A future even-year November election receives a date-bound source identity
only when offered by the publisher. No future filenames, candidates or nominees
are fabricated. Changed publication hashes invalidate a fresh cached discovery;
unchanged imports retain their original retrieval/import clocks. A dated future
page without a roster is awaiting publication, not an empty ballot.

Complete section, office, column, name, party, term and vote-limit structures
are validated. Unknown formats, duplicate identities, unexpected hidden data,
pagination and unmatched death notices require review. Capture and stored
snapshots bind the exact raw document hash, URL, date, record count and clocks.
Persistence failure retains the prior stored snapshot.

An unambiguous county match can select this county publication ahead of a
different county's statewide fallback. Unknown, ambiguous or IP-derived county
matches retain the prior behavior; expired or unavailable county sources do not
override it. Local candidacies remain directory records, not personal ballot
assignments. Verified congressional/legislative boundary rules remain unchanged.

## Validation boundary

Actual retained HTML tests cover all 103 entries, 57 offices, eight nonperson
options and three questions, including suffixes, party labels, multi-seat rules,
the death notice, provenance round trips, changed-publication refresh and cache
clocks. Future-date and awaiting-publication cases are synthetic compatibility
tests, not current or future candidate evidence. Native, compiled API/browser,
accessibility and exact production-artifact acceptance are separate delivery
gates. Source publication does not establish host scheduling, activation or
public data acceptance.
