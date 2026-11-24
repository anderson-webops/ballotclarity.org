# Reviewed election reference catalogs

An optional external catalog lets an operator enroll reviewed election references for a state and election date without changing the application. The default registry is unchanged when `ELECTION_REFERENCE_CATALOG_DIR` is unset. Enrollment makes the source eligible for a separate manual snapshot import. Neither step fetches publisher pages or schedules collection.

Use an absolute, owner-private directory outside the release. Each enrolled state has one owner-private regular file named by its two-letter state code, for example `IL.json`:

```json
{
  "schemaVersion": 1,
  "type": "reviewed-election-references",
  "stateCode": "IL",
  "sources": [{
    "id": "il-example-filings-2030",
    "stateCode": "IL",
    "electionDate": "2030-04-02",
    "optional": true,
    "candidateMatching": false,
    "documents": [{
      "url": "https://example.org/filings",
      "title": "Council filing list",
      "publisher": "Example clerk",
      "kind": "public-dataset"
    }]
  }]
}
```

Each source identifies a single election and its actual citations. Supported document kinds are public datasets, official biographies, candidate statements and news reports, using the existing reference schema. Dates of publication are optional. Campaign-site attribution is supported for candidate statements. Enrollment cannot bind a filing or announcement to an official candidate or a personal ballot. The separate Louisiana parish catalog retains its reserved identifiers.

The reader accepts up to 64 sources, 32 documents per source, 512 documents total and 512 KiB per state. State-specific reads open only that state's file. Missing files leave existing sources available. Invalid files reject reads for the affected state. Import and export use the ordinary `manage-election-references` commands, and stored snapshots must match the enrolled configuration. The public Directory retains its normal dated selection and explicit historical access. Preserve the catalog together with its approved snapshots for rollback.
