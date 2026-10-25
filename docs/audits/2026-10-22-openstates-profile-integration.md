# Per-profile Open States evidence

## Scope

The preceding [research review](2026-10-22-openstates-profile-enrichment.md)
identified useful role dates and short professional fields in the independently
published CC0 People repository. The existing reference contract could not
honestly attribute YAML-only facts to a state CSV. This change adds a strict
provider-specific member-document contract and an offline enrichment command.
It does not add another collection or duplicate people in the interface.

The local 32-state cohort retains all 1,495 existing profile IDs and adds
1,589 fields: 1,463 recorded role-start dates and 126 occupation, profession or
education fields concerning 97 people. The supporting source for every profile
becomes its exact immutable repository member, not the CSV landing page.

## Provenance contract

- Existing configured documents remain an exact, ordered prefix. Their URLs,
  configuration fingerprints and legacy CSV-only cache envelopes do not change.
- Only the recognized Open States CSV collections may append member documents.
  Each member requires the current member-policy fingerprint, full repository
  commit, person UUID, state-specific current-legislator path, archive hash,
  original member hash and capture time. Arbitrary URLs are not accepted.
- Member URLs are derived from that validated identity. A member contributes to
  exactly one record, whose deterministic ID must match the collection/person
  identity. Wrong states, UUIDs, document contributions and unsupported scopes
  fail closed. Member evidence is included in the snapshot source digest.
- The public source link and retrieval time come from the actual member. The
  snapshot retains the original CSV capture as identity provenance and uses
  the earliest contributing capture time, not preparation time.
- Contribution checking is linear in documents plus records, rather than
  repeatedly scanning every record for each appended document.

New code reads both old CSV-only and enriched snapshots. Older code that does
not implement this member contract rejects enriched snapshots. The retained
CSV-only baseline is necessary for a data rollback to that earlier contract;
matching-source/data acceptance remains a separate release gate.

## Preparation and quality

`enrich-openstates PLAN.json` accepts a pinned local archive, reviewed CSV-only
reference files and an exclusive external output directory. Native cache
envelopes require the exact configured-source fingerprint; bare snapshots also
remain supported. It reads the original archive again, rather than treating
the research CSV as application-ready data. It neither downloads nor imports.

Archive parsing is streamed, without filesystem extraction or code execution.
Limits are 32 MiB compressed, 128 MiB expanded, 50,000 entries and 256 KiB per
selected member. Traversal, links, unsupported entry types, duplicate members,
ambiguous person files, truncated gzip and a missing CC0 dedication are rejected.
YAML parsing rejects duplicate keys, unsupported tags and aliases. The parser
uses the documented [streaming archive API](https://github.com/mafintosh/tar-stream)
and [YAML safety options](https://eemeli.org/yaml/).

The preparer rechecks the same person, normalized exact name, state, chamber and
literal district. A future role end remains current as of the actual capture;
ended or conflicting roles do not become current-role facts. Conflicted or
missing people are excluded with explicit holds, not scored or guessed. Mixed
states/elections cannot collide inside one preparation run.

The current real archive yields all 1,495 matched profiles. Its 429 holds retain
395 historical roles for independent review, 32 unknown start dates and two
absent occupation values. The known April Weaver historical chamber/district
conflict is not promoted. Past-role labels never become new public facts.

Professional fields remain publisher-listed structured values, not verified
credentials or employment claims. They use concise "Listed" labels and the
existing public-dataset attribution. Degrees and abbreviations are not expanded
by inference. Contacts, personal dates, full biography prose, family, religion,
photographs and unrelated extras are omitted. No record is promoted into an
official candidate roster or a personalized ballot assignment.

## Local acceptance

- Source and compiled commands produce 35 byte-identical prepared files from
  the actual retained archive and 32 reviewed base collections.
- Every member hash and every additional field agrees with the independently
  checked research projection. All names, IDs, offices, scopes and districts
  remain unchanged; no duplicate cards are introduced.
- The isolated local API serves all 1,495 enriched profiles with correct member
  citations. The combined 94-collection fixture retains 2,035 profiles and has
  4,222 facts, compared with 2,633 before enrichment.
- Source/cache rollback, restoration and tampered-member rejection preserve
  accepted data. Original candidate captures are not relabeled as newly fetched.
- Mobile/dark and desktop/light rendering, accessibility and overflow checks
  cover all 32 enriched states plus six directory views. Additional facts stay
  on detail pages, not the compact directory rows. No extra interface controls,
  instructions, banners or colored dates are added.
- Rendering identified a repeated district when an office title ended in a
  qualifier such as "(Multi-County)". The shared label helper now omits that
  duplicate while retaining the complete office title and distinct districts.

## Delivery status

Data, raw captures, private instructions and recovery stay ignored and outside
runtime/release assets. Existing canonical data is retained separately. The
current source is locally changed only: no commit, push, tag, publication,
private transfer, active-data import, host configuration or scheduling occurs.
The repository-archive downloader is not automated by this offline command;
the preceding collector still prepares the separately configured state CSVs.

The narrowly added parser dependencies and both lockfiles pass clean installs.
A current root dependency audit also reports four moderate advisories in
unchanged pre-existing Nuxt/ip-address packages. They are not marked clean or
waived and remain a separate gate before dependency/source publication. No
unrelated front-end dependency update or security-gate bypass is included.
