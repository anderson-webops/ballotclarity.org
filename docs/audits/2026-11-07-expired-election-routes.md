# Expired-election route selection

The repository's existing cutoff is 00:00 UTC two days after the configured
election date. For November 3, 2026, it is November 5 at 00:00 UTC. Current/default
source selection and personal previews use that cutoff. An explicit source ID
continues to identify a historical record set with its original election date.

The list and detail HTTP routes previously retried an empty default repository
read using an explicit source ID. That converted a current-source request into
historical access. The exact v1.14.107 artifact reproduces the reported Alaska
case with 155 retained records on November 7.

Both routes now preserve the request's selection mode and check expiry without
an explicit-source fallback. The directory retains historical source choices
while omitting an expired default election date. Personal previews recheck their
source after asynchronous reads and clear expired saved previews. Explicit
historical list/detail/question access remains available.

Seven route and personal-preview regressions cover the millisecond before,
exactly at and after the cutoff, including an asynchronous boundary crossing.
Retained-data acceptance exercises the actual HTTP routes with the unchanged
155-row Alaska snapshot against both the prior artifact and corrected source.
Historical records, original capture clocks and source/data contracts remain intact.

Current-data fixtures use explicit test clocks. The Fairbanks synthetic robots
fixture's CRLF conversion is idempotent across Git checkout line endings;
publisher policy fingerprints and rejection checks remain unchanged.

The frontend retains `/release.json` compatibility through a noncacheable redirect
to canonical `/deployment.json`. Metadata remains limited to release identity.
