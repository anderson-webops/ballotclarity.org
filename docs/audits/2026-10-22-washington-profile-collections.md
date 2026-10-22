# Washington additive profile collections

## Scope and identity

The existing 887-record official Washington dataset identifies four Legislative
District 1 House candidates: Davina Duerr and Maggie Wang in Position 1
(`186957/1601909`, `186957/1601910`), Shelley Kloba and Cliff Moon in Position 2
(`186958/1601911`, `186958/1601912`). All four exact names, positions and public
guide links reconcile. No Senate, county or complete legislative slate is claimed.
These are additional profiles for existing official identities, not new ballot
choices or personal eligibility assignments.

`wa-ld1-statements-2026` adds four profiles and twelve short background facts.
The ten preceding configurations, their fingerprint-bound snapshots and original
capture dates remain unchanged. Washington's twenty congressional profiles are
not renamed or replaced. Eleven reference collections across ten states now
retain 92 profiles and 248 factual items, separate from official records.

## Public source review

Ordinary verified HTTPS used a stable descriptive agent, bounded responses and
spaced requests. The exact VoteWA policy path returned 404 at
2026-10-22T06:15:51.566Z, without a restrictive policy. The Secretary of State's
robots file and [reuse notice](https://www.sos.wa.gov/web-sites-privacy-policy)
returned 200 and were reviewed, including third-party copyright qualifications.
Candidate essays and photos are not assumed to carry a blanket public-domain
license. Only short attributed factual summaries are exported.

The [candidate list](https://voter.votewa.gov/CandidateList.aspx?e=899) returned 200
at 06:24:33.597Z. Its actual election selector is GENERAL 2026, November 3,
election 899. A separate blank county selector was not mistaken for another
election. Four actual candidate links were observed anew. An unavailable earlier
raw envelope was not used as proof.

The [public guide](https://voter.votewa.gov/genericvoterguide.aspx?e=899&c=) returned
200 at 06:24:33.858Z. Its actual linked application, captured at 06:26:17.891Z,
establishes the normal-mode `candidate.ashx` contract: election/race, `b=0`,
`la=en`, empty county. The page sets preview mode false. No preview flag, voter
identity, address, private provider or candidate-submission account was used.
The normal public client does not gate these returned entries on an
`IsApprovedForPost` field; the review follows the actual published guide links
and normal-mode response, not an inferred preview permission.

The two public race responses returned 200:

| Race | Capture UTC | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `186957` | 2026-10-22T06:27:17.049Z | 614,312 | `59daf446e806ca4e739b38018559f458210c4104529ff14e62f2ea0f41382df8` |
| `186958` | 2026-10-22T06:27:52.977Z | 1,805,642 | `b48219a38c78ace4e851fd00d8faa86e7ba4d7e20acef58c86f79c83f4ae41aa` |

The linked app SHA-256 is
`6f653df79e9da17f48d4312f8f666f317dbe2b81e585b43230a80718f6b1dd72`.
Raw envelopes, encoded photos and contact-bearing material remain local review
evidence, never Git, runtime assets or the transfer package. No photo was decoded.
Denied exports, King County publications and private voter tools were not queried.
A candidate's description of King County volunteer work is not county-source
permission. Existing source exclusions remain intact.

## Editorial review

Every item remains candidate-provided, not independently verified by the state.
Duerr's appointment/council dates, architecture/board work and education; Wang's
business experience and election-observer volunteering; Kloba's legislative/
council service, health-care work and education; and Moon's construction/business
work, degrees and lecturing are supported by the captured fields. Kloba's Idaho
credential is a certificate, not a degree. Missing fields do not imply no
experience or education. Unknown publication dates, party endorsements, family
details, contact data, forecasts and campaign prose are omitted.

The only new interface sentence is operational partial-data feedback with Retry.
No introductory, implementation, collection-progress or configuration explanation
was added to the site.

## Integration and storage

The former state-only first-match reader would silently omit a second collection.
The repository now reads all configured collections for the earliest unexpired
election and isolates missing/corrupt files. Healthy collections stay visible
with `incomplete: true`; all missing remains unavailable, and failures without
healthy data return 503. States and elections never merge. The two-day UTC expiry,
external storage, atomic validation and no-network read path are unchanged.

Aggregation precedes global search/scope/pagination. Opaque record IDs remain
unchanged; additive `source.collectionId` supplies a compound UI identity.
The additive response `collections` lists configured IDs, not imported data.
Legacy injected repositories and single-source page builders remain supported.
Ambiguous `export WA` fails explicitly; `--source` selects one collection without
silently omitting another. Imports log source identity. Snapshot schema remains 1.

The new local cumulative package is 717,653 bytes and 45 flat members: 33 unchanged
reviewed official snapshots/17,662 records, eleven reference snapshots/92 profiles/
248 facts, and a manifest. Archive SHA-256:
`7311248776bb7c80d136c977d911a3e377c9ed49a7dc497d6914a74394603e7e`.
Manifest SHA-256:
`5b84673ec636d9e787567353cb955bc92814554a9e6be36f912d32707924172d`.
Five new factual/review files and archive/manifest/checksums add eight canonical
files, totaling 276. All previous 268 files and five preceding packages survive.
Research CSV/JSONL are not application importer inputs. No source-agent upload,
production import, scheduler installation or server administration is performed.

## Local acceptance

- Locked root and standalone back-end installs; configured lint/format checks,
  typecheck and both builds pass. No dependency or lockfile change.
- 763 unit checks pass; two existing optional PostgreSQL checks skip. Twenty-one
  integrated smoke tests and 48 core accessibility renders pass.
- Actual-data integration passes 99 API cases and eighteen additional rendered
  accessibility cases with no violations or horizontal overflow. Mobile six-theme,
  desktop, legislative scope, partial failures and recovery were reviewed;
  representative combined/legislative/partial screenshots were visually inspected.
- The compiled commands import all 33 reviewed official snapshots and round-trip
  all eleven reference snapshots. WA returns 24 profiles, twenty congressional,
  four state-house, correct source identities and one Duerr search match.
- A separate, explicitly synthetic 59-record collection tests the 50-row boundary
  and an intentional cross-collection opaque-ID collision. Keyboard Next returns
  the correct nine records without duplicate-key/hydration errors. These are not
  collected profiles or exported data; original collections are restored afterward.
- Independent missing/corrupt tests retain either twenty old or four new WA
  profiles; all corrupt returns 503 while 887 official records remain available.
  Restored imports recover through Retry without restart. Keyboard focus returns
  to the heading only if the reader has not moved it elsewhere.
- NC/NM/AK/OR/UT/AZ/NV/WA official counts stay 39/46/155/279/255/207/254/887.
  Synthetic state-only previews stay 12/18/18/7/7/23/18/10. Profiles never enter
  personal lookup. The official test clock is controlled without rewriting source
  captures or relaxing runtime freshness. Publisher/provider network is blocked.
- Full/production audits report no vulnerabilities; 1,227 registry signatures,
  444 package attestations and fifteen native-binding entries verify.

Initial lint diagnostics were fixed through the configured formatter and narrow
newline/parenthesis corrections before the final complete pass. Temporary external
stores and test services are removed. Publication, protected runtime acceptance,
public code activation and approved operator data import remain separate gates;
the final source-local release receipt records their actual outcomes.

Current operating instructions and approved transfer/import prerequisites are
retained in a local-only operator handoff. Further state/local collection
remains unfinished, without weakening denied-source or personal-matching gates.
