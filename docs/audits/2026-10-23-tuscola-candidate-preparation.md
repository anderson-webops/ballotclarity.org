# Tuscola candidate preparation, October 23, 2026

## Source and scope

The Tuscola County election office's November 3 candidate listing and sample
ballot styles support a separate `mi-tuscola-candidates-2026` source. Its default
retrieval remains an externally stored, manually reviewed PDF snapshot.
`mi-dos-2026` remains Michigan's primary source. The previous 53 source
configurations are unchanged; the catalog now has 54 configurations, not 54
states.

The official listing's printed header is September 7, 2026. The retained listing
and sample were captured at `2026-10-24T01:12:54.881Z` and
`2026-10-24T01:12:43.322Z`. Those capture times are retained, not interpreted as a
new certification. Their respective SHA-256 digests are
`59f9f6d1f5e2222df9dd13f9b3f70cf8394b25000227045ce41b84f0525bd720`
and `9218c5ad62ee8746740a0cfbdddf57db662ec6c27a64e3852f08321970c4894d`.

The 196 printed person rows form 191 candidate/ticket records in 62 populated
contests. Five governor/lieutenant-governor tickets are paired choices, checked
against sample page 1. The records comprise 64 statewide, eleven congressional,
four state-senate, six state-house and 106 local entries. These are source
records, not unique people or complete personalized ballots.

## Extraction safeguards

- Candidate/party/status columns on all nineteen listing pages were visually
  reviewed. Household addresses, phone numbers and filing contacts are excluded
  from the derived CSV, snapshot and provenance exports.
- All 196 printed names occur in the retained sample. The cross-check uses NFKC,
  case, spacing and punctuation normalization, with no accent stripping, fuzzy
  identity joins or office/ballot-style inference. An alternate font initially
  omitted Cassie Piché; visual review caught it and the final extraction retains
  the name and accent. Five wrapped names retain their complete text.
- Literal party codes and six printed `(I)` markers are retained. Marker meaning,
  incumbency and qualification are not inferred. Blank withdrawal/status columns
  produce `listed`, not an invented status.
- Three explicitly empty contests produce no candidate records. The empty Akron
  trustee contest's printed negative vote limit remains a review anomaly, not a
  corrected factual claim.
- Township, village, school, library and judicial electorates are not assigned
  from county residence. Congressional and state-legislative scopes are withheld
  from automatic district previews; the source can contribute only its 64
  statewide records to those previews. Directory records remain independently
  reachable by exact source and record identity.

## Reusable preparation contract

`reviewed-candidate-preparation.ts` and its `prepare-reviewed-candidates.ts` CLI
consume a local plan, exact source-configuration fingerprint, reviewed CSV and
byte-pinned source PDFs. Every row has an exact configured document URL and a
reviewed page number. The CSV has thirteen allowed identity/scope/status/
provenance columns; extra contact columns, duplicate headers, duplicate contest
identities, invalid scopes/pages, changed inputs and linked/in-checkout output
paths fail before accepted output.

The output is a single JSON snapshot, separate NDJSON export, page-level
provenance CSV, review JSON, manifest and checksums. JSON snapshot consumers use
the snapshot file, not the line-oriented NDJSON export. CSV formula prefixes are
neutralized without changing snapshot identity. IDs remain stable across row
order and status updates while full/partial terms remain distinct.

Preparation makes no publisher request, import, approval or publication. Original
document clocks remain intact. Publication and automatic-import flags remain
false, and the manually prepared county source is not a scheduled collector.

## Local verification

Source and compiled preparation produce six byte-identical outputs. The previous
49 allowed captures and 24,891 rows remain unchanged; adding this source yields
50 captures and 25,082 rows across 48 states and DC, not 50 states or unique
candidates. All 716 primary
Michigan record IDs and original capture clocks remain intact. Historical
automatic-source test clocks are isolated QA fixtures, not renewed freshness.

Lint, type checks, both builds, twenty focused tests, 1,123 unit tests, 21
integration tests and 48 core route/theme accessibility checks pass. Two optional
database tests are skipped. Eight preparation tests cover input integrity,
identity stability, output isolation, Unicode, provenance and formula handling.

The connected built application passes 271 rendering/accessibility cases,
including every new record detail at 320px/dark and twenty representative records
in the other three viewport/theme combinations. Four keyboard source/search/
detail/document journeys and nineteen API cases verify pagination, source
selection, exact Unicode/record identity, missing-ID behavior and wrong-state
rejection. Both preview checks include only the 64 statewide candidates.

The final run uses ordinary in-app navigation and bounded pacing. An earlier
full-reload harness hit the existing contact-address rate limit, and an initial
in-app harness followed a link before refreshed results settled. Those diagnostic
attempts remain separate from the accepted run; neither application rate limit
was relaxed. Final browser errors, throttle responses, overflow and automated
accessibility violations are zero, with no publisher requests. Fresh mobile-dark
and desktop-light screenshots were visually inspected.

Prepared files remain separate from source/runtime artifacts. Local validation is
distinct from approved import, source release and independently verified public
activation.
