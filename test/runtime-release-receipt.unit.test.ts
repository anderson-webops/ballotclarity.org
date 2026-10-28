import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyPublishedReceipt, verifyReceipt } from "../scripts/runtime-release-receipt.mjs";

const commit = "a".repeat(40);
const archive = `ballot-clarity-${commit}-linux-arm64.tar.gz`;
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "ballot-published-receipt-"));
	const contract = JSON.parse(readFileSync(new URL("../deploy/runtime-artifact-contract.json", import.meta.url), "utf8"));
	const source = { commit, tree: "b".repeat(40), dirty: false };
	const manifest = JSON.stringify({ schemaVersion: 1, source, services: contract.services, externalWritableState: contract.externalWritableState, toolchain: { node: "v24.18.1", npm: "12.0.2" }, files: [{ path: "fixture", sha256: digest("fixture") }] });
	const bytes = Buffer.from("controlled archive fixture");
	const receipt = { schemaVersion: 1, scope: "source-artifact-only", hostCapabilitiesVerified: false, source, runtime: { os: "linux", architecture: "arm64", libc: "glibc", node: "v24.18.1" }, archive: { name: archive, size: bytes.length, sha256: digest(bytes) }, manifestSha256: digest(manifest), checks: ["clean isolated source build", "complete hashed runtime inventory", "unpacked two-service health and readiness", "PostgreSQL 17 stopped-service recovery and retained restart", "missing module and changed entrypoint rejection", "graceful shutdown", "extracted transport archive acceptance"] };
	writeFileSync(join(directory, archive), bytes);
	writeFileSync(join(directory, "runtime-manifest.json"), manifest);
	writeFileSync(join(directory, "acceptance-receipt.json"), JSON.stringify(receipt));
	writeFileSync(join(directory, "SHA256SUMS"), [archive, "runtime-manifest.json", "acceptance-receipt.json"].map(name => `${digest(readFileSync(join(directory, name)))}  ${name}\n`).join(""));
	return { directory, receipt };
}

test("published receipt validation explicitly requires all five release assets without weakening pre-attestation checks", () => {
	const { directory, receipt } = fixture();
	try {
		assert.deepEqual(verifyReceipt(directory, commit), receipt);
		assert.throws(() => verifyPublishedReceipt(directory, commit));
		writeFileSync(join(directory, "attestation-bundle.jsonl"), "controlled bundle; cryptographic verification remains a separate finalizer gate\n");
		assert.deepEqual(verifyPublishedReceipt(directory, commit), receipt);
		assert.throws(() => verifyReceipt(directory, commit));
		writeFileSync(join(directory, "unexpected.json"), "{}");
		assert.throws(() => verifyPublishedReceipt(directory, commit));
	}
	finally { rmSync(directory, { recursive: true }); }
});

test("published receipt validation rejects redirected provenance and altered archive bytes", () => {
	const { directory } = fixture();
	try {
		symlinkSync(join(directory, "SHA256SUMS"), join(directory, "attestation-bundle.jsonl"));
		assert.throws(() => verifyPublishedReceipt(directory, commit));
		rmSync(join(directory, "attestation-bundle.jsonl"));
		writeFileSync(join(directory, "attestation-bundle.jsonl"), "controlled bundle\n");
		writeFileSync(join(directory, archive), "changed");
		assert.throws(() => verifyPublishedReceipt(directory, commit));
	}
	finally { rmSync(directory, { recursive: true }); }
});

test("release finalization uses the published receipt mode and retains exact bundled provenance verification", () => {
	const finalizer = readFileSync(new URL("../scripts/finalize-release-handoff.mjs", import.meta.url), "utf8");
	assert.match(finalizer, /verifyPublishedReceipt\(assets, values\.commit\)/u);
	assert.match(finalizer, /"attestation",\s*"verify"/u);
	assert.match(finalizer, /"--bundle"/u);
	assert.match(finalizer, /"--source-digest"/u);
	assert.match(finalizer, /"--source-ref"/u);
});
