# Candidate background integration

Reviewed November 2, 2026 against retained Fulton official records and normal
public campaign captures. Production import and activation are separate.

## Gap

Official candidate pages previously exposed linked current-office person profiles
but not independently stored election-reference biographies. Reference-only search
results could duplicate a person without sharing their substantive background.
Official detail lookup also depended on a name hint and paginated directory reads.

The direct detail route now joins reference facts using exact state, election,
identity, scope and district checks. Local matching requires an explicit matching
jurisdiction and office. It preserves candidacy, party, source provenance and
geographic applicability rather than inferring them from a biography or photo.

## Campaign summaries

Two short, candidate-provided backgrounds were prepared from:

- [Rick Jackson's campaign biography](https://rickjackson.com/about/):
  commission-based sales, subsequent purchase of his employer and the campaign's
  account of businesses operating nationally.
- [Keisha Lance Bottoms's campaign biography](https://www.keishaforgovernor.com/bio):
  prior Atlanta public offices and her White House public-engagement role.

The summaries omit promotional evaluations, whole biographies and photographs.
Campaign attribution distinguishes self-report from official qualification data.
The reference snapshots retain original capture dates and document hashes.

Both sites returned normal HTTP 200 responses. Captures were spaced at least
eleven seconds apart per host. Jackson's WordPress policy/biography content uses
an exact `entry-content` region rather than a nonexistent main. His linked
[messaging terms](https://rickjackson.com/terms-and-conditions/) govern SMS; they
were not treated as a general permission to republish website material.
Privacy, messaging and robots content/link fingerprints remain review gates.

The new preparer makes these summaries repeatable with frozen approved facts and
meaningful-content hashes. Changed content holds for review instead of silently
replacing an accepted summary. This supports routine collection without claiming
that every candidate, future cycle or publisher is already enrolled.
