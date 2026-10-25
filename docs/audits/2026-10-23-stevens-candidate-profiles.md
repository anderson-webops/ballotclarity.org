# Stevens County candidate-statement integration

## Scope and evidence

Five previously reviewed Stevens County profiles now have a maintained reference
source, `wa-stevens-statements-2026`. The thirteen factual paraphrases cover Lori
Larsen, Eric Simpson, Michelle Enright, Mark Burrows and Jack Griffin Jr. They
remain attributed candidate-provided background, not independently verified
credentials, ballot certification or personalized ballot assignments.

This work reuses the four retained normal public VoteWA responses captured on
October 22, 2026. It makes no new publisher requests and does not recertify the
887-row official candidate roster. Original capture timestamps, document and
statement hashes, official record IDs and race/candidate IDs are preserved.
Campaign statements, contact details, photos and raw factual quotations are not
included in the prepared application snapshot or small private transfer packet.

The configured documents are election 899 races 186880 through 186883 at the normal
`voter.votewa.gov/elections/candidate.ashx` endpoint. Each has a corresponding
official voter-guide link. No blocked endpoint, larger response bound, alternate
identity, private mode or neighboring county is used.

## Explicit local contract

The roster's literal `County` label is not globally equivalent to the pamphlet's
`Countywide` label. This source explicitly binds `CountyDisplay=Stevens`,
`RaceJurisdictionTypeID=CTY`, `RaceJurisdictionName=Countywide`, the observed blank
`CountyCode`, local official scope and literal roster `County` label. Exact
election, race, candidate, name, office and accepted official status still must
match. Missing or conflicting county/type fields fail closed, including on an
unreviewed entry in the same response.

Only this compiled source context permits the mismatch. Unbound local profiles
are rejected even if their labels happen to match. Existing statewide and
legislative comparisons remain strict. Preparation receipts retain both labels,
the published county/type, original official IDs and statement hashes. No county
code, FIPS, commissioner-district boundary or voter eligibility is inferred.

Import validation independently requires local scope and `Stevens County` for
this collection. The persistent cache fingerprints the entire source context;
changing its county invalidates a mismatched cache. The collection is optional,
so missing or corrupt local data cannot hide healthy Washington collections.

Rick Johnson remains a review hold with no invented background. Gene Healy's
Wahkiakum response is outside this source. The retained race 186884 response-size
hold and all other publisher/access restrictions remain unchanged.

## Local acceptance

- Source and compiled `prepare-washington` commands produce byte-identical
  five-profile/thirteen-fact snapshots and identity receipts without fetching or
  importing active data. The four document contributions are zero, two, one, two.
- Cross-county namesakes, absent/conflicting county/type/code fields, unbound local
  labels, scope/identity/office/status drift and wrong-county imports are rejected.
  Duplicate profiles and evidence/hash drift retain their preceding safeguards.
- A disposable combined import contains 95 collections, 2,040 profiles and 4,235 facts.
  All 887 retained Washington candidate rows remain exact. Missing/corrupt optional
  caches recover without restarting or overwriting healthy preceding collections.
- Full lint, typecheck and both builds pass with 99 compiled backend modules.
  The full unit suite passes 895 tests with two existing optional PostgreSQL skips;
  the built-app browser suite passes 21 tests and 15 native binding entries pass.
- All 24 actual-data render/accessibility cases pass at 320/1280px in light/dark
  modes, with no WCAG A/AA violations, horizontal overflow or browser errors.
  The whole-row keyboard link and return link work. Three representative images
  were visually reviewed. Rows remain name plus one supporting line; full facts
  and source evidence stay on the detail page. No extra interface copy is needed.

Candidate API freshness is reviewed at the retained candidate capture time in a
disposable fixture, not relabeled as a fresh current download. Production clocks,
TTL, imports, schedules, services, permissions and configuration are unchanged.

These are local source/data results, not source publication or live activation.
The separate frozen release candidate and its unresolved registry-provenance
gate are untouched. Matching source integration, protected artifact acceptance
and separately authorized private-data handling remain outstanding.
