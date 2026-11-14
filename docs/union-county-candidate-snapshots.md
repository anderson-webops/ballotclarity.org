# Union County candidate snapshots

[Recurring preparation](union-county-ballot-automation.md) discovers and collects
complete offered editions, prepares both candidates and questions, and retains
changes for review. Separately enrolled candidate imports register compatible
later editions through the standard external cycle catalog.

`nj-union-2026-11-03` adds a separately selected historical directory source.
The existing New Jersey federal source retains its default priority. Union's
sample source has personal ballot previews disabled and uses externally stored,
reviewed snapshots.

The compiled `back-end/dist/prepare-union-candidate-snapshot.js` accepts:

```json
{
  "schemaVersion": 1,
  "type": "union-candidate-snapshot-preparation",
  "ballotCaptures": [
    { "path": "/private/capture-one.json", "sha256": "<capture SHA-256>" },
    { "path": "/private/capture-two.json", "sha256": "<capture SHA-256>" }
  ],
  "outputRoot": "/private/union-candidate-snapshots"
}
```

Preparation validates the complete published catalog and original policy-bound
captures, then rereads each PDF's native layout and positioned words. Future
compatible editions provide their actual date, offered URLs and municipality
labels through the same catalog reader. The source configuration is emitted
alongside the snapshot; future registration and collection activation remain
explicit operations.

Outputs include the standard import snapshot, source configuration, source-witness
CSV and a separate review containing every printed occurrence. Repeated candidate
rows across sample forms share an identity only when office, district, printed
name, party, municipality and panel position agree. Conflicting terms or other
record fields stop preparation. The original sample clocks and hashes remain
unchanged; public reads need neither the original PDFs nor a converter.

Printed Democrat, Republican and explicit Non-Partisan labels are retained.
Nomination by Petition remains a ballot designation with no inferred party;
blank school-party fields remain blank. School and municipal nonpartisan panels,
congressional districts, ward offices and unexpired labels remain distinct.
Placeholder cells create no candidates. All records use the neutral listed
status, with qualification, incumbency, election outcomes and personal geographic
applicability left unasserted.

The printed Anne Marie WEISS entry is independent of the earlier Ann Marie Weiss
list reference. Preparation creates no alias or cross-source identity merge.
Manual review/import, publication and recurring collection acceptance remain
separate from producing the snapshot.
