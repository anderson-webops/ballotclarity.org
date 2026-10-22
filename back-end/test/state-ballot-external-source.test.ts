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

const source = stateBallotSources.find(item => item.stateCode === "NY")!;
const now = Date.parse("2026-10-22T00:00:01Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function payload() {
	const retrievedAt = "2026-10-22T00:00:00.000Z";
	const definitions = [
		["Governor Example", "GOVERNOR", "statewide", "", "Democratic / Working Families"],
		["Lieutenant Example", "LIEUTENANT GOVERNOR", "statewide", "", "Democratic / Working Families"],
		["Congress Example", "REPRESENTATIVE IN CONGRESS 25TH DISTRICT", "congressional", "25", "Republican / Conservative"],
		["Senate Example", "STATE SENATOR-55TH DISTRICT", "state-senate", "55", "Democratic"],
		["Assembly Example", "MEMBER OF ASSEMBLY-137TH DISTRICT", "state-house", "137", "Working Families"],
		["Ward Example", "GREECE-MEMBER OF TOWN COUNCIL WARD 3", "local", "", "Community First"],
		["Council Example", "IRONDEQUOIT-MEMBER OF TOWN COUNCIL - 1 YEAR TERM", "local", "", "Democratic"],
		["Council Example", "IRONDEQUOIT-MEMBER OF TOWN COUNCIL - TERM ENDING 2028", "local", "", "Republican"]
	];
	const records = definitions.map(([name, office, scope, district, party]) => ({ id: hash(`${name}/${office}`).slice(0, 24), name, office, scope, district, party, status: "listed" }));
	const documents = [{ url: source.url, sha256: "a".repeat(64), retrievedAt, includedRecordCount: records.length }];
	return { schemaVersion: 1, stateCode: "NY", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

test("external-only reviewed sources never fall back to bundled files or a publisher request", async () => {
	assert.equal(source.snapshotStorage, "external");
	await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	let requests = 0;
	const fetchText = async () => {
		requests += 1;
		throw new Error("No publisher request is permitted.");
	};
	assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText }).getSnapshot("NY"), null);
	await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
	assert.equal(requests, 0);
});

test("external import preserves separate offices, fusion labels, dates and limited local eligibility", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-external-source-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const original = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	await createStateBallotStorage(directory).write(original);
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now });
	const loaded = await repository.getSnapshot("NY");
	assert.deepEqual(loaded, original);
	const statewide = buildStateBallotPreview(loaded!, { districtMatches: [] })!;
	assert.equal(statewide.candidateCount, 2);
	assert.deepEqual(statewide.contests.map(contest => contest.title), ["GOVERNOR", "LIEUTENANT GOVERNOR"]);
	assert.match(statewide.contests[0]!.candidates[0]!.party!, /Democratic \/ Working Families/u);
	assert.equal(statewide.generatedAt, original.retrievedAt);
	assert.match(statewide.disclaimer, /Monroe County-certified/u);
	const districtMatches = [["congressional", "25"], ["state-senate", "55"], ["state-house", "137"], ["ward", "3"]].map(([districtType, districtCode]) => ({ id: `${districtType}:${districtCode}`, label: districtCode!, districtType: districtType!, districtCode: districtCode!, sourceSystem: "Synthetic geography fixture" }));
	const address = buildStateBallotPreview(loaded!, { districtMatches })!;
	assert.equal(address.candidateCount, 5);
	assert.equal(address.contests.some(contest => /GREECE|IRONDEQUOIT/u.test(contest.title)), false);
	assert.notEqual(original.records[6]!.id, original.records[7]!.id);
});

test("external snapshots reject changed election, source documents and private fields", () => {
	const original = payload();
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, electionDate: "2028-11-07" })), /configured source/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, stateCode: "NJ" })), /configured source/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: [{ ...original.documents[0], url: "https://other.example.test/list.pdf" }] })), /provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, records: original.records.map(record => ({ ...record, address: "excluded" })) })), /layout/u);
});

test("an empty external directory remains unavailable instead of claiming bundled coverage", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-external-missing-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now });
	assert.equal(await repository.getSnapshot("NY"), null);
});

test("the management command imports external-only snapshots without adding a bundled asset", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-external-cli-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, "reviewed-synthetic.json");
	const data = payload();
	data.retrievedAt = "2026-10-21T00:00:00.000Z";
	data.documents[0]!.retrievedAt = data.retrievedAt;
	await writeFile(file, JSON.stringify(data));
	const script = new URL("../src/manage-state-ballot-data.ts", import.meta.url).pathname;
	const output = execFileSync(process.execPath, ["--import", "tsx", script, "import", file], { env: { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "NY" }, encoding: "utf8" });
	assert.equal(JSON.parse(output).records, 8);
	assert.equal((await createStateBallotStorage(directory).read(source))?.records.length, 8);
});
