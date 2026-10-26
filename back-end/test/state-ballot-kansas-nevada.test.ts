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
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters } from "../src/state-records.js";

const kansas = stateBallotSources.find(source => source.stateCode === "KS")!;
const nevada = stateBallotSources.find(source => source.stateCode === "NV")!;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = Date.parse("2026-10-21T23:00:00Z");

function kansasHtml() {
	const definitions = [
		["U.S. Senate", "U.S. Senate", "Senator Example", "Democratic"],
		["U.S. Representative", "U.S. Representative 3rd District", "Congress Example", "Republican"],
		["Governor / Lieutenant Governor", "Governor/Lieutenant Governor", "Governor Example / Deputy Example", "Democratic"],
		["KS Representative", "Kansas Representative 5", "House Example", "Republican"],
		["Kansas Supreme Court Justices", "Kansas Supreme Court Justice Position 4", "Justice Example", "Nonpartisan office"],
		["Kansas Court of Appeals Judge", "Kansas Court of Appeals Judge Position 2", "Appeals Example", "Nonpartisan office"],
		["District Judge 10th District", "10th Judicial District Judge Division 1", "District Judge Example", "Nonpartisan office"],
		["State Board of Education", "State Board of Education 3", "Education Example", "Republican"],
		["County Commissioner", "County Commissioner District 3", "County Example", "Nonpartisan office"],
		["Spring Hill Township", "Clerk", "Tara A. Combs", "Democratic"],
		["Prairie Village", "Mayor", "Mayor Example", "Nonpartisan office"],
	];
	const groups = definitions.map(([heading, office, name, party]) => `<div class="view-grouping"><button class="view-grouping-header">${heading}</button><div class="view-grouping-content"><h3>${office}</h3><div class="candidate candidate--teaser"><h4 class="title">${name}</h4><ul><li><label>Incumbent:</label> Yes</li><li><label>Website:</label><span>campaign.example.test</span></li><li><label>City:</label>Residence is not jurisdiction</li><li><label>Phone:</label>555-0100</li><li><label>E-mail:</label><span data-cfemail="not-to-be-decoded">[email protected]</span></li></ul><p class="party">${party}</p></div></div></div>`).join("");
	return `<main><select name="field_election_reference_target_id"><option value="6023" selected>November 3, 2026 General Election</option></select><select name="field_office_jurisdiction_target_id_1"><option value="All" selected>All</option></select><select name="field_office_level_target_id_1"><option value="All" selected>All</option></select><p class="view-filters-info">Showing <strong>All</strong> Candidates</p><div class="view-content">${groups}</div></main>`;
}

function nevadaPayload() {
	const definitions = [
		["Governor Example", "Governor", "statewide", ""],
		["Deputy Example", "Lieutenant Governor", "statewide", ""],
		["Justice Example B", "Justice of the Supreme Court, Seat B", "statewide", ""],
		["Justice Example D", "Justice of the Supreme Court, Seat D", "statewide", ""],
		["Congress Example", "Representative in Congress, District 1", "congressional", "1"],
		["Senate Example", "State Senate, District 2", "state-senate", "2"],
		["House Example", "State Assembly, District 3", "state-house", "3"],
		["Local Example", "Board of Regents, District 2", "local", "2"],
	];
	const records = definitions.map(([name, office, scope, district]) => ({ id: hash(`${name}/${office}`).slice(0, 24), name, office, scope, district, status: "listed" }));
	const retrievedAt = "2026-10-21T18:07:42.245Z";
	const documents = nevada.documentUrls!.map((url, index) => ({ url, sha256: hash(String(index)), retrievedAt, includedRecordCount: index ? 0 : records.length }));
	return { schemaVersion: 1, stateCode: "NV", sourceId: nevada.id, electionDate: nevada.electionDate, sourceUrl: nevada.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, records, documents };
}

test("Kansas reads a complete general-election page through one permitted bounded request", async () => {
	const requests: string[] = [];
	const body = await fetchStateBallotSourceText(kansas, async (url, options) => {
		requests.push(url);
		assert.deepEqual(options?.allowedHosts, ["www.jocoelection.org"]);
		assert.equal(options?.postBody, undefined);
		return kansasHtml();
	});
	assert.deepEqual(requests, [kansas.url]);
	assert.equal(kansas.retrievalPolicy, undefined);
	assert.equal(parseStateCandidateRecords(kansas, body).length, 11);
});

