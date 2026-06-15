# Security Audit Policy

Ballot Clarity runs `npm run audit` as a curated security gate rather than using raw `npm audit` output directly.

## Current Upstream Exception

The current raw audit report contains a known Nuxt/Vite/esbuild chain:

- `nuxt`
- `@nuxt/nitro-server`
- `@nuxt/vite-builder`
- `vite`
- `vite-node`
- `vite-plugin-inspect`
- `vite-plugin-vue-tracer`
- `esbuild`

The underlying actionable advisory is Vite's dependency on `esbuild@0.27.x`. The installed Nuxt release is `nuxt@4.4.8`, which currently declares `@nuxt/vite-builder@4.4.8`, which in turn declares `vite@^7.3.3`. Vite 7 currently declares `esbuild@^0.27.0`.

`npm audit fix --force` suggests `nuxt@2.18.1`, which would downgrade the project out of Nuxt 4 and is not a safe or valid production fix.

## Gate Behavior

`npm run audit`:

- passes when there are no vulnerabilities;
- passes when the only findings match the exact documented Nuxt/Vite/esbuild upstream fingerprint in `scripts/security-audit.mjs`;
- fails when any new package appears in the audit report;
- fails when the documented advisory fingerprint changes;
- points maintainers back to this file for the exception rationale.

`npm run audit:raw` remains available for the unfiltered npm report.

## Install-Script Approvals

The root `package.json` uses npm's `allowScripts` policy so install-time scripts are reviewed explicitly. Build/runtime helper packages that require native or platform-specific setup are approved by pinned version. Puppeteer's install script is denied because Ballot Clarity's browser smoke checks use an explicit or system Chrome path instead of downloading a browser during dependency install.

After dependency updates, run:

```bash
npm approve-scripts --allow-scripts-pending --json
```

Any pending package should be reviewed and either pinned-approved with `npm approve-scripts <pkg>` or denied with `npm deny-scripts <pkg>`.

## Revisit Trigger

Remove this exception when Nuxt publishes a release that supports a Vite version without the affected esbuild dependency, or when npm publishes a valid fix path that does not downgrade this Nuxt 4 app to Nuxt 2.
