import type { StateBallotTablePage } from "../src/state-ballot-pdf-grid.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeClarkCandidateClaims } from "../src/state-ballot-clark-collection.js";
import { readClarkCandidateTables, reconcileClarkCandidateTables } from "../src/state-ballot-clark-tables.js";
import { readStateBallotPdfGrid, readStateBallotPdfTables } from "../src/state-ballot-pdf-grid.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-historical-tables.json", import.meta.url), "utf8")) as { electionDate: string; documents: Array<{ pages: StateBallotTablePage[] }> };
const primary = fixture.documents[0]!.pages;
const read = (pages = primary) => readClarkCandidateTables(pages, fixture.electionDate, "candidate-table");
const source = { ...configuredStateBallotSources.find(source => source.id === "nv-clark-2026")!, id: "nv-clark-historical-2024", electionDate: fixture.electionDate };

test("Clark County reads all fourteen historical landscape pages, 195 entries and five nonperson options", () => {
	const result = read();
	assert.equal(result.claims.length, 195);
	assert.equal(result.nonpersonOptions.length, 5);
	assert.deepEqual(result.tablePages, Array.from({ length: 14 }, (_, index) => index + 1));
	assert.ok(result.nonpersonOptions.some(option => option.officeParts.join(" ") === "United States Senate"));
	assert.ok(result.claims.every(claim => !/none of these/iu.test(claim.name)));
	assert.equal(primary.flatMap(page => page.cells).filter(cell => /^None of these candidates$/iu.test(cell.text)).length, result.nonpersonOptions.length);
});

test("Clark County pairs presidential names by ticket and preserves the printed party", () => {
	const claims = read().claims.filter(claim => claim.officeParts.join(" ") === "President / Vice President of the United States");
	assert.deepEqual(claims.map(({ name, partyCode }) => ({ name, partyCode })), [
		{ name: "Kamala D. Harris / Tim Walz", partyCode: "DEM" },
		{ name: "Chase Oliver / Michael ter Maat", partyCode: "LPN" },
		{ name: "Joel Skousen / Rik Combs", partyCode: "IAP" },
		{ name: "Donald J. Trump / JD Vance", partyCode: "REP" },
	]);
	assert.deepEqual(claims.map(claim => claim.term), ["4", "4", "4", "4"]);
});

test("Clark County rejects incomplete, extra and unpaired presidential names", () => {
	for (const replacement of ["Kamala D.", "Kamala D. /", "Kamala D. / Tim / Another"]) {
		const changed = structuredClone(primary);
		changed[0]!.cells.find(cell => cell.text === "Kamala D. /\nTim")!.text = replacement;
		assert.throws(() => read(changed), /ticket/u);
	}
	const changed = structuredClone(primary);
	changed[0]!.cells.find(cell => cell.text === "Sam")!.text = "Sam / Another";
	assert.throws(() => read(changed), /ticket/u);
});

test("Clark County holds incomplete printed page sets and a mismatched historical year", () => {
	for (const mutate of [
		(pages: StateBallotTablePage[]) => { pages.pop(); },
		(pages: StateBallotTablePage[]) => { pages[6]!.text = pages[6]!.text.replace("7 of 14", "7 of 15"); },
		(pages: StateBallotTablePage[]) => { pages[6]!.text = pages[6]!.text.replaceAll("2024", "2028"); },
		(pages: StateBallotTablePage[]) => { pages[6]!.width = 792.02; },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text === "OFFICE")!.text = "Unknown"; },
	]) {
		const changed = structuredClone(primary);
		mutate(changed);
		assert.throws(() => read(changed), /Clark County/u);
	}
	assert.throws(() => readClarkCandidateTables(primary, "2028-11-07", "candidate-table"), /configured election/u);
});

test("Clark County normalizes historical offices without inferring missing departments or eligibility", () => {
	const records = normalizeClarkCandidateClaims(read().claims, source, createStateCandidateRecord);
	assert.equal(records.length, 195);
	assert.equal(new Set(records.map(record => record.id)).size, 195);
	assert.equal(records.filter(record => record.voteLimit === 5).length, 14);
	assert.deepEqual(Object.fromEntries(["statewide", "congressional", "state-senate", "state-house", "local"].map(scope => [scope, records.filter(record => record.scope === scope).length])), { "statewide": 11, "congressional": 12, "state-senate": 18, "state-house": 60, "local": 94 });
	assert.ok(records.filter(record => record.scope === "local").every(record => record.sourceAreaLabel === "Clark County"));
	assert.ok(records.some(record => record.name === "Tina Talim" && record.office === "District Court Judge, Department 14" && record.ballotDesignation === "2-year unexpired term"));
	assert.ok(records.some(record => record.name === "Terry Coffing" && record.office === "District Court Judge, Department 27"));
	assert.ok(records.some(record => record.office === "Justice of the Peace" && record.jurisdiction === "Searchlight Township"));
	assert.ok(records.some(record => record.office === "Board of Regents, District 1"));
	assert.ok(records.some(record => record.office === "Member, State Board of Education, District 1"));
	assert.ok(records.some(record => record.jurisdiction === "Overton Power District 5" && record.office === "Trustee, Seat 7 At Large Within District"));
});

test("Clark County holds unknown historical offices, conflicting sections and education district notes", () => {
	const claims = read().claims;
	for (const claim of [
		{ ...claims[0]!, section: "COUNTY NONPARTISAN" },
		{ ...claims[0]!, officeParts: ["Unreviewed statewide office"] },
		{ ...claims.find(claim => claim.officeParts.join(" ").includes("Member State Board of Education District 1"))!, officeParts: ["Member State Board of Education District 1 (NOTE: Boundaries are the same as Congressional District 2)"] },
	]) assert.throws(() => normalizeClarkCandidateClaims([claim], source, createStateCandidateRecord), /requires review/u);
});

test("Clark County's informational 2024 newsletter is not an independent candidate publication", () => {
	const newsletter = fixture.documents[1]!.pages;
	assert.equal(newsletter.length, 6);
	assert.throws(() => readClarkCandidateTables(newsletter, fixture.electionDate, "newsletter"), /empty/u);
	assert.throws(() => reconcileClarkCandidateTables(primary, newsletter, fixture.electionDate), /empty/u);
});

test("PDF tables retain the actual three-point landscape rule separating two judicial offices", () => {
	const geometry = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-historical-geometry.json", import.meta.url), "utf8")) as { pageNumber: number; wordCorpus: string; svg: string };
	const expected = structuredClone(primary[geometry.pageNumber - 1]!);
	expected.number = 1;
	const restored = readStateBallotPdfTables(geometry.wordCorpus, [geometry.svg]);
	assert.deepEqual(restored, [expected]);
	assert.ok(restored[0]!.cells.some(cell => cell.text === "Talim"));
	assert.ok(restored[0]!.cells.some(cell => cell.text === "Coffing"));
	assert.ok(restored[0]!.cells.every(cell => cell.text !== "Talim\nCoffing"));
	assert.throws(() => readStateBallotPdfGrid(geometry.wordCorpus, [geometry.svg]));
});
