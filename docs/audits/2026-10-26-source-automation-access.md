# Remaining source access and collector failures

## Current access evidence

Normal, public-address-pinned requests on October 26 use the existing importer
identity and default Node 24 TLS validation. Challenge resources and denied paths
are not requested. These observations describe the tested source-agent context,
not every possible browser or receiving-host configuration.

| Source | Verified outcome | Consequence |
| --- | --- | --- |
| [Yavapai election publications](https://www.yavapaivotes.gov/Elections/Sample-Ballots-Voter-Guides) | Canonical robots request returns 403 | No index, notice or PDF is fetched. Pima and court robots respond independently; that does not establish acceptance of the combined six-document source. The 207 reviewed records remain unchanged. |
| [Pennsylvania candidate database](https://www.pavoterservices.pa.gov/ElectionInfo/ElectionInfo.aspx) | A 1,030-byte HTTP 200 response contains a challenge-only Incapsula frame and no election controls | This resolves the earlier ambiguous wrapper diagnosis. The frame is not followed and the 442 reviewed records are unchanged. |
| [Minnesota candidate finder](https://candidates.sos.mn.gov/) | Index and linked semicolon-file specification load; the offered general-election export postback redirects to `validate.perfdrive.com` | No verification endpoint or alternate export path is requested. Reachable filing controls do not prove that a general-election dataset was collected. The local export is not attempted after the state export stops. |
| [Alaska candidates](https://www.elections.alaska.gov/candidates/?election=26genr) and [West Virginia candidates](https://candidates.wvsos.gov/regular) | Default Node certificate validation fails during canonical robots retrieval | No candidate request or trust override follows. This is not a claim that TLS fails for every client. |
| [New Mexico candidate portal](https://candidateportal.servis.sos.state.nm.us/CandidateList.aspx?cty=99) | Current robots explicitly denies the root for GPTBot, ChatGPT-User and OAI-SearchBot | Source-agent retrieval stops before the candidate page. Wildcard rules for other clients are not substituted for the named restrictions. This is separate from an independently authorized runtime's access assessment. |
| [Philadelphia candidates](https://votes.phila.gov/voting/candidates-for-office/) | Candidate HTML is readable, but its linked [city terms](https://www.phila.gov/terms-of-use/) restrict modified republication and require permission outside a narrow resident-sharing allowance | Discovery is retained without importing candidate records or enabling a collector. This is not a blanket public-domain or automated-reuse permission. |
| [Allegheny candidate resources](https://www.alleghenycounty.us/Government/Elections/Candidate-and-Municipality-Resources) | Canonical robots request returns 403 | Search-discovered spreadsheet links remain leads, not downloaded or accepted records. |

The Pennsylvania, Minnesota and Philadelphia robots requests return HTTP 404.
No robots file is accepted from those responses. This is not proof of permission,
successful collection or a site-wide access ban. Subsequent challenge
and linked-policy outcomes remain distinct.

## Retained PDF fidelity

All four retained Independence PDFs match their accepted hashes but contain no
readable native text. Monroe's retained certification also matches its accepted
hash and has no readable native text. Woodward's earlier October 26 comparison
already established the same limitation; its completed collection is not repeated.

Two retained New Hampshire PDFs contain text, but Bristol's extracted name
`Ghris Pappas` disagrees with its visible `Chris Pappas`. Alton is image-only.
Readable character counts alone therefore do not establish trustworthy native
candidate extraction. Existing reviewed records remain authoritative; no OCR
names, inferred nominees or new personal-ballot assignments are published.

## Collector behavior

Bounded text and document readers now recognize the observed small,
challenge-only Incapsula wrapper before source parsing. The shared error contains
neither the incident identifier nor its URL, address or query tokens. State-source
operations identify an access challenge rather than suggesting that election
columns changed. The error does not solve a challenge, follow its frame, alter
the request identity or change certificate checks.

Detection is deliberately narrow: the known main-frame marker, unsuccessful
incident message, HTML content type and wrapper structure are required. Normal
application pages, security documentation, plain text and binary documents keep
their existing behavior. Other challenge formats still encounter existing source
validation; this is not a claim to recognize every access-control product.

Regression coverage verifies no additional request, typed text/document failure,
unchanged reviewed bytes and capture clocks, retry cooldown and ordinary recovery
when valid source data returns. Existing format, body, encoding, DNS, redirect,
publication and eligibility gates remain intact. This change adds no candidate
records or reusable source families and does not establish receiving-host access,
scheduling or deployment.
