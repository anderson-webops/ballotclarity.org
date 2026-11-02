# November 1 dependency remediation

Fresh full-graph auditing identified Nuxt and pattern/traversal advisories after
the prior release. Nuxt moves to the supported 4.6.3 patch line. Maintained
minimatch 11.0.1 and glob 14.0.2 replace the affected matching/traversal versions.
The installed consumers use the modern named matcher, `Minimatch` object and
promise-based glob APIs. Import-x 4.17.1 still compiles regular expressions in one
rule. A version/hash-pinned, idempotent install patch switches that rule to
`Minimatch.match` in both ESM and CommonJS, retaining its allow/forbid behavior
without restoring the removed regular-expression compiler. Changed dependency
bytes fail installation pending review. Focused checks cover those interfaces,
brace/extglob/dot-file behavior, tracing results, ignores and aborted traversal.
The complete native lint, typecheck, build, archive and application suites remain
the integration gates; the overrides do not suppress advisory reporting.

Upstream advisories:
- [Nuxt route normalization](https://github.com/nuxt/nuxt/security/advisories/GHSA-9v7c-q64q-vv33)
- [Nuxt development file serving](https://github.com/nuxt/nuxt/security/advisories/GHSA-3xf4-9g3c-4h4w)
- [Nuxt client error reports](https://github.com/nuxt/nuxt/security/advisories/GHSA-x287-wcfc-q46c)
- [Nuxt private development configuration](https://github.com/nuxt/nuxt/security/advisories/GHSA-648h-gw55-m2g7)
- [minimatch amplification](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
- [glob cancellation](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4)

Mutable election data, credentials and production services are outside this
dependency change. Exact locked installations and both full/production audits
are required before release.
