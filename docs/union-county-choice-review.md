# Union County candidate context review

This offline preparation compares the retained candidate-reference evidence with
printed offices, congressional districts, party-column headings and lower ballot
panels in the [complete sample captures](union-county-candidate-research.md).
It preserves original list fields and sample citations rather than rewriting
candidate identities or inferring a voter's ballot.

## Preparation

`back-end/dist/prepare-union-choice-review.js` accepts this strict JSON plan:

```json
{
  "schemaVersion": 1,
  "type": "union-choice-context-review",
  "candidateCorroboration": {
    "path": "/external-research/corroborated/corroboration.json",
    "sha256": "<original candidate-comparison SHA-256>"
  },
  "ballotCaptures": [
    { "path": "/external-research/batch-1/capture.json", "sha256": "<capture SHA-256>" },
    { "path": "/external-research/batch-2/capture.json", "sha256": "<capture SHA-256>" }
  ],
  "outputRoot": "/external-research/choice-context"
}
```

The shared loader verifies all original bytes, the complete offered catalog,
publisher policies, source inventories, original clocks and request spacing.
The candidate parent must remain an unpublished, unqualified research comparison
for the same catalog. Each complete preparation writes separate CSV/JSON files
under a new process-held external directory and makes zero publisher requests.

The CSV retains the list's name, office, jurisdiction, party code and position,
alongside actual printed titles, selections, column labels and aligned sample
forms/URLs/hashes/clocks. The JSON preserves every witness and the original
reference. Repeated preparation is byte-identical. Earlier candidate and public-
question outputs keep their original structures and hashes.

`unlinked-printed-choices.csv` and the JSON retain named sample choices without
an exact earlier-list match. They remain source observations, with their own
office/panel and citation, rather than an assumed identity crosswalk. Detected
position cells with empty names or explicit nomination/petition placeholders stay
inventory data, not people; this does not count all blank printed ballot spaces.

## Printed evidence and limits

General-election columns bind their actual large letter headings to the printed
English Democrat, Republican or Nomination by Petition label. Column letters
never imply a fixed party. English office text is recovered from positioned words,
including a native line that joins the English and Spanish columns. Recognized
publication footers remain outside office fields.

The reviewed general-table format has sequential numbered rows grouped under
printed office/selection blocks. Preparation requires the complete row sequence,
the printed choice counts, source typography and office geometry to agree. A
changed or incomplete arrangement requires review. Choice counts neither establish
the total candidates in a race nor imply an unopposed or elected status.

House references additionally match the sample's explicitly printed congressional
district. Known singular/plural office wording and printed ordinal spacing are
normalized for comparison. The reviewed combined-ward label and an explicitly
printed unexpired-term qualifier have narrow mappings; other wording remains a
review exception. No remaining term length is calculated.

Lower school and municipal nonpartisan panels retain distinct printed titles.
A separate nonpartisan heading supplies that classification. A blank school-list
party remains blank. Nomination by Petition stays a column designation and never
becomes an inferred Independent party affiliation. Literal list `Ind` codes remain
dated list evidence. Conflicting office or party evidence is retained for review.

## November 14, 2026 evidence

Complete native preparation checks all 42 sample forms and retains all 184 earlier
references. Printed office context corroborates 183 entries. Party headings
corroborate 65 Democrat and 45 Republican list codes. Thirteen `Ind` list entries
have petition-column evidence only; two municipal entries carry an explicit
nonpartisan heading, and 58 school entries retain blank party fields.

The earlier Ann Marie Weiss reference still has no exact-name match: Winfield's
sample prints Anne Marie WEISS. The spelling remains an explicit exception.
The unlinked-choice export preserves that printed name separately from the earlier
reference, with no automatic alias or identity merge.
These outputs establish neither final qualification nor personal applicability,
publication approval or recurring-operation acceptance. Existing public records,
source configurations and prior evidence remain unchanged.
