import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = Date.parse("2026-10-22T12:00:01Z");
const sourceFor = (stateCode: string) => stateBallotSources.find(source => source.stateCode === stateCode)!;

function payload(stateCode: "MN" | "IA") {
	const source = sourceFor(stateCode);
	const retrievedAt = "2026-10-21T17:25:35.543Z";
	const definitions = stateCode === "MN"
		? [
				["Governor Example / Deputy Example", "Governor and Lieutenant Governor", "statewide", ""],
				["Justice Example", "Supreme Court, Associate Justice 1", "statewide", ""],
				["Appeals Example", "Court of Appeals, Judge 1", "statewide", ""],
				["Congress Example", "United States Representative, District 3", "congressional", "3"],
				["Senator Example", "State Senator, District 37", "state-senate", "37"],
				["House Example", "State Representative, District 37A", "state-house", "37A"],
				["Park Example", "Three Rivers Park Commissioner, District 1", "local", "1"],
				["School Example", "School Board Member", "local", "879"],
				["District Judge Example", "4th District Court, Judge 1", "local", "4"],
			]
		: [
				["Governor Example / Deputy Example", "Governor / Lieutenant Governor", "statewide", ""],
				["Appeals Example One", "Court of Appeals retention - Appeals Example One", "statewide", ""],
				["Appeals Example Two", "Court of Appeals retention - Appeals Example Two", "statewide", ""],
				["Congress Example", "U.S. Representative, District 4", "congressional", "4"],
				["Senator Example", "State Senator, District 25", "state-senate", "25"],
				["House Example One", "State Representative, District 48", "state-house", "48"],
				["House Example Two", "State Representative, District 50", "state-house", "50"],
				["District Judge Example", "District 2B District Court retention - District Judge Example", "local", "2B"],
				["Supervisor Example", "County Board of Supervisors, District 1", "local", "1"],
			];
	const records = definitions.map(([name, office, scope, district]) => ({
		id: hash(`${stateCode}/${name}/${office}`).slice(0, 24),
		name,
		office,
		scope,
		district,
		status: stateCode === "IA" ? "qualified" : "listed",
		...(office.includes("retention") ? { sourceStatus: "Judicial retention election" } : {}),
		...(office.startsWith("County Board") ? { ballotDesignation: "Incumbent; currently elected at-large" } : {}),
	}));
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(`${stateCode}/${index}`), retrievedAt, includedRecordCount: stateCode === "MN" ? [7, 0, 1, 1][index] : records.length }));
	return { schemaVersion: 1, stateCode, sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

for (const stateCode of ["MN", "IA"] as const) {
	test(`${stateCode} requires an external reviewed import without publisher requests or a bundled fallback`, async () => {
		const source = sourceFor(stateCode);
		assert.equal(source.snapshotStorage, "external");
		assert.equal(source.retrievalPolicy, "manual-snapshot");
		assert.equal(source.documentUrls?.length, stateCode === "MN" ? 4 : 1);
		if (stateCode === "MN") assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
		await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
		let requests = 0;
		const fetchText = async () => {
			requests += 1;
			throw new Error("Publisher requests are not permitted in this test.");
		};
		assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText }).getSnapshot(stateCode), null);
		await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
		assert.equal(requests, 0);
	});

	test(`${stateCode} preserves captured provenance and candidate statuses across storage and restart`, async (context) => {
		const directory = await mkdtemp(join(tmpdir(), `ballot-${stateCode.toLowerCase()}-import-`));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const snapshot = parseBundledStateSnapshot(sourceFor(stateCode), JSON.stringify(payload(stateCode)));
		await createStateBallotStorage(directory).write(snapshot);
		const loaded = await createStateBallotRepository({ dataDirectory: directory, now: () => now }).getSnapshot(stateCode);
		assert.deepEqual(loaded, snapshot);
		const preview = buildStateBallotPreview(loaded!, { districtMatches: [] })!;
		assert.equal(preview.candidateCount, 3);
		assert.equal(preview.contestCount, 3);
		assert.equal(preview.generatedAt, snapshot.retrievedAt);
		assert.ok(snapshot.records.every(record => record.status === (stateCode === "MN" ? "listed" : "qualified")));
		assert.equal(preview.contests[0].candidates.length, 1);
		assert.equal(preview.contests[0].candidates[0].name, "Governor Example / Deputy Example");
		if (stateCode === "MN") {
			assert.ok(snapshot.records.every(record => record.sourceStatus === undefined));
		}
		else {
			assert.equal(preview.contests.filter(contest => contest.title.startsWith("Court of Appeals retention")).length, 2);
			assert.equal(snapshot.records.at(-1)!.ballotDesignation, "Incumbent; currently elected at-large");
		}
	});

	test(`${stateCode} rejects mismatched source identities, altered document sets and contact fields`, () => {
		const source = sourceFor(stateCode);
		const original = payload(stateCode);
		const parse = (data: unknown) => parseBundledStateSnapshot(source, JSON.stringify(data));
		assert.throws(() => parse({ ...original, electionDate: "2024-11-05" }), /configured source/u);
		assert.throws(() => parse({ ...original, sourceId: "another-source" }), /configured source/u);
		assert.throws(() => parse({ ...original, documents: original.documents.slice(1) }), /document set/u);
		assert.throws(() => parse({ ...original, sourceSha256: "a".repeat(64) }), /provenance/u);
		assert.throws(() => parse({ ...original, retrievedAt: "2026-10-22T17:25:35.543Z" }), /provenance/u);
		for (const field of ["residentialAddress", "phone", "email"]) assert.throws(() => parse({ ...original, records: original.records.map(record => ({ ...record, [field]: "excluded" })) }), /layout/u);
	});

	test(`${stateCode} management import exports exact bytes after restart and refuses automatic refresh`, async (context) => {
		const directory = await mkdtemp(join(tmpdir(), `ballot-${stateCode.toLowerCase()}-cli-`));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const file = join(directory, "synthetic-snapshot.json");
		const data = payload(stateCode);
		await writeFile(file, JSON.stringify(data));
		const environment = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: stateCode };
		const manager = fileURLToPath(new URL("../src/manage-state-ballot-data.ts", import.meta.url));
		const exporter = fileURLToPath(new URL("../src/export-state-ballot-sources.ts", import.meta.url));
		const imported = execFileSync(process.execPath, ["--import", "tsx", manager, "import", file], { env: environment, encoding: "utf8" });
		assert.equal(JSON.parse(imported).records, data.records.length);
		const expected = serializeStateBallotSnapshots([parseBundledStateSnapshot(sourceFor(stateCode), JSON.stringify(data))]);
		assert.equal(execFileSync(process.execPath, ["--import", "tsx", exporter, stateCode], { env: environment, encoding: "utf8" }), expected);
		assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", manager, "refresh", stateCode], { env: environment, encoding: "utf8", stdio: "pipe" }), /manual|reviewed/iu);
	});
}

