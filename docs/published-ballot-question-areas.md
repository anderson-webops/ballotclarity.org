# Published question areas

The public question API can add optional `publishedArea` metadata derived from
explicit printed wording. Compatible Fulton questions distinguish Georgia
constitutional questions, Fulton County, a named municipal exclusion and
concordant city names in a question's title and body. Unknown or conflicting
wording retains the original audience. No question is removed or assigned to a
voter through this descriptor.

`publishedArea` contains `kind`, `stateCode`, `name`, `basis: "printed-question"`,
the supporting `evidence` fragment and, for county-area questions, the explicit
`excludedMunicipalities`. Tax-beneficiary criteria remain in the question text;
they do not become voter-eligibility labels. Native records, identifiers,
wording, citations, capture clocks and stored hashes remain unchanged.

Question lists group these names in state/county/county-area/city order. Existing
payloads without the optional field retain their audience groups and source
order. Detail pages use the same area name without an additional explanation.
The source/date selection and `voterApplicabilityVerified: false` remain intact.

Optional native-question reconciliation carries this descriptor alongside the
declared guide jurisdiction. Its CSV adds printed-area columns only when a
descriptor exists. This supports review of parent-guide and source wording;
jurisdiction-boundary verification, personal applicability and substantive
publication/import approval remain separate.
