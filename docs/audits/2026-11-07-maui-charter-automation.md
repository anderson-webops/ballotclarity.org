# Maui County Charter Collection

Reviewed November 7, 2026.

## Independent County Sources

The [county election index](https://mauicountyvotes.gov/charter-amendments)
identifies eight proposed charter amendments and links their county resolutions.
The county's [September 18 publication](https://mauicountyvotes.gov/blog/f/eight-proposed-maui-county-charter-amendments-on-general-ballot)
reproduces the eight official questions and explicitly identifies the November 3,
2026 general election. Its release text is dated September 17; the retained
publication timestamp remains September 18. Resolution dates and publication
timestamps remain distinct.

These are county proposals, not statewide amendments, candidates, current
officeholders, or election results. Website ordinals are not treated as official
ballot question numbers. Resolution identities, including CD/FD revisions,
connect each question with its title and original document.

The 96-page Hawaii voter guide offered through the same county website is a
statewide publication. Its county/CDN location supplies no independent permission
for automated reuse of the state publication. Existing Hawaii state-source holds
remain unchanged. This collector uses county-authored charter material only.

## Reusable Collection

`back-end/dist/collect-maui-charter-measures.js` accepts one JSON plan:

```json
{
  "schemaVersion": 1,
  "type": "maui-charter-collection",
  "outputDirectory": "/absolute/external/collection-directory",
  "accessReview": {
    "reviewedAt": "2026-11-07T05:41:45.411Z",
    "robotsSha256": "9a86ee089a1fb815fc825106a39ca06e81cf1ac96ab668adb51ad9b291166a52"
  }
}
```

The collector reads the county's current charter index and follows the sitemap
advertised in its robots policy to actually offered charter articles. It derives
the election year, full election date and question count from county content.
Future dates, article paths, question wording and resolution numbers are not
generated from the 2026 election or calendar recurrence assumptions. Synthetic
future-cycle tests establish parser reuse; they do not establish publication of
a future election.

County article content is public JSON embedded in its delivered HTML. Parsing
uses JSON decoding and never evaluates publisher JavaScript. The collector makes
no requests to state publishers, document CDNs, private feeds, or undocumented
application endpoints. Resolution URLs remain citations for separate document
review. Requests retain strict TLS/public-address transport, exact host limits,
2 MiB response bounds, 20-second timeouts and serial robots-aware spacing.

Access reviews expire after 30 days. Changed robots rules, newly offered legal
policies, denied/redirected requests, missing questions, conflicting dates,
unmatched resolution identities and ambiguous publications stop the run. Normal
cookie-dialog headings and references to a board member's term are distinct from
question headings and website terms-of-use links.

## Evidence And Adoption

Each immutable external bundle contains the original county HTML/XML/robots
captures, hashes, retrieval timestamps and extracted question inventory. Exact
retries verify existing bytes. Conflicts and failed runs preserve prior bundles;
storage uses unlinked external paths and atomic, exclusive publication after
file synchronization. Partial temporary files never become accepted bundles.

The inventory retains `publicationApproved: false` and
`automaticImportApproved: false`. Collection supplies official question text and
citations. Reviewed native measure preparation, geographic applicability,
substantive publication approval and recurring-worker enrollment remain separate
steps. Collection after election day preserves the historical source material
without inventing outcomes or a new ballot.

The public application continues reading its existing approved external data.
Adding this worker changes neither public API routes nor reader-time publisher
access. Scheduling remains external to the voter application; one daily run is
sufficient while a reviewed election publication is being monitored.

## Native Measure Review

The [native preparation adapter](../maui-measure-guide-preparation.md) now binds
short conditional interpretations to exact question and resolution hashes. Eight
county questions can become native measure and contest records, with original
official text, PDF-page citations, draft workflows and machine-verifiable
provenance. New or changed material remains an editorial exception. Publication,
import and scheduling approvals remain separate.

Resolution 25-217, CD1 illustrates why the original legislation matters. Its
proposed section 13-18 excludes the first day and includes the last; when the last
day is a weekend or holiday, the period runs until 4:30 p.m. on the next business
day. Specified dates and section 4-3.3 are excepted. The prepared explanation
describes that endpoint rule rather than suggesting all intervening weekends are
removed from a period. It retains the official question verbatim alongside that
explanation. Original question pages and legislative text remain the evidence.
