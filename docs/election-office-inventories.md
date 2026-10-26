# Scheduled office inventories

The office-inventory collector supplies an independent check on candidate-source
coverage. It collects office descriptions, not candidates, nominees, officeholders,
personal ballot styles or election results. Its output is separate from candidate
and measure imports. No public page or coverage percentage is added.

## Hennepin County

The county publishes a rolling [offices-on-the-ballot list](https://www.hennepincounty.gov/services/elections/offices-on-the-ballot).
The normally validated capture on October 26, 2026 prints a September 2 update
and November 3 general election. Its 92 list rows contain 91 office descriptions
and one separate constitutional-amendment reference:

| Group | Office rows |
| --- | ---: |
| Federal | 2 |
| State | 6 |
| County | 4 |
| City | 38 |
| School district | 13 |
| Judicial | 28 |

Some rows aggregate multiple districts, offices or seats. These counts are not
counts of individual contests or people. Judicial parenthetical names are omitted
from the derived inventory because this scheduling list does not establish their
candidate or incumbent status. Local special-election, ward, seat and school
question context remains in the published office descriptions. An amendment link
does not become a measure record or authorize acquisition from the linked host.

Comparison expands only explicit federal and nonjudicial state office/district
keys. Lettered House districts remain distinct. The current list yields 59 keys;
the selected, previously reviewed 78-record Minnesota snapshot represents eight.
The other 51 keys are not represented **in that selected snapshot**. This is not
an assertion that 51 candidates are missing from all sources. The other 83 printed
rows have no reviewed comparison mapping and remain unassessed. Missing or
different-election candidate inputs produce an explicit unconfigured or
not-current status, rather than a misleading healthy zero.

## Collection and storage contract

The compiled entry point is `back-end/dist/manage-office-inventories.js`:

```sh
node back-end/dist/manage-office-inventories.js collect \
  --directory /absolute/external/office-inventories \
  --candidate-snapshot /absolute/external/candidates/minnesota.json
node back-end/dist/manage-office-inventories.js export \
  --directory /absolute/external/office-inventories --format csv
node back-end/dist/manage-office-inventories.js audit \
  --directory /absolute/external/office-inventories \
  --candidate-snapshot /absolute/external/candidates/minnesota.json
```

`prepare --capture /absolute/capture.json` accepts a retained, policy-bound source
capture without a network request. `export` reads the accepted envelope as JSON or
CSV without changing clocks. Repeated `--candidate-snapshot` inputs must be
distinct configured Minnesota sources. Omitting them intentionally records that
no candidate input is configured. Snapshot identities, provenance, dates, record
fields and active statuses use the existing candidate validators.

The collector checks the exact canonical county robots, homepage legal footer
and linked privacy policy before requesting the office publication. Requests use
the existing pinned public-HTTPS transport, normal certificate validation, a
2 MiB response bound, 25-second timeout, zero redirects and serial robots-aware
spacing of at least 11 seconds. The old `www.hennepin.us` robots URL offered a
301 to this canonical county domain during source review; no denied route is
substituted. Only the exact copyright-year token is normalized in the county
footer fingerprint. Other legal text, legal links, policy or unknown layout
changes stop collection. The reviewed privacy policy supplies no blanket
copyright license; this feature extracts factual office descriptions.

Supported later elections use the date actually printed on the rolling page.
A synthetic 2028 fixture tests rollover, not the existence of a 2028 candidate
list. No annual URL guessing, nominee prediction or policy-bypass option exists.

One bounded JSON envelope in the external source directory binds the original
capture, inventory, audit, policy receipts and hashes. Cached capture/import
times remain unchanged when source bytes are unchanged. Only an actual incoming
capture advances the source-check clock; a new candidate comparison has its own
audit clock. Replaced inventory/audit envelopes have content-addressed history.
Exclusive writer locks, atomic replacement and symlink rejection preserve the
last accepted state on invalid, concurrent or older updates. An interrupted
writer's retained lock requires ownership/recovery review before another writer.
Scheduling uses the existing authorized host scheduler; this source change does
not install a schedule or activate production collection.

## Other source reviews

- Portland, Maine: normal certificate validation fails at robots. New collection
  remains held without a trust-setting change or alternate identity.
- Massachusetts: existing restrictive collection terms remain unresolved; the
  current front page also returns a challenge wrapper. No challenge execution,
  candidate-page request or alternate route follows.
- Cambridge: its [disclaimer](https://www.cambridgema.gov/disclaimer) limits
  intended use to individual noncommercial use and requires prior consent for
  commercial republication. Permission for new automatic public-service reuse
  remains unverified; existing accepted facts and clocks are unchanged.
- South Portland: merged AI-specific robots groups require review. Search
  snippets are not imported, and no mobile equivalent substitutes for a
  restricted page.
- Alabama: the retained statewide-policy access hold remains; no repeated
  denied-host request or new import follows. Franklin County, Ohio's ordinary
  robots 404 does not itself supply a new candidate source.

These source-specific holds do not affect the independent county inventory or
authorize weakening shared collection safeguards.
