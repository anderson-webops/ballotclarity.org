# Nuxt workspace-boundary update

The release audit began reporting GHSA-mjrq-cffv-q4qc for the locked Nuxt
4.6.3 dependency chain. The development-server workspace resolver could widen
its file-serving boundary to a parent containing an unrelated lockfile or
settings-only workspace file. The upstream advisory describes the required
development-server exposure conditions; it does not establish an exposure of
this site's production runtime.

Nuxt, its schema and its Vite/Nitro integration move to 4.6.4. Nitro moves to
the required 2.13.6 patch. The previous Nuxt-specific unimport 7.0.1 override is
removed so the installed graph satisfies Nuxt's declared unimport ^7.0.2 range.
The existing reviewed archive adapter remains in place. Full and production
audits, locked root/backend installations and dependency-tree validity remain
independent qualification requirements.

Two regression checks exercise the actual installed schema resolver. Unrelated
parent lockfiles and settings stay outside the project boundary, while declared
monorepos and explicit workspace configuration remain supported. A separate
controlled comparison reproduced boundary widening with the preserved 4.6.2
resolver and confirmed project-local resolution with 4.6.4. Application, native
document, authenticated administration and retained-data checks remain required.

Release qualification is held on the required registry-signature check. The
advertised attestation endpoint for unimport 7.0.2 returns HTTP 404. This result
is an upstream provenance-availability failure. The signature check remains
enabled, and this update has no release tag or deployment claim.

References:
- [Nuxt workspace-boundary advisory](https://github.com/nuxt/nuxt/security/advisories/GHSA-mjrq-cffv-q4qc)
- [Nuxt 4.6.4 security release](https://github.com/nuxt/nuxt/releases/tag/v4.6.4)
