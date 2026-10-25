# Alaska judicial evaluation details, October 23, 2026

## Content and attribution

The [Alaska Judicial Council's current 2026 index](https://ajc.alaska.gov/retention/current2026.html)
and [September 4 updated report](https://ajc.alaska.gov/retention/docs/pr_2026_ret_recommendations_UPDATED.pdf)
still match the exact bytes retained in the earlier research. Their 21 records
comprise eighteen retention recommendations, two recommendations against
retention and one explicit absence of an institutional finding/recommendation.

The new detail block is headed “Alaska Judicial Council evaluation.” It identifies
the Council's recommendation, attributed criteria when supplied, publication
date and exact report page. It is separate from biography, candidate statements
and Ballot Clarity voting advice. Directory rows gain no recommendation badges,
buttons or expanded content. Existing judge detail links remain the entry points.

Marianna Carpeneti's no-recommendation state remains distinct from a negative
recommendation, despite the reported individual member votes. Unquantified
unanimous counts remain null in prepared data. Member counts are not returned
by the public endpoint or converted into an institutional finding. Full
individual evaluations and raw survey/case narratives are not republished.

## Exact identity and publication gates

`official-judicial-evaluations` is a distinct bounded data contract. A configured
source binds issuer, state, election, official roster source and report/index
URLs. Records bind exact official IDs, names, offices, canonical statewide/local
scope and printed court labels. The complete record set is checked against the
pinned roster before any individual evaluation is returned. No fuzzy name or
geographic eligibility match is performed.

The research roster hash identifies the complete serialized 155-record file;
the runtime roster digest identifies its source-document aggregate. Both remain
distinct and verified. Original October 21 roster and October 22 Council capture
clocks are preserved. Fresh identical downloads are recorded separately, not
used to rename those captures or invent individual evaluation dates.

Prepared snapshots carry an unreviewed, null-reviewer/null-date publication
record. A public response requires an approved reviewer/date record bound to
the exact content digest. Mismatched documents, identities, roster, review digest,
source dates, findings or reviewed pages fail closed. In-checkout storage,
symlinked files and aliased application directories are rejected. Election expiry
is enforced independently of source-file presence.

The readonly endpoint is
`GET /api/judicial-evaluations/:stateCode/:recordId?source=:officialSourceId`.
It retains public throttling and no-store responses. Missing or unapproved data
returns 404 without an invented evaluation block; malformed/unavailable approved
data returns 503 while the candidate record remains readable. Data is read from
the existing external `STATE_BALLOT_DATA_DIR`, not embedded in releases.

## Access, preparation and verification

Normal bounded, verified-HTTPS requests return 200 for the Council homepage,
index and exact updated report. The current robots response is an empty 404.
The existing automatic document collector requires a reviewed robots document,
so no new Council raw collector or scheduler is enabled and all fifteen existing
configurations remain unchanged. This is not a finding of a legal prohibition
or a blanket reuse license. The separate election-office TLS hold remains intact.

The seven-page report is unrestricted for extraction; reviewed substantive
citations remain within pages 1–4. Page 1 establishes the report's September 4
publication date, not individual evaluation/decision dates. Current source bytes
match the retained index/report hashes, and all 21 exact official joins are
rechecked. JSON and a 21-row CSV preserve three institutional states, unknown
counts/dates and attribution; a separate four-member archive contains only
structured review data, manifests and checksums. The canonical publication
record remains unreviewed.

Source/compiled repositories verify all 21 identities, hide unreviewed data and
reject changed roster bindings. Connected API checks cover all 21 records under
both publication fixtures. Forty-four light/dark, narrow/wide rendering and
accessibility cases cover positive/negative/no recommendation, the statewide
judge, unchanged directory rows, ordinary candidates, missing exact IDs and
temporary evaluation failure. Eight keyboard detail journeys pass with zero
publisher requests. Fixture approval stays isolated from canonical data.

Initial checks caught a serialized-file/source-aggregate hash mix-up, use of
`state` instead of the existing `statewide` scope, formatting issues and a typed
assertion overload. These were corrected with original diagnostics retained;
no rejected preparation wrote canonical outputs. All work remains local, with
source delivery, private transfer/import, publication and production acceptance
separate from this implementation and verification.
