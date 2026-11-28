#!/usr/bin/env bash
set -euo pipefail

[[ "${GITHUB_ACTIONS:-}" == true && "${RUNNER_ENVIRONMENT:-}" == github-hosted && "${RUNNER_OS:-}" == Linux ]]
case "${RUNNER_ARCH:-}" in
  ARM64) architecture=arm64 ;;
  X64) architecture=x64 ;;
  *) exit 1 ;;
esac

version=$(<.node-version)
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
toolchain=$(realpath -- "${RUNNER_TOOL_CACHE:?}/node/$version/$architecture")
node_source=$(realpath -- "$(command -v node)")
npm_source=$(realpath -- "$toolchain/bin/npm")
[[ "$node_source" == "$toolchain/bin/node" && "$npm_source" == "$toolchain/lib/node_modules/npm/bin/npm-cli.js" ]]

umask 077
private_bin=$(mktemp -d "${RUNNER_TEMP:?}/ballot-node.XXXXXX")
install -m 0755 -- "$node_source" "$private_bin/node"
cmp -s -- "$node_source" "$private_bin/node"
ln -s -- "$npm_source" "$private_bin/npm"
[[ "$("$private_bin/node" --version)" == "v$version" ]]
printf '%s\n' "$private_bin"
