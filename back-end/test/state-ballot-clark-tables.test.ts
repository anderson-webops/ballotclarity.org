import type { StateBallotTablePage } from "../src/state-ballot-pdf-grid.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readClarkCandidateTables, reconcileClarkCandidateTables } from "../src/state-ballot-clark-tables.js";
import { readStateBallotPdfGrid, readStateBallotPdfTables } from "../src/state-ballot-pdf-grid.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-candidate-tables.json", import.meta.url), "utf8")) as Array<{ kind: "candidate-table" | "newsletter"; pages: StateBallotTablePage[]; sha256: string }>;
const fold = (value: string) => value.normalize("NFKC").replace(/[‘’]/gu, "'").replace(/[“”]/gu, "\"").replace(/\s+/gu, "").toLowerCase();
const reconcile = (value = fixture) => reconcileClarkCandidateTables(value[0]!.pages, value[1]!.pages, "2026-11-03");
const geometry = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-table-geometry-inputs.json", import.meta.url), "utf8")) as Array<{ kind: "candidate-table" | "newsletter"; pageNumber: number; wordCorpus: string; svg: string }>;

test("Clark County independently reconciles all 508 printed candidate rows and nineteen table panels", () => {
	const result = reconcile();
	assert.equal(result.claims.length, 254);
	assert.equal(result.supportingClaims.length, 254);
	assert.deepEqual(result.tablePages, [Array.from({ length: 10 }, (_, index) => index + 1), Array.from({ length: 9 }, (_, index) => index + 3)]);
	const previous = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-reviewed-names.json", import.meta.url), "utf8")) as { names: string[] };
	assert.deepEqual(result.claims.map(claim => fold(claim.name)).sort(), previous.names.map(fold).sort());
	assert.ok(result.claims.some(claim => claim.name === "Drew Johnson"));
	assert.ok(result.claims.some(claim => claim.name === "Tya Mathis-Coleman"));
	assert.ok(result.claims.some(claim => claim.name === "Michael MacDougall"));
	assert.ok(result.claims.every(claim => claim.officeParts.length && claim.term && claim.partyCode));
});

test("Clark County keeps none-of-these options separate from people and attached to their offices", () => {
	const result = reconcile();
	assert.equal(result.nonpersonOptions.length, 8);
	assert.ok(result.claims.every(claim => !/none of these/iu.test(claim.name)));
	assert.ok(result.nonpersonOptions.every(option => option.officeParts.length && option.text === "None of these candidates"));
	assert.ok(result.nonpersonOptions.some(option => option.officeParts.join(" ") === "Governor"));
});

test("Clark County preserves distinct political labels, local sections and unexpired terms", () => {
	const result = reconcile();
	assert.ok(result.claims.some(claim => claim.partyCode === "NP"));
	assert.ok(result.claims.some(claim => claim.partyCode === "NPP"));
	assert.ok(result.claims.some(claim => claim.term === "2-Year Unexpired Term"));
	assert.ok(result.claims.some(claim => claim.term === "4-Year Unexpired Term"));
	assert.ok(result.claims.some(claim => claim.localSection === "City of Boulder City"));
	assert.ok(result.claims.some(claim => claim.officeParts.join(" ").includes("Laughlin Township")));
	assert.ok(result.claims.some(claim => claim.officeParts.join(" ").includes("Vote for not more than 2")));
});

test("Clark County rejects a different election, missing headers, reordered pages or unknown party codes", () => {
	assert.throws(() => readClarkCandidateTables(fixture[0]!.pages, "2028-11-07", "candidate-table"), /configured election/u);
	assert.throws(() => readClarkCandidateTables(fixture[0]!.pages, "2026-11-04", "candidate-table"), /election/u);
	for (const mutate of [
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text === "PARTY")!.text = "Unknown"; },
		(pages: StateBallotTablePage[]) => { pages.reverse(); },
		(pages: StateBallotTablePage[]) => { pages.splice(2, 1); },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text === "REP")!.text = "UNKNOWN"; },
	]) {
		const changed = structuredClone(fixture);
		mutate(changed[0]!.pages);
		assert.throws(() => reconcile(changed), /Clark County/u);
	}
});