test("Kansas preserves joint tickets, literal parties and individual judicial retention seats", () => {
	const records = parseStateCandidateRecords(kansas, kansasHtml());
	assert.equal(records.filter(record => record.office === "Governor/Lieutenant Governor").length, 1);
	assert.equal(records[2].name, "Governor Example / Deputy Example");
	assert.equal(records.filter(record => record.sourceStatus === "Judicial retention election").length, 3);
	assert.equal(new Set(records.filter(record => record.sourceStatus === "Judicial retention election").map(record => record.office)).size, 3);
	assert.ok(records.every(record => record.status === "listed" && record.ballotDesignation === "Incumbent"));
	assert.equal(records[9].sourceStatus, "Revised notice: Tara A. Combes");
	assert.equal(records[9].jurisdiction, "Spring Hill Township");
	const snapshot = { source: kansas, records, retrievedAt: new Date(now).toISOString(), sha256: hash("fixture") };
	assert.equal(buildStateRecordPage(snapshot, parseStateRecordFilters({ q: "Combes" })).records[0].name, "Tara A. Combs");
	assert.ok(!JSON.stringify(records).includes("555-0100"));
	assert.ok(!JSON.stringify(records).includes("not-to-be-decoded"));
	assert.ok(!JSON.stringify(records).includes("Residence is not jurisdiction"));
	assert.equal(records[0].candidateUrl, "https://campaign.example.test/");
});

test("Kansas refuses wrong election dates, selected subsets, pagination and empty results", () => {
	for (const html of [kansasHtml().replace("November 3, 2026 General Election", "August 4, 2026 Primary Election"), kansasHtml().replace("value=\"6023\"", "value=\"6024\""), kansasHtml().replace("value=\"All\" selected", "value=\"12\" selected"), `${kansasHtml()}<nav class="pager"><a rel="next">More</a></nav>`, kansasHtml().replace("Showing <strong>All</strong> Candidates", "Showing some candidates"), kansasHtml().replaceAll("class=\"candidate candidate--teaser\"", "class=\"missing-card\"")]) {
		assert.throws(() => parseStateCandidateRecords(kansas, html), /Kansas/u);
	}
	assert.throws(() => parseStateCandidateRecords({ ...kansas, electionDate: "2028-11-07" }, kansasHtml()), /configured/u);
});

test("Kansas refuses malformed cards, unknown offices, duplicate records and broken tickets", () => {
	assert.throws(() => parseStateCandidateRecords(kansas, kansasHtml().replace("Senator Example", "Senator Example (withdrawn)")), /unreviewed status/u);
	assert.throws(() => parseStateCandidateRecords(kansas, kansasHtml().replace("<ul>", "<p class=\"status\">Deceased</p><ul>")), /unreviewed status/u);
	assert.throws(() => parseStateCandidateRecords(kansas, kansasHtml().replace("<ul>", "<ul><li><label>Status:</label>Withdrawn</li>")), /unreviewed status/u);
	for (const html of [kansasHtml().replace("Kansas Representative 5", "Unknown Office 5"), kansasHtml().replace("Governor Example / Deputy Example", "Governor Example"), kansasHtml().replace("Incumbent:</label> Yes", "Incumbent:</label> Unknown"), kansasHtml().replace("<p class=\"party\">Democratic</p>", "<p class=\"party\">Unexpected Party</p>"), kansasHtml().replace("<h4 class=\"title\">Senator Example</h4>", "")]) {
		assert.throws(() => parseStateCandidateRecords(kansas, html), /Kansas/u);
	}
	const html = kansasHtml();
	const start = html.indexOf("<div class=\"view-grouping\">");
	const group = html.slice(start, html.indexOf("<div class=\"view-grouping\">", start + 1));
	assert.throws(() => parseStateCandidateRecords(kansas, kansasHtml().replace("<div class=\"view-content\">", `<div class="view-content">${group}`)), /duplicated/u);
});

test("Kansas only adds exact congressional and House districts, never local education or court numbers", () => {
	const snapshot = { source: kansas, records: parseStateCandidateRecords(kansas, kansasHtml()), retrievedAt: new Date(now).toISOString(), sha256: hash("fixture") };
	const preview = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography fixture" }] })!;
	assert.equal(preview("congressional", "3").candidateCount, 5);
	assert.equal(preview("state-house", "5").candidateCount, 5);
	for (const [type, code] of [["congressional", "10"], ["state-house", "3"], ["state-senate", "5"], ["county", "3"], ["ward", "3"]]) assert.equal(preview(type, code).candidateCount, 4);
});

