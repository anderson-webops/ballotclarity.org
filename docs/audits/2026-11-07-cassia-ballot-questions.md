# Cassia ballot-question integration

The maintained Cassia collector previously retained question inventories outside
the public snapshot. It now supplies full official wording and choices to the
existing question list and detail pages, with question-specific publication links.
This extends the existing recurring general-election source rather than adding a
year-specific collector or embedding election data in the repository.

The retained 2026 evidence contains four statewide questions, including one
six-option advisory, an American Falls Joint School District No. 381 levy and a
Rock Creek Rural Fire Protection District levy. Ten printed occurrences reconcile
to six distinct questions. The original 39 candidate records, document hashes and
capture timestamps remain unchanged. Earlier custody and substantive approval
remain separate from this source integration.

School wording retains the published spending disclosure and tax estimates.
Fire wording retains the complete question and tax estimates. The PDF watermark,
page furniture and duplicated microscopic disclosure layer are excluded from
display. Each question cites its actual offered PDF and page; legacy sources
continue using their existing citation behavior.

Stored validation binds wording, choices, scope and source URL to question IDs.
Contradictory repeats, invalid fields, changed accepted wording or choices and
missing accepted questions require review while preserving the prior snapshot.
Future-cycle tests use synthetic 2030 publications and maintain separate cycle
identities, district scope and original clocks. They establish reusable behavior,
not availability of actual future publications. Existing publisher-policy and
bounded-collection requirements remain in effect.

Future candidate-only publications retain their candidates with an empty question
inventory. An accepted question inventory disappearing still requires review.

The current reader accepts both candidate-only and question-bearing snapshots.
Older readers require their exact prior snapshot for rollback. Host substantive
review, import, publication, geographic assignment, recurring scheduling and
runtime/data rollback acceptance remain separate operator milestones. Judicial
retention candidates remain candidate records rather than duplicate measures.
