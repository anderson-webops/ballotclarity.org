# Locally hardened deepmerge

This is the self-contained CommonJS distribution and types from deepmerge 4.3.1
under its retained MIT license, with a local fix for
[CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
The npm registry has no patched release as of October 27, 2026.

Both object-copy paths reject the string key `__proto__` before reading or
assigning its value. Result properties use data descriptors, never inherited
setters. This protects returned objects when the target has a null prototype,
primitive/null placeholders, or its own dangerous key, including nested arrays
and `deepmerge.all`. Ordinary merge, clone, symbol, array and custom-merge
behavior remains compatible. Custom caller-supplied merge functions remain
the caller's code.

The root file dependency and override ensure Nitro's Rollup resolver uses this
copy. No audit finding is suppressed or allowlisted. This is a build-time
dependency path, not a claim of a demonstrated public application exploit.
Regression tests are in `test/deepmerge.unit.test.ts`; the full application
build validates the actual consumer. Replace this local patch with an
equivalently safe maintained upstream release when available.
