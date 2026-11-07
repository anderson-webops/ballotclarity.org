# Independence city candidate collection

The [City of Independence election index](https://www.ci.independence.mn.us/government/elections)
independently publishes five named 2026 city-council candidates. The city section
and its separate November 3 general-election heading establish the election and
office context. These are references accompanying candidate video statements,
not a certification, complete Minnesota slate or personalized ballot.

## Reusable collection

`mn-independence-city-2026` uses policy-bound HTML discovery and external atomic
snapshots. The collector reads the actual general-election date and matching
candidate-section year. Compatible future editions receive dated source IDs
without changing the URL or guessing the next election. Unannounced years,
changed offices, conflicting dates and unfamiliar structures require review.
Explicit pending notices remain awaiting publication rather than empty imports.

The current five names are JonPaul Story, Hal Tearse, Brad Fisher, Cathy Iverson
and Edward L. Genereux. Only Brad Fisher is explicitly marked incumbent. Party,
qualification, vote limits, winners, and eligibility remain unstated. Ballot
previews are disabled for this statement-list source. The separate four-PDF,
78-record reviewed sample source and its original provenance remain unchanged;
the two sources are not silently merged or substituted for each other.

Hal Tearse's statement label is split between two different video URLs. The
collector preserves the clearly named candidate block but publishes neither
video as an established personal website or selected statement. No video,
transcript, image or thumbnail is downloaded or republished.

## Access and evidence

Normal identified requests on November 7, 2026 returned HTTP 200 for the city
robots file, election index, and both linked policy documents. Requests were
spaced at least eleven seconds apart. The robots rules permit these paths;
the linked SMS terms and privacy policy contain no applicable factual-extraction
restriction. This review establishes no general license for publisher prose,
artwork, photographs or videos.

| Evidence | SHA-256 |
| --- | --- |
| Original election HTML | `5a53ab8c07a7cbc4685827b19332094c5c884dd2da87d780700cf1f1f734c1cd` |
| Robots | `7986a0c78bc01f545fbd6c76d9406f0e9e0e6ebf8b5ba1e25600f367fe05c2ca` |
| Original SMS terms | `fededc511c7d1bd409d4856da89221fc233cf0ebcbfadb4be4e1d6bf8ab9b997` |
| Original privacy policy | `229cc95c5db0233a6ab116b02ffb53d524db8f9174bdd073b7725dbc533f116a` |

The acquisition clock is `2026-11-07T02:19:56.850Z`, distinct from the printed
election date. Each refresh checks normalized robots, policy-content and footer
legal-link fingerprints before accepting the candidate page. Changed policies,
denied requests, removed accepted candidates and persistence failures preserve
the accepted data for review. Stored reads need no publisher request.

Current and future-cycle tests cover strict provenance, complete candidate blocks,
explicit incumbency, party omissions, pending publication, repeat/restart reads,
archived-catalog preservation and outages. Synthetic future elections are test
fixtures, not evidence that a future election or candidate list is published.
Host enrollment, import, publication and scheduling remain separate decisions.
