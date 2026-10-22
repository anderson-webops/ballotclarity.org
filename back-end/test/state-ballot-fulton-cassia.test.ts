import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { buildStateRecordPage, parseStateRecordFilters } from "../src/state-records.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sources = ["GA", "ID"].map(code => stateBallotSources.find(source => source.stateCode === code)!);
const now = Date.parse("2026-10-22T12:00:01Z");

function payload(code: string) {
	const source = sources.find(item => item.stateCode === code)!;
	const records = code === "GA"
		? [
				{ name: "Governor Example", office: "Governor", scope: "statewide", district: "", party: "Democrat" },
				{ name: "PSC Three Example", office: "Public Service Commissioner District 3", scope: "statewide", district: "3", party: "Republican" },
				{ name: "PSC Five Example", office: "Public Service Commissioner District 5", scope: "statewide", district: "5", party: "Democrat" },
				{ name: "Congress Example", office: "United States House District 5", scope: "congressional", district: "5" },
				{ name: "Senate Example", office: "State Senate District 14", scope: "state-senate", district: "14" },
				{ name: "House Example", office: "State House District 25", scope: "state-house", district: "25" },
				{ name: "Commission Example", office: "County Commissioner District 4 (Unexpired Term)", scope: "local", district: "4", ballotDesignation: "Unexpired Term; predecessor resigned" },
				{ name: "Conservation Example", office: "Soil & Water Conservation District Supervisor", scope: "local", district: "" },
				{ name: "Write-In Example", office: "County Commissioner District 5", scope: "local", district: "5", status: "write-in", sourceStatus: "Qualified write-in" },
			]
		: [
				{ name: "Governor Example", office: "Governor", scope: "statewide", district: "", party: "CON", ballotDesignation: "a person, formerly known as Previous Name" },
				{ name: "Federal Senate Example", office: "United States Senator", scope: "statewide", district: "", party: "IND" },
				{ name: "Congress Example", office: "United States Representative District 2", scope: "congressional", district: "2", party: "DEM" },
				{ name: "Senate Example", office: "State Senator District 27", scope: "state-senate", district: "27", party: "REP" },
				{ name: "House A Example", office: "State Representative District 27 Seat A", scope: "state-house", district: "27", party: "REP" },
				{ name: "House B Example", office: "State Representative District 27 Seat B", scope: "state-house", district: "27", party: "REP" },
				{ name: "Commission One Example", office: "County Commissioner District 1", scope: "local", district: "1", ballotDesignation: "4 Year Term" },
				{ name: "Commission Two Example", office: "County Commissioner District 2", scope: "local", district: "2", ballotDesignation: "2 Year Term" },
				{ name: "Retention Example", office: "Magistrate Judge, Fifth Judicial District (Retention)", scope: "local", district: "5", ballotDesignation: "Retention; Nonpartisan ballot" },
			];
	const retrievedAt = "2026-10-21T22:12:05.210Z";
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(`${code}/${index}`), retrievedAt, includedRecordCount: code === "GA" ? [8, 1, 0][index] : [9, 0, 0][index] }));
	return { schemaVersion: 1, stateCode: code, sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records: records.map(record => ({ id: hash(`${code}/${record.office}/${record.name}`).slice(0, 24), status: "listed", ...record, sourceAreaLabel: code === "GA" ? "Fulton County" : "Cassia County" })), documents };
}