test("A duplicate Minnesota ballot may contribute zero unique records without dropping its provenance", () => {
	const source = sourceFor("MN");
	const original = payload("MN");
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(original));
	assert.equal(snapshot.documents?.length, 4);
	assert.equal(snapshot.documents?.[1].includedRecordCount, 0);
	for (const count of [-1, 0.5, 1, Number.MAX_SAFE_INTEGER + 1]) {
		const documents = original.documents.map((document, index) => ({ ...document, includedRecordCount: index === 1 ? count : document.includedRecordCount }));
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents })), /provenance/u);
	}
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.map(document => ({ ...document, includedRecordCount: 0 })) })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: [...original.documents].reverse() })), /provenance/u);
});

test("Typed district matches preserve Minnesota letter suffixes and never select local judicial, school or park records", () => {
	const snapshot = parseBundledStateSnapshot(sourceFor("MN"), JSON.stringify(payload("MN")));
	const previewFor = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography fixture" }] })!;
	for (const [type, code] of [["congressional", "3"], ["state-senate", "37"], ["state-house", "37A"]]) assert.equal(previewFor(type, code).candidateCount, 4);
	for (const [type, code] of [["state-house", "37"], ["congressional", "1"], ["congressional", "4"], ["state-house", "879"], ["ward", "1"], ["county", "4"]]) assert.equal(previewFor(type, code).candidateCount, 3);
});

test("Iowa retains separate judicial retention questions and only exact federal and legislative eligibility", () => {
	const snapshot = parseBundledStateSnapshot(sourceFor("IA"), JSON.stringify(payload("IA")));
	const previewFor = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography fixture" }] })!;
	for (const [type, code] of [["congressional", "4"], ["state-senate", "25"], ["state-house", "48"], ["state-house", "50"]]) assert.equal(previewFor(type, code).candidateCount, 4);
	for (const [type, code] of [["congressional", "1"], ["state-house", "2B"], ["ward", "1"], ["county", "1"]]) assert.equal(previewFor(type, code).candidateCount, 3);
	assert.equal(snapshot.records.filter(record => record.sourceStatus === "Judicial retention election").length, 3);
	assert.equal(new Set(snapshot.records.filter(record => record.sourceStatus).map(record => record.office)).size, 3);
});
