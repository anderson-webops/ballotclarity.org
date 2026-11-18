# Managed Lafayette guide preparation

`manage-lafayette-guide-automation.js run PROFILE.json POLICY.json` composes
[collection](lafayette-guide-collection.md) and
[measure preparation](lafayette-measure-guides.md). Compatible offered editions
reuse the collection profile. Each acquisition supplies its current source pins
automatically, so routine refreshes need no manual path or capture-hash edits.
`inspect PROFILE.json` verifies retained state and proposal/source hashes without
publisher requests.

Use absolute physical owner-private profile and policy files. The profile is the existing
collection plan. The policy contains exactly `schemaVersion: 1`,
`type: "lafayette-guide-automation-policy"`, `profileSha256`, `intervalMs`,
`cohorts` and `baseSnapshot`. The interval ranges from one hour to seven days.
Each of at most twenty-five cohorts supplies an explicit `electionDate`, a pinned
editorial `review` or null, and the separately pinned call `documents` accepted
by the existing preparer. `baseSnapshot` is null for standalone proposals or an
exact reviewed snapshot pin. Policy and input hashes are checked before collection
and enrollment is rechecked before accepting a proposal.

The collector's output root holds original intakes. Its private
`measure-automation/` directory holds immutable proposal runs and an atomic
`state.json`, including the last attempt, latest complete proposal and previous
complete proposal. Original capture clocks and editorial approval dates remain
distinct from operational attempt times. Matching source content retains the
previous proposal rather than refreshing its editorial clock or duplicating its
guide outputs.

New elections without reviewed call/editorial evidence retain their complete
research capture and a review-required receipt. Missing offered guides are
recorded explicitly in operational state. Neither outcome replaces a complete
proposal. Publisher, policy, converter and input failures retain earlier proposals
and defer repeated attempts for the configured interval. An interrupted started
receipt is identified as incomplete, then recorded as a deferred failure by the
next exclusive owner; the receipt alone makes no process-liveness claim.

Inspection rejects modified original captures, proposals and redirected storage.
The shared output root is bounded to 256 MiB, 8,192 files and six directory levels;
capacity exhaustion requires owner-reviewed archival, preserving saved evidence.
Preflight reserves 128 MiB and 1,024 entries for the next bounded attempt before
contacting publishers, and verifies the total again before accepting a proposal.
Preparation metadata is bounded to 128 KiB. Existing source transport, native
converter and proposal bounds continue to apply.

The command prepares review material. Publication, automatic import, final-ballot
and amendment review, personal applicability, recurring host scheduling and
protected activation retain their independent approvals. It installs no timer
and changes no active snapshot or public route.
