# Voter flow consolidation

## Changes

- Search includes retained official candidate records, candidate references and
  current representative profiles. Candidate filters share the Search route;
  previous directory URLs preserve their filters through a redirect.
- Candidate records can show current-office information, sourced background,
  actions and links to fuller profiles and financial information. Bridges reuse
  existing identity, party, jurisdiction and district checks. Office held and
  office sought remain distinct; incumbency is not inferred from a portrait.
- Lookup race summaries reuse available portraits and reported incumbency.
  Federal, state and local groups reflect the source's office scope, rather than
  calling every state-published race a state office. Address and ZIP applicability
  safeguards remain unchanged.
- The election overview is the current-election destination for location pages.
  Official resources and election-office contact information remain accessible
  there. Desktop retains office-level anchors; mobile shows one next deadline
  and short section links before the candidates.
- Empty candidate-reference sections and generated profile-wiring commentary
  are omitted. Sources, legal notices, contact and accessibility remain reachable.
  The homepage and consolidated About page retain their existing structure.

## Fulton deadline compatibility

The reviewed November 3, 2026 polling close is 7 p.m. Eastern, which is
November 4 at 00:00 UTC after the daylight-saving transition. The source seed and
reviewed logistics snapshot already contain that instant. An older retained
publication can still contain 19:00 UTC with a contradictory 7 p.m. note.

Public election reads correct only that exact known legacy combination for
this election, without modifying retained source bytes or their hashes. The
response specifies America/New_York so display and passed/upcoming calculations
use election-local time, independent of the reader's location. Other elections,
notes and timestamps are unchanged. Original custody remains evidence; reviewed
snapshot promotion remains a separate protected data operation.

Official reference: [Georgia 2026 general election](https://georgia.gov/georgia-general-election-2026).

## Reliability

The local certificate test failure was reproduced with macOS LibreSSL 3.3.6.
Its default PKCS#12 encryption produced a bundle unsupported by the supported
Node runtime. The synthetic test now explicitly uses AES-256-CBC and SHA-256;
both system LibreSSL and Homebrew OpenSSL pass without enabling legacy crypto.

Browser-flow failures capture bounded exception, response-status and visible-page
diagnostics. Timeouts and existing security gates are retained. Release acceptance
records distinguish local checks, exact release assets, signed handoff custody
and protected deployment.
