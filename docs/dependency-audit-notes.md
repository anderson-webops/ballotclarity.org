# Dependency Audit Notes

## 2026-09-11 security refresh

The audit begun September 10 found seven flagged packages in the previously committed root dependency tree. The findings trace to four dependencies, now pinned to patched releases:

| Dependency | Previous | Patched | Advisory evidence |
| --- | --- | --- | --- |
| `fast-uri` | 3.1.5 | 3.1.6 | [URI normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc) |
| `js-yaml` | 4.3.1 | 4.3.2 | [Merge-source resource exhaustion](https://github.com/advisories/GHSA-2883-xcg3-v3hh) |
| `qs` | 6.15.3 | 6.16.0 | [Query parsing denial of service](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) |
| `svgo` | 4.0.2 | 4.1.0 | [SVG sanitization bypass](https://github.com/advisories/GHSA-w27v-7q3p-w38r) |

Root and standalone backend lockfiles retain registry integrity metadata and independently pass clean installation. Full, production-only, and standalone backend dependency audits report zero known vulnerabilities. The root refresh uses `npm update fast-uri js-yaml qs svgo --package-lock-only --ignore-scripts --no-fund --no-audit`: regenerating the lockfile alone did not advance the old overrides under npm 12. Both installed versions and the resulting lockfile were checked.

Production and development dependency freshness was reviewed with `npm outdated --workspaces --include-workspace-root --long`. Compatible non-security updates remain available; this change narrowly updates the four affected dependencies and SVGO's required selector dependencies. It does not claim all packages are the latest releases. Node 24.18.1 and npm 12.0.2 remain the tested project toolchain.

The workflow regression check now tests that all action references, including shorthand `- uses:` steps, are immutable 40-character commit hashes. It retains checks for required actions without rejecting future legitimate Dependabot SHA updates merely because they differ from a previously copied hash.

## 2026-07-30 supported dependency state

The earlier Nuxt/Vite/esbuild advisory chain is resolved on the supported Nuxt 4 dependency line.

- The clean lockfile install resolves `nuxt@4.5.1`.
- Nuxt's builder and related development tools resolve `vite@8.1.5`.
- Vite, Nitro, Unhead, Unplugin, and `tsx` resolve `esbuild@0.28.1`.
- `npm audit --workspaces`, `npm audit --workspaces --omit=dev`, and the repository's zero-exception audit wrapper report zero vulnerabilities.
- `npm outdated --workspaces --include-workspace-root --long` reports no compatible wanted updates. The listed latest versions are unsupported next-major lines for Node types and TypeScript, plus an H3 release candidate.
- `npm ci --include=optional` and the native-binding verifier confirm that the committed lockfile installs the expected platform packages, including Linux ARM64 bindings.
- `npm run verify:backend-lockfile` confirms the separately committed backend lockfile remains independently installable under its exact install-script policy.
- Strict install-script enforcement makes clean installation fail if either dependency tree gains an unreviewed lifecycle script.
- The backend pins `express-rate-limit@8.6.1` for the recognizable administrative route boundary and supplies its own tested bounded, fail-closed in-memory store rather than relying on an unbounded request-key map.
- The local `vendor/archiver-nitro-compat` package preserves Nitro 2's default factory interface while delegating to `archiver@8.0.0`, removing the vulnerable Archiver 7 / Glob 10 / Minimatch 9 / Brace Expansion 2 chain.

Nitro 2.13.4 still imports Archiver through the default factory removed in Archiver 8. The compatibility package is deliberately narrow, directly tested, and must be removed when Nitro adopts Archiver 8 or a later supported API. Clean install, full and production audits, build, and browser gates cover this bridge.

The supported top-level dependency tree passes `npm ls --workspaces --include-workspace-root`. npm 11's diagnostic-only `npm ls --all` additionally labels two non-active optional edges as invalid: `@bomb.sh/tab` sees the hoisted `cac@7` outside its explicitly optional `cac@6` adapter range, and Vite's nested Rolldown sees Nuxt's hoisted WASM fallback while each Rolldown version retains its exact platform-native binding. Neither edge runs in the production path; the clean install, production build, and Linux ARM64 native-binding gate validate the active dependency paths without forcing unsupported transitive versions.

The production baseline remains Node 24.18.1 LTS with npm 12.0.2. Node 26 types, TypeScript 7, and H3 2 RC are intentionally not promoted until their corresponding runtime/framework lines are supported by this application and pass the full release gate.
