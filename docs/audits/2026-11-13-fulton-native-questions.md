# Fulton native question integration

The retained October 27 capture of Fulton's November 3, 2026 consolidated sample
and county write-in publication reproduces the original 98 candidate records
without changing any record field or identity. The native snapshot additionally
retains seven printed questions, their Yes/No choices, page references and
source-bound identifiers. Both original PDF byte hashes and native text
extractions reconcile. Printed question pages 3, 4 and 5 were visually reviewed.

The [official consolidated sample](https://fultoncountyga.gov/-/media/2026-Election/November-3-Election/Sample-Ballot--Consolidated--Nov-32026-General--Special-Election--1082026.pdf)
has SHA-256 `e1b4186e5f8c0ff8188cc4175fe18c0a18fa6bfb158fca08cb3da190793dd60d`.
The questions concern transportation sales tax, Sandy Springs redevelopment
powers, Palmetto property-tax exemption, educational sales tax and three proposed
Georgia constitutional amendments. Their printed scope and wording remain
unchanged, including transportation's exclusion of Atlanta. School-system
project sections remain distinct within the educational question.

The earlier reviewed candidate-only snapshot remains a separate, unchanged
recovery target. The prepared native cohort preserves its actual October 27
capture clock and does not represent a fresh publisher observation, election
result, independently approved measure analysis or verified personal ballot.
Every question retains `voterApplicabilityVerified: false`.

Election overviews now present available native questions with source-bound
detail links and a native-fragment contents entry near Candidates. The same
grouped list serves the question index. Source/state/election mismatches remain
hidden, unavailable sections have no empty heading, and election notices retain
their distinct label and unaltered choice fields. Existing collector output
populates the section for future accepted elections without annual UI edits.

This changes question visibility, not source selection, review/publication
decisions, geographic eligibility, current-versus-historical selection or
recurring-job activation. See [source collection](2026-10-27-fulton-question-automation.md)
and [reusable election cycles](../state-ballot-cycles.md).

## Native import contract

The compiled state-data manager accepts `import-native SOURCE SNAPSHOT.json` for
one explicitly selected, enabled automatic source. It validates the native
snapshot against that exact source and acquires the recurring-worker lock before
reading or replacing its dataset. Future/older captures, missing accepted
candidates, changed/missing accepted questions and manual-source permission holds
remain refusals. The legacy `import` mode keeps its reviewed-snapshot contract.

An initial Fulton native upgrade retains the exact legacy envelope by hash before
atomic replacement. Repeated imports preserve the source clock and record IDs.
This is an offline management operation; it performs no publisher acquisition,
changes no publication workflow and grants no personal-ballot eligibility.
