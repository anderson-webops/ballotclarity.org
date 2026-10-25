import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters } from "../src/state-records.js";

const source = stateBallotSources.find(item => item.stateCode === "TN")!;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = Date.parse("2026-10-22T12:00:01Z");

function payload() {
	const retrievedAt = "2026-10-21T20:11:08.276Z";
	const records = [
		{ name: "Governor Example", office: "Governor", scope: "statewide", district: "", party: "Independent" },
		{ name: "Senator Example", office: "United States Senate", scope: "statewide", district: "", party: "Democratic" },
		{ name: "Congress Example", office: "United States House of Representatives, District 9", scope: "congressional", district: "9", party: "Republican" },
		{ name: "State Senator Example", office: "Tennessee Senate, District 27", scope: "state-senate", district: "27" },
		{ name: "House Example", office: "Tennessee House of Representatives, District 61", scope: "state-house", district: "61" },
		{ name: "Local Example", office: "Alderman", scope: "local", district: "", jurisdiction: "Town of Thompson's Station", ballotDesignation: "Vote for Two (2)" },
	].map(record => ({ ...record, id: hash(JSON.stringify(record)).slice(0, 24), status: "listed" }));
	const documents = [{ url: source.documentUrls![0], sha256: hash("Synthetic reviewed source"), retrievedAt, includedRecordCount: records.length }];
	return { schemaVersion: 1, stateCode: "TN", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

const typed = (districtType: string, districtCode: string) => ({ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Controlled geography fixture" });

test("Tennessee requires a reviewed external import and makes no automatic publisher requests", async () => {
	assert.equal(source.retrievalPolicy, "manual-snapshot");
	assert.equal(source.snapshotStorage, "external");
	assert.equal(source.format, "reviewed-pdf");
	assert.deepEqual(source.withheldDistrictScopes, ["congressional"]);
	assert.equal(source.documentUrls?.length, 1);
	assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
	await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	let requests = 0;
	const fetchText = async () => {
		requests += 1;
		throw new Error("No publisher request is permitted.");
	};
	assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText }).getSnapshot("TN"), null);
	await assert.rejects(fetchStateBallotSourceText(source, fetchText), /manually supplied/u);
	assert.equal(requests, 0);
});

test("Tennessee preserves source facts across storage, restart and export", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-tennessee-import-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	await createStateBallotStorage(directory).write(snapshot);
	const loaded = await createStateBallotRepository({ dataDirectory: directory, now: () => now }).getSnapshot("TN");
	assert.deepEqual(loaded, snapshot);
	const exported = serializeStateBallotSnapshots([loaded!]).trim().split("\n").map(line => JSON.parse(line));
	assert.equal(exported.length, snapshot.records.length + 1);
	assert.deepEqual(exported.slice(1).map(record => record.name), snapshot.records.map(record => record.name));
	assert.equal(loaded!.records.at(-1)!.party, undefined);
	assert.equal(loaded!.records.at(-1)!.ballotDesignation, "Vote for Two (2)");
});

test("withheld congressional records remain browsable but never enter an address preview", () => {
	const snapshot = parseBundledStateSnapshot(source, JSON.stringify(payload()));
	const congressional = buildStateRecordPage(snapshot, parseStateRecordFilters({ scope: "congressional" }));
	assert.equal(congressional.matched, 1);
	assert.equal(congressional.records[0].name, "Congress Example");
	for (const matches of [[], [typed("congressional", "9")], [typed("congressional-district", "09")], [typed("cd", "9")], [typed("county", "9")], [typed("place", "61")]]) {
		const preview = buildStateBallotPreview(snapshot, { districtMatches: matches })!;
		assert.equal(preview.candidateCount, 2);
		assert.ok(!preview.contests.some(contest => contest.title.includes("Representatives")));
		assert.ok(preview.disclaimer.includes(source.scopeNotice!));
	}
	const matched = buildStateBallotPreview(snapshot, { districtMatches: [typed("congressional", "9"), typed("state-senate", "27"), typed("state-house", "61")] })!;
	assert.equal(matched.candidateCount, 4);
	assert.ok(!matched.contests.some(contest => contest.candidates.some(candidate => candidate.name === "Local Example" || candidate.name === "Congress Example")));
	const stalePolicy = buildStateBallotPreview({ ...snapshot, source: { ...source, withheldDistrictScopes: undefined } }, { districtMatches: [typed("congressional", "9")] })!;
	assert.equal(stalePolicy.candidateCount, 2);
	const unaffected = buildStateBallotPreview({ ...snapshot, source: { ...source, id: "unregistered-controlled-fixture", withheldDistrictScopes: undefined } }, { districtMatches: [typed("congressional", "9")] })!;
	assert.equal(unaffected.candidateCount, 3);
});

test("source-level boundary restrictions cannot be supplied through a data payload", () => {
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...payload(), withheldDistrictScopes: [] })), /unexpected fields/u);
	const changed = payload();
	changed.documents[0].url = "https://example.test/other-election.pdf";
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed)), /invalid provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...payload(), electionDate: "2028-11-07" })), /does not match/u);
});

test("changing a source boundary restriction invalidates an old external envelope", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-tennessee-boundary-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createStateBallotStorage(directory).write(parseBundledStateSnapshot(source, JSON.stringify(payload())));
	await assert.rejects(createStateBallotStorage(directory).read({ ...source, withheldDistrictScopes: [] }), /does not match the configured source/u);
});
