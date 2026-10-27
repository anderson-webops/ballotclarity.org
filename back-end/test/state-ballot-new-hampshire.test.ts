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

const source = stateBallotSources.find(item => item.stateCode === "NH")!;
const now = Date.parse("2026-10-22T12:00:01Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function payload() {
	const retrievedAt = "2026-10-21T16:32:49.853Z";
	const definitions = [
		["Governor Example", "Governor", "statewide", "", "Libertarian"],
		["Federal Senate Example", "United States Senator", "statewide", "", "Constitution"],
		["Congress Example", "Representative in Congress", "congressional", "", "Republican"],
		["Senate Example", "State Senator", "state-senate", "", "Democratic"],
		["House Example One", "State Representatives, Belknap District 7", "state-house", "BELKNAP-7", "Republican"],
		["House Example Two", "State Representative, Grafton District 10", "state-house", "GRAFTON-10", "Democratic"],
		["House Example Three", "State Representative, Grafton District 18", "state-house", "GRAFTON-18", "Republican"],
		["House Example Four", "State Representatives, Hillsborough District 29", "state-house", "HILLSBOROUGH-29", "Democratic"],
		["House Example Five", "State Representatives, Hillsborough District 44", "state-house", "HILLSBOROUGH-44", "Republican"],
		["Sheriff Example", "Sheriff", "local", "", "Republican / Democratic"],
	];
	const records = definitions.map(([name, office, scope, district, party]) => ({ id: hash(`${name}/${office}`).slice(0, 24), name, office, scope, district, party, status: "listed", sourceAreaLabel: "Synthetic town sample ballot" }));
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(String(index)), retrievedAt, includedRecordCount: index === 2 ? 2 : 4 }));
	return { schemaVersion: 1, stateCode: "NH", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

test("New Hampshire requires an external reviewed three-ballot import without downloading a fallback", async () => {
	assert.equal(source.snapshotStorage, "external");
	assert.equal(source.documentUrls?.length, 3);
	assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
	await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	let requests = 0;
	const fetchText = async () => {
		requests += 1;
		throw new Error("No publisher requests permitted.");
	};
	assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText }).getSnapshot("NH"), null);
	await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
	assert.equal(requests, 0);
});

test("New Hampshire preserves source dates, literal party labels and incomplete regional eligibility", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-new-hampshire-import-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const original = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	await createStateBallotStorage(directory).write(original);
	const loaded = await createStateBallotRepository({ dataDirectory: directory, now: () => now }).getSnapshot("NH");
	assert.deepEqual(loaded, original);
	const preview = buildStateBallotPreview(loaded!, { districtMatches: [] })!;
	assert.equal(preview.candidateCount, 2);
	assert.equal(preview.contestCount, 2);
	assert.equal(preview.generatedAt, original.retrievedAt);
	assert.equal(original.records.at(-1)!.party, "Republican / Democratic");
	assert.equal(original.records.at(-1)!.status, "listed");
	assert.match(preview.disclaimer, /Alton, Bristol and Goffstown/u);
	assert.ok(preview.contests.every(contest => ["Governor", "United States Senator"].includes(contest.title)));
});

test("New Hampshire county-named House districts never become bare numbers or inferred congressional and Senate districts", () => {
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	const previewFor = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography fixture" }] })!;
	for (const district of ["7", "10", "18", "29", "44"]) assert.equal(previewFor("state-house", district).candidateCount, 2);
	for (const district of ["BELKNAP-7", "GRAFTON-10", "GRAFTON-18", "HILLSBOROUGH-29", "HILLSBOROUGH-44"]) assert.equal(previewFor("state-house", district).candidateCount, 3);
	assert.equal(previewFor("congressional", "1").candidateCount, 2);
	assert.equal(previewFor("state-senate", "1").candidateCount, 2);
	assert.equal(previewFor("county", "7").candidateCount, 2);
	assert.equal(previewFor("ward", "7").candidateCount, 2);
});

test("New Hampshire rejects changed document sets, fingerprints, contribution counts and private fields", () => {
	const original = payload();
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.slice(1) })), /document set/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: [...original.documents].reverse() })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, sourceSha256: "a".repeat(64) })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.map(document => ({ ...document, includedRecordCount: 1 })) })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, records: original.records.map(record => ({ ...record, residentialAddress: "excluded" })) })), /layout/u);
});

test("New Hampshire management import and restart preserve exact transfer bytes and refuse automatic refresh", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-new-hampshire-cli-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, "synthetic-new-hampshire.json");
	const data = payload();
	await writeFile(file, JSON.stringify(data));
	const environment = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "NH" };
	const manager = fileURLToPath(new URL("../src/manage-state-ballot-data.ts", import.meta.url));
	const exporter = fileURLToPath(new URL("../src/export-state-ballot-sources.ts", import.meta.url));
	const imported = execFileSync(process.execPath, ["--import", "tsx", manager, "import", file], { env: environment, encoding: "utf8" });
	assert.equal(JSON.parse(imported).records, 10);
	const expected = serializeStateBallotSnapshots([parseBundledStateSnapshot(source, JSON.stringify(data))]);
	assert.equal(execFileSync(process.execPath, ["--import", "tsx", exporter, "NH"], { env: environment, encoding: "utf8" }), expected);
	assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", manager, "refresh", "NH"], { env: { ...environment, STATE_BALLOT_ENABLED_SOURCES: source.id }, encoding: "utf8", stdio: "pipe" }), /manual|reviewed/iu);
});