for (const source of sources) {
	test(`${source.stateCode} requires an external reviewed import and never automatically fetches PDFs or voter records`, async () => {
		assert.equal(source.snapshotStorage, "external");
		assert.equal(source.retrievalPolicy, "manual-snapshot");
		assert.equal(source.documentUrls?.length, 3);
		assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
		await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
		let requests = 0;
		const fetchText = async () => {
			requests++;
			throw new Error("No publisher request permitted.");
		};
		assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText }).getSnapshot(source.stateCode), null);
		await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
		assert.equal(requests, 0);
	});

	test(`${source.stateCode} preserves ordered zero-contribution documents, source fingerprints and exact cache/export records`, async (context) => {
		const directory = await mkdtemp(join(tmpdir(), `ballot-${source.stateCode.toLowerCase()}-review-`));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const original = parseBundledStateSnapshot(source, JSON.stringify(payload(source.stateCode)));
		assert.equal(original.documents!.at(-1)!.includedRecordCount, 0);
		await createStateBallotStorage(directory).write(original);
		const loaded = await createStateBallotRepository({ dataDirectory: directory, now: () => now }).getSnapshot(source.stateCode);
		assert.deepEqual(loaded, original);
		assert.equal(serializeStateBallotSnapshots([loaded!]), serializeStateBallotSnapshots([original]));
		const preview = buildStateBallotPreview(loaded!, { districtMatches: [] })!;
		assert.equal(preview.generatedAt, original.retrievedAt);
		assert.ok(preview.disclaimer.includes(source.scopeNotice!));
	});

	test(`${source.stateCode} rejects wrong elections, missing or reordered documents, invalid contributions and private fields`, () => {
		const original = payload(source.stateCode);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, electionDate: "2028-11-07" })), /configured source/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.slice(1) })), /document set/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: [...original.documents].reverse() })), /provenance/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, sourceSha256: "a".repeat(64) })), /provenance/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, documents: original.documents.map(document => ({ ...document, includedRecordCount: 1 })) })), /provenance/u);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...original, records: original.records.map(record => ({ ...record, residentialAddress: "excluded" })) })), /layout/u);
	});

	test(`${source.stateCode} management import survives restart and refuses automatic refresh without altering the accepted cache`, async (context) => {
		const directory = await mkdtemp(join(tmpdir(), `ballot-${source.stateCode.toLowerCase()}-cli-`));
		context.after(() => rm(directory, { recursive: true, force: true }));
		const file = join(directory, "reviewed.json");
		const body = JSON.stringify(payload(source.stateCode));
		await writeFile(file, body);
		const environment = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: source.stateCode };
		const manager = fileURLToPath(new URL("../src/manage-state-ballot-data.ts", import.meta.url));
		const exporter = fileURLToPath(new URL("../src/export-state-ballot-sources.ts", import.meta.url));
		const imported = execFileSync(process.execPath, ["--import", "tsx", manager, "import", file], { env: environment, encoding: "utf8" });
		assert.equal(JSON.parse(imported).records, 9);
		const expected = serializeStateBallotSnapshots([parseBundledStateSnapshot(source, body)]);
		assert.equal(execFileSync(process.execPath, ["--import", "tsx", exporter, source.stateCode], { env: environment, encoding: "utf8" }), expected);
		const cacheFile = join(directory, `${source.id}.json`);
		const before = hash(await readFile(cacheFile, "utf8"));
		assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", manager, "refresh", source.stateCode], { env: environment, encoding: "utf8", stdio: "pipe" }), /manual|reviewed/iu);
		assert.equal(hash(await readFile(cacheFile, "utf8")), before);
	});
}

test("Georgia PSC residency districts apply statewide while county and soil/water districts never become legislative eligibility", () => {
	const source = sources[0]!;
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(payload("GA")));
	const previewFor = (districtType?: string, districtCode?: string) => buildStateBallotPreview(snapshot, { districtMatches: districtType ? [{ id: `${districtType}:${districtCode}`, districtType, districtCode: districtCode!, label: districtCode!, sourceSystem: "Synthetic typed geography" }] : [] })!;
	assert.equal(previewFor().candidateCount, 3);
	assert.equal(previewFor("congressional", "5").candidateCount, 4);
	assert.equal(previewFor("state-senate", "14").candidateCount, 4);
	assert.equal(previewFor("state-house", "25").candidateCount, 4);
	for (const type of ["county", "ward", "judicial", "school"]) assert.equal(previewFor(type, "5").candidateCount, 3);
	assert.ok(previewFor("state-senate", "3").contests.some(contest => contest.title === "Public Service Commissioner District 5"));
	const records = buildStateRecordPage(snapshot, parseStateRecordFilters({ status: "all" })).records;
	assert.equal(records.find(record => record.name === "Write-In Example")!.status, "write-in");
	assert.equal(records.find(record => record.name === "Conservation Example")!.party, undefined);
	assert.ok(!records.some(record => ["unopposed", "elected"].includes(record.status)));
});

test("Idaho House seats stay distinct and aliases, county terms and retention choices never become extra candidates", () => {
	const source = sources[1]!;
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(payload("ID")));
	const previewFor = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography" }] })!;
	assert.equal(previewFor("state-house", "27").candidateCount, 4);
	assert.equal(previewFor("state-house", "27").contests.filter(contest => /Seat [AB]$/u.test(contest.title)).length, 2);
	assert.equal(previewFor("state-senate", "27").candidateCount, 3);
	assert.equal(previewFor("congressional", "2").candidateCount, 3);
	for (const type of ["state-senate", "judicial", "county", "ward"]) assert.equal(previewFor(type, "5").candidateCount, 2);
	const records = buildStateRecordPage(snapshot, parseStateRecordFilters({ status: "all" })).records;
	assert.equal(records.length, 9);
	assert.equal(records.filter(record => /Retention/u.test(record.office)).length, 1);
	assert.equal(records.filter(record => record.party === "CON").length, 1);
	assert.equal(records.find(record => record.name === "Commission One Example")!.ballotDesignation, "4 Year Term");
	assert.ok(!records.some(record => ["Yes", "No", "Previous Name", "WRITE-IN"].includes(record.name)));
	assert.ok(!records.some(record => ["unopposed", "elected"].includes(record.status)));
});
