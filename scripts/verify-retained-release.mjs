import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const retained = JSON.parse(readFileSync(join(root, "deploy/retained-release.json"), "utf8"));
assert.equal(retained.schemaVersion, 1);
assert.equal(retained.repository, "anderson-webops/ballotclarity.org");
assert.match(retained.commit, /^[a-f\d]{40}$/u);
assert.match(retained.tag, /^v1\.\d+\.\d+$/u);
assert.equal(retained.archive, `ballot-clarity-${retained.commit}-linux-arm64.tar.gz`);
const parent = join(root, ".ai-work/runs");
mkdirSync(parent, { recursive: true });
const scratch = mkdtempSync(join(parent, "retained-release-"));
const assets = join(scratch, "assets");
const frozen = join(scratch, "frozen");
const unpacked = join(scratch, "unpacked");
const retainedSource = join(scratch, "retained-source");
let registeredSource = false;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const run = (command, argumentsList) => execFileSync(command, argumentsList, { cwd: root, stdio: "inherit", timeout: 600_000 });

try {
	mkdirSync(assets);
	run("gh", ["release", "download", retained.tag, "--repo", retained.repository, "--dir", assets]);
	assert.deepEqual(readdirSync(assets).sort(), Object.keys(retained.assets).sort());
	for (const [filename, sha256] of Object.entries(retained.assets)) {
		assert.equal(filename, filename.split("/").at(-1));
		assert.equal(digest(readFileSync(join(assets, filename))), sha256);
	}
	run("gh", ["attestation", "verify", join(assets, retained.archive), "--repo", retained.repository, "--bundle", join(assets, "attestation-bundle.jsonl"), "--source-digest", retained.commit, "--source-ref", `refs/tags/${retained.tag}`, "--signer-workflow", `${retained.repository}/.github/workflows/ci.yml`, "--deny-self-hosted-runners"]);
	for (const [filename, sha256] of Object.entries(retained.verifierInputs)) {
		assert.ok(!filename.startsWith("/") && !filename.split("/").includes(".."));
		const bytes = execFileSync("git", ["show", `${retained.commit}:${filename}`], { cwd: root });
		assert.equal(digest(bytes), sha256);
		const target = join(frozen, filename);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, bytes);
	}
	run(process.execPath, ["--input-type=module", "-e", "const { verifyPublishedReceipt } = await import(process.argv[1]); verifyPublishedReceipt(process.argv[2], process.argv[3]);", pathToFileURL(join(frozen, "scripts/runtime-release-receipt.mjs")).href, assets, retained.commit]);
	mkdirSync(unpacked);
	run("python3", ["-B", "-c", [
		"import sys,tarfile",
		"from pathlib import PurePosixPath",
		"with tarfile.open(sys.argv[1]) as archive:",
		"    members=archive.getmembers()",
		"    assert members and sum(item.size for item in members) <= 512*1024*1024",
		"    for member in members:",
		"        path=PurePosixPath(member.name)",
		"        assert not path.is_absolute() and '..' not in path.parts and path.parts[0]=='ballot-clarity-runtime'",
		"        assert member.isfile() or member.isdir()",
		"    archive.extractall(sys.argv[2], members=members, filter='data')",
	].join("\n"), join(assets, retained.archive), unpacked]);
	const runtime = join(unpacked, "ballot-clarity-runtime");
	run("git", ["worktree", "add", "--detach", retainedSource, retained.commit]);
	registeredSource = true;
	run(process.execPath, [join(retainedSource, "scripts/verify-runtime-artifact.mjs"), runtime]);
	run(process.execPath, [join(root, "scripts/verify-postgres-recovery.mjs"), runtime]);
	console.log(`Exact retained ${retained.tag} passed receipt, attestation and unpacked Node ${process.versions.node} runtime/recovery checks.`);
}
finally {
	if (registeredSource)
		run("git", ["worktree", "remove", "--force", retainedSource]);
	rmSync(scratch, { recursive: true, force: true });
}