test("Kansas downloads into persistent storage and restarts without another publisher request", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-kansas-automatic-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let requests = 0;
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async (source) => {
		assert.equal(source.id, kansas.id);
		requests += 1;
		return kansasHtml();
	} });
	const snapshot = await repository.getSnapshot("KS");
	assert.equal(snapshot!.records.length, 11);
	const loaded = await createStateBallotRepository({ dataDirectory: directory, now: () => now + 1, fetchText: async () => {
		throw new Error("Cached restart must not fetch.");
	} }).getSnapshot("KS");
	assert.equal(serializeStateBallotSnapshots([loaded!]), serializeStateBallotSnapshots([snapshot!]));
	assert.equal(requests, 1);
	const refreshed = await createStateBallotRepository({ dataDirectory: directory, ttlMs: 1000, now: () => now + 1001, fetchText: async () => {
		requests += 1;
		return kansasHtml().replaceAll("Senator Example", "Updated Senator");
	} }).getSnapshot("KS");
	assert.equal(refreshed!.records[0].name, "Updated Senator");
	assert.equal(requests, 2);
});

test("Nevada requires a reviewed external two-publication import without automatic fallback", async () => {
	assert.equal(nevada.snapshotStorage, "external");
	assert.equal(nevada.documentUrls?.length, 2);
	assert.deepEqual(nevada.documentLinks?.map(link => link.url), nevada.documentUrls);
	await assert.rejects(loadBundledStateSnapshot(nevada), /No bundled/u);
	assert.equal(await createStateBallotRepository({ dataDirectory: null, now: () => now, fetchText: async () => {
		throw new Error("Not permitted.");
	} }).getSnapshot("NV"), null);
	await assert.rejects(fetchStateBallotSourceText(nevada, async () => {
		throw new Error("Not permitted.");
	}), /manually supplied/u);
});

test("Nevada keeps separate governor/LG elections, ordinary judicial seats and zero-contribution provenance", () => {
	const snapshot = parseBundledStateSnapshot(nevada, JSON.stringify(nevadaPayload()));
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
	assert.equal(preview.candidateCount, 4);
	assert.equal(preview.contestCount, 4);
	assert.equal(snapshot.documents?.[1].includedRecordCount, 0);
	assert.ok(snapshot.records.every(record => record.sourceStatus === undefined && !record.name.includes("None of")));
	assert.ok(preview.contests.some(contest => contest.title === "Governor"));
	assert.ok(preview.contests.some(contest => contest.title === "Lieutenant Governor"));
});

test("Nevada rejects changed publication identities, counts and private fields", () => {
	const original = nevadaPayload();
	for (const changed of [{ ...original, documents: original.documents.slice(1) }, { ...original, sourceSha256: "a".repeat(64) }, { ...original, documents: original.documents.map(document => ({ ...document, includedRecordCount: 1 })) }, { ...original, records: original.records.map(record => ({ ...record, residentialAddress: "excluded" })) }]) assert.throws(() => parseBundledStateSnapshot(nevada, JSON.stringify(changed)));
});

test("Nevada compiled-style management import and separate export preserve transfer bytes", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-nevada-cli-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const data = nevadaPayload();
	const file = join(directory, "synthetic-nevada.json");
	await writeFile(file, JSON.stringify(data));
	const environment = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "NV" };
	const manager = fileURLToPath(new URL("../src/manage-state-ballot-data.ts", import.meta.url));
	const exporter = fileURLToPath(new URL("../src/export-state-ballot-sources.ts", import.meta.url));
	const imported = execFileSync(process.execPath, ["--import", "tsx", manager, "import", file], { env: environment, encoding: "utf8" });
	assert.equal(JSON.parse(imported).records, data.records.length);
	const snapshot = parseBundledStateSnapshot(nevada, JSON.stringify(data));
	assert.equal(execFileSync(process.execPath, ["--import", "tsx", exporter, "NV"], { env: environment, encoding: "utf8" }), serializeStateBallotSnapshots([snapshot]));
	assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", manager, "refresh", "NV"], { env: { ...environment, STATE_BALLOT_PDFTOTEXT: "", STATE_BALLOT_PDFTOCAIRO: "" }, encoding: "utf8", stdio: "pipe" }), (error: unknown) => {
		const failure = error as Error & { status: number; stdout: string };
		assert.equal(failure.status, 1);
		const fallback = JSON.parse(String(failure.stdout));
		assert.equal(fallback.action, "available");
		assert.equal(fallback.records, data.records.length);
		return true;
	});
	assert.deepEqual((await createStateBallotStorage(directory).read(nevada))!.records, snapshot.records);
});
