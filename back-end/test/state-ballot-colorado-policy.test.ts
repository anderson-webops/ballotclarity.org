import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(source => source.id === "co-sos-2026")!;
const records = [{ id: "a".repeat(24), name: "Synthetic Candidate", office: "Governor", scope: "statewide" as const, district: "", status: "listed" as const }];
const timestamp = "2026-10-25T12:00:00.000Z";

test("Colorado candidate collection is held before any network request and requires reviewed external provenance", async () => {
	assert.equal(source.retrievalPolicy, "manual-snapshot");
	assert.equal(source.snapshotStorage, "external");
	assert.deepEqual(source.documentUrls, [source.url]);
	let requests = 0;
	await assert.rejects(fetchStateBallotSourceText(source, async () => {
		requests++;
		return "";
	}));
	assert.equal(requests, 0);
	const document = { url: source.url, sha256: "b".repeat(64), retrievedAt: timestamp, includedRecordCount: 1 };
	const sha256 = createHash("sha256").update(JSON.stringify([{ url: document.url, sha256: document.sha256 }])).digest("hex");
	const snapshot = { source, retrievedAt: timestamp, sha256, records, documents: [document] };
	assert.equal(parseBundledStateSnapshot(source, serializeStoredStateSnapshot(snapshot)).records.length, 1);
	assert.throws(() => parseBundledStateSnapshot(source, serializeStoredStateSnapshot({ ...snapshot, documents: undefined })));
	assert.throws(() => parseBundledStateSnapshot(source, serializeStoredStateSnapshot({ ...snapshot, sha256: "c".repeat(64) })));
});

test("Colorado's legacy automatic bytes are preserved but cannot be relabeled as a reviewed manual import", async () => {
	const stage = await mkdtemp(join(tmpdir(), "ballot-colorado-policy-"));
	try {
		const { retrievalPolicy, snapshotStorage, documentUrls, ...legacy } = source;
		assert.equal(retrievalPolicy, "manual-snapshot");
		assert.ok(snapshotStorage && documentUrls);
		const storage = createStateBallotStorage(stage);
		await storage.write({ source: legacy, retrievedAt: timestamp, sha256: "a".repeat(64), records });
		const path = join(stage, `${source.id}.json`);
		const before = await readFile(path, "utf8");
		await assert.rejects(storage.read(source));
		assert.equal(await readFile(path, "utf8"), before);
		assert.throws(() => parseBundledStateSnapshot(source, before));
	}
	finally { await rm(stage, { recursive: true }); }
});
