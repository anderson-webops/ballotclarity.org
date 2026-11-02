# Candidate context leads

`manage-election-references prepare-votega-leads PLAN.json` prepares research
leads from VoteGA's published Georgia election dataset and already retained
official candidate snapshots. It performs no network requests or imports and
changes no public records, source enrollment or collection schedule.

The exact-commit JSON and flattened candidate CSV must come from the same
[published repository](https://github.com/Votega/ga-races-elections). Retain its
original `LICENSE` and `NOTICE.md`. VoteGA publishes its compilation under
CC BY-SA 4.0; underlying source rights remain a separate review. The exporter
copies those notices alongside its adapted research output. Biographies,
photographs and inferred incumbency are excluded.

## Input contract

The plan has `schemaVersion: 1`, type `votega-candidate-lead-preparation`,
`phase` (`general`, `primary` or `runoff`), absolute `candidateFiles` and a new
physical `outputDirectory` outside application source and runtime data.
`publication` contains the exact 40-character `commit`, original `capturedAt`,
and `races`, `candidates`, `license`, `notice` objects, each with an absolute
`path` and original-byte `sha256`.

Every official input must pass the existing configured snapshot validator.
Inputs must share Georgia and an election date. The cycle and phase date must
be explicitly present in the publication. There is no guessed election date,
primary-to-general promotion, or reliance on `activePhase`. This contract is
cycle-independent; future official source configurations retain their existing
review and discovery requirements.

## Matching and output

The JSON and CSV join on race, phase and explicit candidate/member key. Election,
office, district and party must agree. Candidate names use exact Unicode/case
normalization and the published surname-first form; initials, nicknames and
different legal names are not fuzzy matched. A single official name, party and
office/district match produces `review-required`, never an approval.

`candidate-context-leads.json` retains the official record identity, source
commit, input hashes and capture dates. Context may contain a normalized HTTPS
website, occupation and residence county. A residence county is not ballot
eligibility. Unsafe/noncanonical links are held without discarding other
context. There are no requests to candidate websites. Unsupported local and
judicial offices, missing parties, inactive records, absent matches and ambiguous
matches remain explicit review outcomes. Existing output is never overwritten.

The report type is deliberately incompatible with both candidate-snapshot and
reference import. Publisher identity, original-source terms, website ownership,
fact accuracy and freshness must be reviewed before separate content preparation.
Neither this dataset nor a match changes official ballot qualification or a
person's current-office status. Public attribution and adaptation licensing are
required if reviewed VoteGA-derived material is later published.
