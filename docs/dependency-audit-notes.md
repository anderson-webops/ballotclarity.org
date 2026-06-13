# Dependency Audit Notes

## 2026-06-12 Nuxt/Vite/esbuild advisory

`npm audit --workspaces` currently reports a high-severity advisory chain through Nuxt's Vite toolchain:

- `esbuild` versions `0.17.0 - 0.28.0`
- `vite` versions `4.2.0-beta.0 - 8.0.3`
- Nuxt's `@nuxt/vite-builder`, `vite-node`, `vite-plugin-inspect`, and `vite-plugin-vue-tracer`

The local audit output says the available forced fix would install `nuxt@2.18.1`, which is a breaking downgrade from the Nuxt 4 application stack and is not an acceptable remediation.

Do not force the Nuxt downgrade. Revisit this when Nuxt publishes a compatible dependency graph that resolves the Vite/esbuild advisory without downgrading Nuxt or moving the app onto an unsupported Vite major.

Attempted local remediation:

- A generic `esbuild@0.28.1` override did not remove the vulnerable root `node_modules/esbuild@0.27.7` used by `vite@7.3.5`.
- A Vite 8 override can remove the audit finding in a scratch install, but Nuxt 4.4.8 still declares Vite 7 compatibility and npm marks the resulting tree invalid. Do not ship that override without explicit Nuxt support and a full validation pass.

Current mitigation:

- Keep `npm audit --workspaces` in the validation notes as a known upstream limitation until Nuxt's supported Vite line resolves the advisory.
- Continue running `npm ci`, lint, typecheck, build, unit tests, e2e smoke, and accessibility checks before release.

## 2026-06-13 verification

The current supported dependency graph remains blocked on the same upstream chain:

- `nuxt@4.4.8` is the latest Nuxt release available to this repo.
- `@nuxt/vite-builder@4.4.8` declares `vite@^7.3.3`.
- `vite@7.3.5` is the latest Vite 7 release and still declares `esbuild@^0.27.0`.
- `vite@8.0.16` removes the vulnerable `esbuild` edge, but Nuxt's builder has not moved its declared dependency range to Vite 8.

Attempted remediation on this date:

- A root `esbuild@0.28.1` override did not change the Vite dependency edge.
- A nested `vite -> esbuild@0.28.1` override did not change the Vite dependency edge.
- A root `vite@8.0.16` override did not change Nuxt's locked Vite 7 edge in the workspace lockfile.

Safe change made:

- Updated `vue-tsc` from `3.3.4` to `3.3.5`, the current wanted/latest release, so the non-audit dependency freshness check is clean.
