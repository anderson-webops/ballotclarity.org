import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { fetchVirginiaCandidateCapture, readVirginiaElectionDiscovery, virginiaDiscoveryUrl, virginiaReportUrl } from "../src/state-ballot-virginia.js";

const local = configuredStateBallotSources.find(source => source.id === "va-elect-2026-local")!;
const federal = configuredStateBallotSources.find(source => source.id === "va-elect-2026-federal")!;
const now = Date.parse("2026-10-25T12:00:00Z");
const localHeaders = ["Locality", "Office Ballot Order", "Party Ballot Order", "Office Title", "District", "Number of Seats", "Office Term", "Special Office Unexpired Term End Date", "Candidate Party", "Candidate Name", "Incumbent", "Campaign Email", "Campaign Website", "Campaign Phone", "Campaign Address Line 1", "Campaign Address Line 2", "Campaign City", "Campaign State", "Campaign Zip"];
const federalHeaders = ["Office Title", "District", "Candidate Party", "Candidate Name", "Incumbent", "Campaign Email", "Campaign Website", "Campaign Phone", "Campaign Address Line 1", "Campaign Address Line 2", "Campaign City", "Campaign State", "Campaign Zip"];
const localRow = ["SYNTHETIC COUNTY", "12", "1", "Member City Council", "District 3", "2", "4 year", "12/31/2028", "Independent", "Synthetic Candidate", "Yes", "private@example.invalid", "https://example.org/candidate", "private-phone", "private-address", "private-line2", "private-city", "private-state", "private-zip"];
function table(date: string, kind: string, headers: string[], rows: string[][]) {
	return `<main><h1>November ${Number(date.slice(-2))}, ${date.slice(0, 4)} - ${kind} Offices</h1><table><tr>${headers.map(value => `<th>${value}</th>`).join("")}</tr>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</table></main>`;
}
function index(date = "2026-11-03", links = [{ label: "All Offices", url: local.documentUrls![1]! }, { label: "Local Offices", url: local.url }, { label: "Federal Offices", url: federal.url }]) {
	return `<main><h1>Candidates &amp; Referendums</h1><h2>November ${Number(date.slice(-2))}, ${date.slice(0, 4)} General and Special Elections</h2><ul>${links.map(link => `<li><a href="${link.url}">${date.slice(0, 4)} November ${link.label} Candidate List</a></li>`).join("")}</ul></main>`;
}
const currentIndex = index();
function future(kind: "local" | "federal", date = "2028-11-07") {
	const body = index(date, [{ label: kind === "local" ? "Local Offices" : "Federal Offices", url: `${virginiaDiscoveryUrl}published-roster-${kind}-${date}/` }]);
	const catalog = discoverStateBallotElectionCycles(body, kind === "local" ? local.id : federal.id, now);
	return { body, catalog, source: stateBallotCycleSources(catalog, now)[0]! };
}
async function localCapture(source = local, discovery = currentIndex, rows = [localRow], allRows = rows) {
	return fetchVirginiaCandidateCapture(source, async url => table(source.electionDate, url.includes("all-offices") ? "All" : "Local", localHeaders, url.includes("all-offices") ? allRows : rows), discovery);
}

test("Virginia discovers actual dated HTML links, supports odd/even general elections and rejects unsafe or ambiguous controls", () => {
	assert.equal(discoverStateBallotElectionCycles(currentIndex, federal.id, now).elections[0]!.reports![0]!.url, federal.url);
	assert.equal(discoverStateBallotElectionCycles(currentIndex, local.id, now).elections[0]!.allOfficesUrl, local.documentUrls![1]);
	for (const date of ["2027-11-02", "2028-11-07"]) assert.equal(future("local", date).source.electionDate, date);
	for (const url of ["https://example.org/report/", `${virginiaDiscoveryUrl}data.csv`, `${local.url}?filtered=1`, `${local.url}#part`, `http://www.elections.virginia.gov${new URL(local.url).pathname}`]) assert.throws(() => virginiaReportUrl(url));
	assert.throws(() => discoverStateBallotElectionCycles(currentIndex.replace("2026 November Local", "2028 November Local"), local.id, now));
	assert.throws(() => discoverStateBallotElectionCycles(currentIndex.replace("November 3", "November 4"), local.id, now));
	assert.throws(() => discoverStateBallotElectionCycles(currentIndex.replace("<ul>", "<p>changed</p><ul>"), local.id, now));
	assert.deepEqual(readVirginiaElectionDiscovery(currentIndex.replace("General and Special", "Primary"), "local"), []);
	const catalog = future("local").catalog;
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [...catalog.elections, ...catalog.elections] }, now));
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ ...catalog.elections[0], extra: true }] }, now));
});

