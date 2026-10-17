import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const sourceRoot = resolve(import.meta.dirname, "..");
const expectedServices = JSON.parse(readFileSync(resolve(sourceRoot, "deploy/runtime-artifact-contract.json"), "utf8"));
const requiredChecks = [
	"clean isolated source build",
	"complete hashed runtime inventory",
	"unpacked two-service health and readiness",
	"missing module and changed entrypoint rejection",
	"graceful shutdown",
	"extracted transport archive acceptance",
];

function digest(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readManifest(assetRoot) {
	const manifest = JSON.parse(readFileSync(resolve(assetRoot, "runtime-manifest.json"), "utf8"));
	assert.equal(manifest.schemaVersion, 1);
	assert.match(manifest.source.commit, /^[a-f0-9]{40}$/u);
	assert.match(manifest.source.tree, /^[a-f0-9]{40}$/u);
	assert.equal(manifest.source.dirty, false);
	assert.deepEqual(manifest.services, expectedServices.services);
	assert.deepEqual(manifest.externalWritableState, expectedServices.externalWritableState);
	assert.equal(manifest.toolchain.node, "v24.18.1");
	assert.equal(manifest.toolchain.npm, "12.0.2");
	assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
	return manifest;
}

function archiveName(commit) {
	return `ballot-clarity-${commit}-linux-arm64.tar.gz`;
}

function assetPath(assetRoot, name) {
	assert.equal(basename(name), name);
	const path = resolve(assetRoot, name);
	assert.equal(lstatSync(path).isFile(), true);
	return path;
}

export function writeReceipt(assetRoot) {
	assert.equal(process.platform, "linux");
	assert.equal(process.arch, "arm64");
	assert.equal(process.version, "v24.18.1");
	assert.equal(execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(), "12.0.2");
	assert.ok(process.report.getReport().header.glibcVersionRuntime);
	const manifest = readManifest(assetRoot);
	const archive = archiveName(manifest.source.commit);
	const archivePath = assetPath(assetRoot, archive);
	const receipt = {
		schemaVersion: 1,
		scope: "source-artifact-only",
		hostCapabilitiesVerified: false,
		source: manifest.source,
		runtime: { os: "linux", architecture: "arm64", libc: "glibc", node: manifest.toolchain.node },
		archive: { name: archive, size: statSync(archivePath).size, sha256: digest(archivePath) },
		manifestSha256: digest(assetPath(assetRoot, "runtime-manifest.json")),
		checks: requiredChecks,
	};
	writeFileSync(resolve(assetRoot, "acceptance-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
	const checksumNames = [archive, "runtime-manifest.json", "acceptance-receipt.json"];
	writeFileSync(resolve(assetRoot, "SHA256SUMS"), checksumNames.map(name => `${digest(assetPath(assetRoot, name))}  ${name}\n`).join(""));
	verifyReceipt(assetRoot, manifest.source.commit);
	return receipt;
}

export function verifyReceipt(assetRoot, commit) {
	const expectedNames = [archiveName(commit), "runtime-manifest.json", "acceptance-receipt.json", "SHA256SUMS"];
	assert.deepEqual(readdirSync(assetRoot).sort(), [...expectedNames].sort());
	const manifest = readManifest(assetRoot);
	assert.equal(manifest.source.commit, commit);
	const receipt = JSON.parse(readFileSync(assetPath(assetRoot, "acceptance-receipt.json"), "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.scope, "source-artifact-only");
	assert.equal(receipt.hostCapabilitiesVerified, false);
	assert.deepEqual(receipt.checks, requiredChecks);
	assert.deepEqual(receipt.source, manifest.source);
	assert.deepEqual(receipt.runtime, { os: "linux", architecture: "arm64", libc: "glibc", node: "v24.18.1" });
	assert.deepEqual(receipt.archive, {
		name: archiveName(commit),
		size: statSync(assetPath(assetRoot, archiveName(commit))).size,
		sha256: digest(assetPath(assetRoot, archiveName(commit))),
	});
	assert.equal(receipt.manifestSha256, digest(assetPath(assetRoot, "runtime-manifest.json")));
	const checksumNames = expectedNames.slice(0, 3);
	const expectedChecksums = checksumNames.map(name => `${digest(assetPath(assetRoot, name))}  ${name}\n`).join("");
	assert.equal(readFileSync(assetPath(assetRoot, "SHA256SUMS"), "utf8"), expectedChecksums);
	return receipt;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	const [, , command, assetRoot, expectedCommit] = process.argv;
	assert.ok(assetRoot);
	if (command === "write")
		writeReceipt(resolve(assetRoot));
	else if (command === "verify") {
		assert.match(expectedCommit ?? "", /^[a-f0-9]{40}$/u);
		verifyReceipt(resolve(assetRoot), expectedCommit);
	}
	else
		throw new Error(`Unknown release receipt command: ${command}`);
}
