import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const source = stateBallotSources.find(item => item.stateCode === "VT")!;
const now = Date.parse("2026-10-22T00:00:01Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function payload() {
	const retrievedAt = "2026-10-22T00:00:00.000Z";
	const definitions = [
		["Congress Example", "REPRESENTATIVE TO CONGRESS", "statewide", "", "INDEPENDENT"],
		["Governor Example", "GOVERNOR", "statewide", "", "DEM/PROG"],
		["Lieutenant Example", "LIEUTENANT GOVERNOR", "statewide", "", "REPUBLICAN"],
		["House Example", "STATE REPRESENTATIVE - CHITTENDEN-8", "state-house", "CHITTENDEN-8", "DEMOCRATIC"],
		["Senate Example", "STATE SENATOR", "state-senate", "", "REPUBLICAN"],
		["Judge Example", "ASSISTANT JUDGE", "local", "", "DEM/REP"],
		["Peace Example", "JUSTICE OF THE PEACE", "local", "", "DEMOCRATIC"],
	];
	const records = definitions.map(([name, office, scope, district, party]) => ({ id: hash(`${name}/${office}`).slice(0, 24), name, office, scope, district, party, status: "listed" }));
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(String(index)), retrievedAt, includedRecordCount: index === 0 ? 3 : 1 }));
	return { schemaVersion: 1, stateCode: "VT", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

test("Vermont requires an external reviewed five-ballot import without network or bundled fallback", async () => {
	assert.equal(source.snapshotStorage, "external");
	assert.equal(source.documentUrls?.length, 5);
	await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	let requests = 0;
	const fetchText = async () => {
		requests += 1;
		throw new Error("No publisher request is permitted.");
	};
	assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText }).getSnapshot("VT"), null);
	await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
	assert.equal(requests, 0);
});

test("Vermont retains at-large Congress, separate governor offices and literal combined party labels", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-vermont-import-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const original = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	await createStateBallotStorage(directory).write(original);
	const loaded = await createStateBallotRepository({ dataDirectory: directory, now: () => now }).getSnapshot("VT");
	assert.deepEqual(loaded, original);
	const preview = buildStateBallotPreview(loaded!, { districtMatches: [] })!;
	assert.equal(preview.candidateCount, 3);
	assert.equal(preview.contestCount, 3);
	assert.deepEqual(preview.contests.map(contest => contest.title), ["REPRESENTATIVE TO CONGRESS", "GOVERNOR", "LIEUTENANT GOVERNOR"]);
	assert.equal(preview.contests[1]!.candidates[0]!.party, "DEM/PROG");
	assert.equal(preview.generatedAt, original.retrievedAt);
	assert.match(preview.disclaimer, /South Burlington sample ballots/u);
});

test("Vermont named House districts never match bare numbers or inferred Senate and local districts", () => {
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	const previewFor = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic geography fixture" }] })!;
	assert.equal(previewFor("state-house", "8").candidateCount, 3);
	assert.equal(previewFor("state-house", "CHITTENDEN-8").candidateCount, 4);
	assert.equal(previewFor("state-house", "CHITTENDEN-9").candidateCount, 3);
	assert.equal(previewFor("state-senate", "8").candidateCount, 3);
	assert.equal(previewFor("ward", "8").candidateCount, 3);
	assert.equal(previewFor("county", "007").candidateCount, 3);
	assert.equal(previewFor("congressional", "0").candidateCount, 3);
});

test("Vermont rejects missing or reordered ballot evidence, mismatched contributions and private fields", () => {
	const original = payload();
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.slice(1) })), /document set/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: [...original.documents].reverse() })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.map(document => ({ ...document, includedRecordCount: 1 })) })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, records: original.records.map(record => ({ ...record, residentialAddress: "excluded" })) })), /layout/u);
});

test("Vermont management import preserves reviewed source dates and refuses automatic refresh", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-vermont-cli-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, "synthetic-vermont.json");
	const data = payload();
	data.retrievedAt = "2026-10-21T00:00:00.000Z";
	for (const document of data.documents) document.retrievedAt = data.retrievedAt;
	await writeFile(file, JSON.stringify(data));
	const script = new URL("../src/manage-state-ballot-data.ts", import.meta.url).pathname;
	const env = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "VT" };
	const output = execFileSync(process.execPath, ["--import", "tsx", script, "import", file], { env, encoding: "utf8" });
	assert.equal(JSON.parse(output).records, 7);
	assert.equal((await createStateBallotStorage(directory).read(source))?.retrievedAt, data.retrievedAt);
	assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", script, "refresh", "VT"], { env, encoding: "utf8", stdio: "pipe" }), /manual|reviewed/iu);
});