test("Virginia local records retain source geography, explicit terms, vacancies and safe campaign sites without private contact columns", async () => {
	const body = await localCapture();
	const records = parseStateCandidateRecords(local, body);
	assert.equal(records.length, 1);
	assert.equal(records[0]!.scope, "local");
	assert.equal(records[0]!.district, "");
	assert.equal(records[0]!.sourceAreaLabel, "SYNTHETIC COUNTY");
	assert.equal(records[0]!.sourceDistrictLabel, "District 3");
	assert.equal(records[0]!.termYears, 4);
	assert.equal(records[0]!.termEnd, "2028-12-31");
	assert.equal(records[0]!.seats, 2);
	assert.equal(records[0]!.ballotDesignation, "Incumbent");
	assert.equal(records[0]!.candidateUrl, "https://example.org/candidate");
	assert.doesNotMatch(JSON.stringify(records), /private-|private@/u);
	const shorter = localRow.slice(0, 18);
	assert.equal(parseStateCandidateRecords(local, await localCapture(local, currentIndex, [shorter]))[0]!.candidateUrl, undefined);
	const legislative = [...localRow];
	legislative[3] = "Member, House of Delegates";
	legislative[4] = "20th District";
	assert.equal(parseStateCandidateRecords(local, await localCapture(local, currentIndex, [legislative]))[0]!.scope, "state-house");
	assert.equal(parseStateCandidateRecords(local, await localCapture(local, currentIndex, [legislative]))[0]!.jurisdiction, "SYNTHETIC COUNTY · 20th District");
	assert.deepEqual(local.withheldDistrictScopes, ["state-house"]);
	const snapshot = { source: local, retrievedAt: new Date(now).toISOString(), sha256: "a".repeat(64), records };
	assert.deepEqual(parseBundledStateSnapshot(local, serializeStoredStateSnapshot(snapshot), "automatic").records, JSON.parse(JSON.stringify(records)));
});

test("Virginia rejects partial, conflicting, misdated, merged or malformed reports and never guesses missing contact positions", async () => {
	for (const position of [0, 1, 2, 5, 6, 7, 9, 10]) {
		const row = [...localRow];
		row[position] = position === 7 ? "02/30/2028" : "";
		assert.throws(() => parseStateCandidateRecords(local, JSON.stringify({ schemaVersion: 1, type: "virginia-candidate-export", index: currentIndex, reports: [{ kind: "local", url: local.url, body: table(local.electionDate, "Local", localHeaders, [row]) }], allOffices: { url: local.documentUrls![1], body: table(local.electionDate, "All", localHeaders, [row]) } })));
	}
	await assert.rejects(async () => parseStateCandidateRecords(local, await localCapture(local, currentIndex, [localRow], [])));
	await assert.rejects(async () => parseStateCandidateRecords(local, await localCapture(local, currentIndex, [localRow.slice(0, 17)])));
	const body = await localCapture();
	assert.throws(() => parseStateCandidateRecords(local, body.replaceAll("November 3, 2026 - Local", "November 7, 2028 - Local")));
	assert.throws(() => parseStateCandidateRecords(local, body.replaceAll("<td>", "<td colspan=2>")));
	const variant = [...localRow];
	variant[9] = "SYNTHETIC CANDIDATE";
	assert.equal(parseStateCandidateRecords(local, await localCapture(local, currentIndex, [localRow, variant])).length, 1);
	variant[12] = "https://example.org/conflict";
	await assert.rejects(async () => parseStateCandidateRecords(local, await localCapture(local, currentIndex, [localRow, variant])));
	const otherArea = [...localRow];
	otherArea[0] = "OTHER COUNTY";
	assert.equal(parseStateCandidateRecords(local, await localCapture(local, currentIndex, [localRow, otherArea])).length, 2);
});

test("Virginia federal discovery validates the source before requesting and preserves current federal identities with explicit source facts", async () => {
	const requests: string[] = [];
	const request = async (url: string, options: { maxRedirects: number }) => {
		requests.push(url);
		assert.equal(options.maxRedirects, 0);
		return url === virginiaDiscoveryUrl ? currentIndex : table(federal.electionDate, "Federal", federalHeaders, [["Member, House of Representatives", "1st District", "Republican", "Synthetic Candidate", "Yes", "private@example.invalid", "example.org/candidate", "private-phone", "private-address", "", "private-city", "VA", "private-zip"]]);
	};
	const body = await fetchStateBallotSourceText(federal, request);
	assert.deepEqual(requests, [virginiaDiscoveryUrl, federal.url]);
	const record = parseStateCandidateRecords(federal, body)[0]!;
	assert.equal(record.scope, "congressional");
	assert.equal(record.district, "1");
	assert.equal(record.ballotDesignation, "Incumbent");
	assert.equal(record.candidateUrl, "https://example.org/candidate");
	await assert.rejects(fetchVirginiaCandidateCapture({ ...federal, url: "https://example.org/" }, request));
	assert.equal(requests.length, 2);
});