test("Clark County rejects a missing name column, missing party row or invalid term", () => {
	for (const mutate of [
		(pages: StateBallotTablePage[]) => { pages[0]!.cells = pages[0]!.cells.filter(cell => cell.text !== "Buck"); },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.splice(pages[0]!.cells.findIndex(cell => cell.text === "REP"), 1); },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text === "2")!.text = "Unknown term"; },
	]) {
		const changed = structuredClone(fixture);
		mutate(changed[0]!.pages);
		assert.throws(() => reconcile(changed), /Clark County/u);
	}
});

test("Clark County holds disagreements in a candidate name, party, office or independent count", () => {
	for (const mutate of [
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text === "Buck")!.text = "Different Name"; },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text === "REP")!.text = "NPP"; },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells.find(cell => cell.text.includes("Representative in Congress District 1"))!.text = "Representative in Congress District 2"; },
		(pages: StateBallotTablePage[]) => { pages.pop(); },
	]) {
		const changed = structuredClone(fixture);
		mutate(changed[1]!.pages);
		assert.throws(() => reconcile(changed), /disagree/u);
	}
});

test("Clark County rejects unexpected fields, out-of-page cells and oversized documents", () => {
	for (const mutate of [
		(pages: StateBallotTablePage[]) => { (pages[0] as unknown as { additional: string }).additional = "unexpected"; },
		(pages: StateBallotTablePage[]) => { pages[0]!.width = 100; },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells[0]!.bounds[0] = -1; },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells[0]!.bounds[2] = Number.NaN; },
		(pages: StateBallotTablePage[]) => { pages[0]!.cells[0]!.text = "x".repeat(3001); },
	]) {
		const changed = structuredClone(fixture);
		mutate(changed[0]!.pages);
		assert.throws(() => reconcile(changed), /Clark County/u);
	}
	assert.throws(() => readClarkCandidateTables([], "2026-11-03", "candidate-table"), /bounds/u);
	assert.throws(() => readClarkCandidateTables(Array.from({ length: 51 }, () => fixture[0]!.pages[0]), "2026-11-03", "candidate-table"), /bounds/u);
});

test("PDF tables reconcile filled Excel borders and stroked newsletter rules without losing short contest rows", () => {
	for (const input of geometry) {
		const expected = structuredClone(fixture.find(item => item.kind === input.kind)!.pages.find(page => page.number === input.pageNumber)!);
		expected.number = 1;
		assert.deepEqual(readStateBallotPdfTables(input.wordCorpus, [input.svg]), [expected]);
		assert.throws(() => readStateBallotPdfGrid(input.wordCorpus, [input.svg]));
	}
	const short = geometry.find(item => item.kind === "candidate-table" && item.pageNumber === 2)!;
	const page = readStateBallotPdfTables(short.wordCorpus, [short.svg])[0]!;
	assert.ok(page.cells.some(cell => cell.text === "Drew"));
	assert.ok(page.cells.some(cell => cell.text === "Mathis-Coleman"));
	assert.ok(page.cells.some(cell => cell.text === "MacDougall"));
});

test("PDF tables ignore unreviewed or invisible filled rules and retain geometry failure bounds", () => {
	const input = geometry[0]!;
	assert.equal(readStateBallotPdfTables(input.wordCorpus, [input.svg.replaceAll("fill=\"rgb(0%, 0%, 0%)\"", "fill=\"red\"")])[0]!.cells.length, 0);
	assert.equal(readStateBallotPdfTables(input.wordCorpus, [input.svg.replaceAll("fill-opacity=\"1\"", "fill-opacity=\"0\"")])[0]!.cells.length, 0);
	assert.throws(() => readStateBallotPdfTables(input.wordCorpus, []), /incomplete/u);
	assert.throws(() => readStateBallotPdfTables(input.wordCorpus, [input.svg.replace("<svg viewBox=\"0 0 612 792\">", "<svg viewBox=\"0 0 612 792\" transform=\"translate(1)\">")]), /transform/u);
	assert.throws(() => readStateBallotPdfTables(input.wordCorpus, [input.svg.replace("viewBox=\"0 0 612 792\"", "viewBox=\"0 0 613 792\"")]), /match/u);
});
