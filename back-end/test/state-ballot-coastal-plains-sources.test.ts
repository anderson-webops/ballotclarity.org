import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

for (const [code, sourceId, documentCount] of [["RI", "ri-east-greenwich-2026", 5], ["OK", "ok-woodward-2026", 3], ["ME", "me-local-samples-2026", 5]] as const) {
	const source = stateBallotSources.find(item => item.stateCode === code)!;
	const hash = (value: string) => createHash("sha256").update(value).digest("hex");
	const retrievedAt = "2026-10-21T12:00:00.000Z";
	const records = [
		{ id: "a".repeat(24), name: "State Example", office: "Governor", district: "", scope: "statewide", status: "listed" },
		{ id: "b".repeat(24), name: "District Example", office: "State Representative", district: "24", scope: "state-house", status: "listed" },
		{ id: "c".repeat(24), name: "Retention Example", office: "Court District 24 - Office 1", district: "", scope: "local", status: "listed", ballotDesignation: "Judicial retention; Yes / No" },
		{ id: "d".repeat(24), name: "Municipal Example", office: "School Board - remainder of term", district: "", scope: "local", status: "listed", jurisdiction: "Sample town" },
	];
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(url), retrievedAt, includedRecordCount: index === 0 ? records.length : 0 }));
	const payload = { schemaVersion: 1, stateCode: code, sourceId, sourceUrl: source.pageUrl, electionDate: "2026-11-03", retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };

	test(`${code} requires its full externally reviewed document set without automatic requests`, async () => {
		assert.equal(source.id, sourceId);
		assert.equal(source.format, "reviewed-pdf");
		assert.equal(source.retrievalPolicy, "manual-snapshot");
		assert.equal(source.snapshotStorage, "external");
		assert.equal(source.documentUrls!.length, documentCount);
		assert.deepEqual(source.documentLinks!.map(item => item.url), source.documentUrls);
		assert.match(source.scopeNotice!, /only.*other.*missing/iu);
		assert.doesNotMatch(source.scopeNotice!, /later changes/iu);
		await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
		let requests = 0;
		const fetchText = async () => {
			requests++;
			throw new Error("No publisher request permitted.");
		};
		await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
		assert.equal(await createStateBallotRepository({ dataDirectory: null, fetchText }).getSnapshot(code), null);
		assert.equal(requests, 0);
	});

	test(`${code} preserves zero-contribution originals and rejects partial or reassigned provenance`, () => {
		const parsed = parseBundledStateSnapshot(source, JSON.stringify(payload));
		assert.equal(parsed.documents!.length, documentCount);
		assert.equal(parsed.documents![1]!.includedRecordCount, 0);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...payload, documents: documents.slice(1) })), /document set/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...payload, electionDate: "2028-11-07" })), /configured source/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...payload, documents: documents.map((document, index) => index === 0 ? { ...document, includedRecordCount: records.length + 1 } : document) })), /captured provenance/u);
		if (code === "ME") assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...payload, sourceId: "me-bangor-2026" })), /configured source/u);
	});

	test(`${code} survives cache restart without promoting courts, wards or towns to legislative geography`, async (context) => {
		const directory = await mkdtemp(join(tmpdir(), "ballot-reviewed-samples-"));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const original = parseBundledStateSnapshot(source, JSON.stringify(payload));
		await createStateBallotStorage(directory).write(original);
		let requests = 0;
		const repository = createStateBallotRepository({
			dataDirectory: directory,
			now: () => Date.parse("2026-10-22T12:00:00Z"),
			fetchText: async () => {
				requests++;
				throw new Error("No publisher request permitted.");
			},
		});
		const loaded = await repository.getSnapshot(code);
		assert.deepEqual(loaded, original);
		assert.equal(buildStateBallotPreview(loaded!, { districtMatches: [] })!.candidateCount, 1);
		const matching = buildStateBallotPreview(loaded!, { districtMatches: [{ id: "house:24", label: "24", districtType: "state-house", districtCode: "24", sourceSystem: "Synthetic typed geography" }] })!;
		assert.equal(matching.candidateCount, 2);
		for (const type of ["judicial", "county", "ward", "school"]) assert.equal(buildStateBallotPreview(loaded!, { districtMatches: [{ id: `${type}:24`, label: "24", districtType: type, districtCode: "24", sourceSystem: "Synthetic nonlegislative geography" }] })!.candidateCount, 1);
		assert.equal(requests, 0);
	});
}
