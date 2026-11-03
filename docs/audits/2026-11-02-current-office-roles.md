# Current officeholder role checks

The voter-flow improvements remain in place: unified Search/Directory,
source-bound candidate profiles, grouped race summaries, compact deadlines and
native section links.

A fresh candidate-page review found a historical Open States record presented
as a current office, including a previous legislature's website. Name searches
had sent an unsupported `current=true` parameter and mapped missing roles to a
generic representative. That record prevented the existing Congress.gov
fallback from resolving the person's current federal office.

Current name, geographic and jurisdiction lookups now require a nonempty
`current_role`. An explicit historical search remains available. Original update
dates are preserved; an old update date alone does not disqualify a current role.
Historical results no longer block the existing federal or reviewed-local
fallback. Candidate records, portraits, sourced biographies and ballot
qualification remain independent of this officeholder check.

The [Open States API implementation](https://github.com/openstates/api-v3/blob/main/api/people.py)
supports name and jurisdiction searches, but no `current` parameter. Its
jurisdiction filter checks `current_role`, while name searches can return former
officeholders. The [API overview](https://docs.openstates.org/api-v3/) distinguishes
people from their current roles.

Regression checks cover missing, null, empty and blank roles; pagination;
preservation of current roles with older timestamps; explicit historical search;
and current federal fallback through the public representative API.
