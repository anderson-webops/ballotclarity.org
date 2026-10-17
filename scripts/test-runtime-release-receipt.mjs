import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { verifyReceipt } from "./runtime-release-receipt.mjs";

const contract = JSON.parse(readFileSync(resolve(import.meta.dirname, "../deploy/runtime-artifact-contract.json"), "utf8"));
const commit = "a".repeat(40);
const archive = `ballot-clarity-${commit}-linux-arm64.tar.gz`;

function digest(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "ballot-runtime-receipt-"));
	const archiveBytes = Buffer.from("synthetic archive fixture");
	const manifest = {
		schemaVersion: 1,
		source: { commit, dirty: false, tree: "b".repeat(40) },
		toolchain: { node: "v24.18.1", npm: "12.0.2" },
		services: contract.services,
		externalWritableState: contract.externalWritableState,
		files: [{ path: "back-end/dist/server.js", sha256: "c".repeat(64), size: 1, mode: 0o644 }],
	};
	const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
	const receipt = {
		schemaVersion: 1,
		scope: "source-artifact-only",
		hostCapabilitiesVerified: false,
		source: manifest.source,
		runtime: { os: "linux", architecture: "arm64", libc: "glibc", node: "v24.18.1" },
		archive: { name: archive, size: archiveBytes.length, sha256: digest(archiveBytes) },
		manifestSha256: digest(manifestBytes),
		checks: [
			"clean isolated source build",
			"complete hashed runtime inventory",
			"unpacked two-service health and readiness",
			"missing module and changed entrypoint rejection",
			"graceful shutdown",
			"extracted transport archive acceptance",
		],
	};
	const receiptBytes = Buffer.from(`${JSON.stringify(receipt)}\n`);
	writeFileSync(join(root, archive), archiveBytes);
	writeFileSync(join(root, "runtime-manifest.json"), manifestBytes);
	writeFileSync(join(root, "acceptance-receipt.json"), receiptBytes);
	writeFileSync(join(root, "SHA256SUMS"), [
		`${digest(archiveBytes)}  ${archive}\n`,
		`${digest(manifestBytes)}  runtime-manifest.json\n`,
		`${digest(receiptBytes)}  acceptance-receipt.json\n`,
	].join(""));
	return root;
}

test("accepts a source-bound ARM64 release receipt", () => {
	const root = fixture();
	try {
		assert.equal(verifyReceipt(root, commit).source.commit, commit);
	}
	finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("rejects altered release assets", () => {
	const root = fixture();
	try {
		writeFileSync(join(root, archive), "tampered archive");
		assert.throws(() => verifyReceipt(root, commit));
	}
	finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("rejects extra release assets", () => {
	const root = fixture();
	try {
		writeFileSync(join(root, "unexpected"), "extra");
		assert.throws(() => verifyReceipt(root, commit));
	}
	finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("rejects wrong source or weakened runtime contract", () => {
	const root = fixture();
	try {
		assert.throws(() => verifyReceipt(root, "d".repeat(40)));
		const path = join(root, "runtime-manifest.json");
		const manifest = JSON.parse(readFileSync(path, "utf8"));
		manifest.services = [];
		writeFileSync(path, `${JSON.stringify(manifest)}\n`);
		assert.throws(() => verifyReceipt(root, commit));
	}
	finally {
		rmSync(root, { recursive: true, force: true });
	}
});