test("Virginia future split federal reports bind each published category and retain separate presidential records without inferred tickets", async () => {
	const date = "2028-11-07";
	const links = ["President", "US Senate", "House of Representatives"].map((label, position) => ({ label, url: `${virginiaDiscoveryUrl}actual-publisher-link-${position}/` }));
	const discovery = index(date, links);
	const source = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery, federal.id, now), now)[0]!;
	assert.deepEqual(source.withheldStatewideOffices, ["President", "Vice President"]);
	const body = await fetchVirginiaCandidateCapture(source, async (url) => {
		const position = links.findIndex(link => link.url === url);
		const headings = ["November 7, 2028 General Election Presidential", "Nov 2028 US Senate", "Nov 2028 US House"];
		const headers = position === 0 ? ["Office Title", "Political Party", "Name", "Incumbent", "Email", "Phone", "Website", "Address1", "City", "State", "Zip"] : position === 1 ? ["Office Title", "Political Party", "Name", "Incumbent", "Email", "Phone", "Website", "Address", "City", "State", "Zip"] : ["Office Title", "District", "Party Draw Order", "Political Party", "Name", "Incumbent", "Email", "Phone", "Website", "Address", "City", "State", "Zip"];
		const values: Record<string, string> = { "Office Title": position === 0 ? "President" : position === 1 ? "Member, United States Senate" : "Member, House of Representatives", "District": "1st District", "Political Party": "Synthetic Party", "Name": `Synthetic Candidate ${position}`, "Incumbent": "false" };
		const row = headers.map(header => values[header] ?? "");
		return table(date, "Federal", headers, [row]).replace("November 7, 2028 - Federal Offices", headings[position]!);
	}, discovery);
	assert.equal(parseStateCandidateRecords(source, body).length, 3);
	assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ ...JSON.parse(body), reports: JSON.parse(body).reports.slice(1) })));
});

test("Virginia future empty exports wait durably, recover automatically and keep catalog/report changes out of accepted storage", async () => {
	const stage = await mkdtemp(join(tmpdir(), "ballot-va-cycles-"));
	try {
		const { body, source } = future("local");
		const catalogPath = join(stage, "cycles.json");
		let clock = now;
		let available = false;
		let requests = 0;
		const fetchCandidates = async (entry: StateBallotSource) => {
			requests++;
			return localCapture(entry, body, available ? [localRow] : []);
		};
		const options = { familyId: local.id, catalogPath, dataDirectory: stage, now: () => clock, fetchDiscovery: async () => body, fetchCandidates };
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ schemaVersion: 1, type: "virginia-candidate-export", index: body, reports: [{ kind: "local", url: source.documentUrls![0], body: table(source.electionDate, "Local", localHeaders, []) }], allOffices: null })), StateBallotAwaitingRecordsError);
		assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
		assert.equal(await createStateBallotStorage(stage).read(source), null);
		const pendingRequests = requests;
		assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
		assert.equal(requests, pendingRequests);
		clock += 25 * 3600000;
		available = true;
		assert.equal((await syncStateBallotCycles(options)).results[0]!.records, 1);
		const accepted = await readFile(join(stage, `${source.id}.json`), "utf8");
		const previous = await readFile(catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => body.replaceAll("published-roster-local", "changed-roster-local") }));
		assert.equal(await readFile(catalogPath, "utf8"), previous);
		assert.equal(await readFile(join(stage, `${source.id}.json`), "utf8"), accepted);
		const cold = createStateBallotRepository({ sources: [source], dataDirectory: stage, now: () => clock, fetchText: async () => {
			throw new Error("No network expected");
		} });
		assert.equal((await cold.getSnapshot("VA", source.id))?.records.length, 1);
	}
	finally { await rm(stage, { recursive: true }); }
});

test("Virginia external catalogs become available to hot and cold repositories without widening exact-source selections", async () => {
	const stage = await mkdtemp(join(tmpdir(), "ballot-va-hot-cold-"));
	const keys = ["STATE_BALLOT_ENABLED_STATES", "STATE_BALLOT_ENABLED_SOURCES", "STATE_BALLOT_ENABLED_FAMILIES", "STATE_BALLOT_CYCLE_CATALOGS"];
	const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
	try {
		const { body, source, catalog } = future("local", "2027-11-02");
		const path = join(stage, "cycles.json");
		process.env.STATE_BALLOT_ENABLED_STATES = "VA";
		process.env.STATE_BALLOT_ENABLED_SOURCES = local.id;
		process.env.STATE_BALLOT_ENABLED_FAMILIES = local.id;
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify({ [local.id]: path });
		let requests = 0;
		const hot = createStateBallotRepository({ dataDirectory: stage, now: () => now, fetchText: async (entry) => {
			requests++;
			return localCapture(entry, body);
		} });
		assert.equal(await hot.getSnapshot("VA", source.id), null);
		await writeStateBallotCycleCatalog(path, catalog, now);
		assert.equal((await hot.getSnapshot("VA", source.id))?.records.length, 1);
		assert.equal(requests, 1);
		const cold = createStateBallotRepository({ dataDirectory: stage, now: () => now, fetchText: async () => {
			throw new Error("Accepted data must remain cached");
		} });
		assert.equal((await cold.getSnapshot("VA", source.id))?.records.length, 1);
		delete process.env.STATE_BALLOT_ENABLED_FAMILIES;
		assert.equal(await hot.getSnapshot("VA", source.id), null);
		assert.equal(requests, 1);
	}
	finally {
		for (const key of keys) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
		await rm(stage, { recursive: true });
	}
});
