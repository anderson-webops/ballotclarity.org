import type { ConnecticutBallotConfiguration } from "../src/state-ballot-connecticut.js";
import type { StateBallotGridPage } from "../src/state-ballot-pdf-grid.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readConnecticutTownDocuments } from "../src/state-ballot-connecticut-discovery.js";
import { connecticutInstructionPageSha256, reconcileConnecticutBallots } from "../src/state-ballot-connecticut.js";
import { readStateBallotPdfGrid } from "../src/state-ballot-pdf-grid.js";

interface Layout {
	electionDate: string;
	sha256: string;
	retrievedAt: string;
	document: { town: string; url: string; pageCount: number; pages: StateBallotGridPage[] };
}
const layouts = JSON.parse(readFileSync(new URL("./fixtures/connecticut-historical-layouts.json", import.meta.url), "utf8")) as Layout[];
const geometry = JSON.parse(readFileSync(new URL("./fixtures/connecticut-historical-geometry.json", import.meta.url), "utf8")) as Array<{ documentIndex: number; pageNumber: number; wordCorpus: string; svg: string }>;
const options = { allowSmallCandidateGrids: true, allowQuestionPages: true, instructionPageTextSha256: connecticutInstructionPageSha256 } as const;
function parse(layout: Layout, changes: Partial<ConnecticutBallotConfiguration> = {}) {
	const configuration: ConnecticutBallotConfiguration = { electionDate: layout.electionDate, documents: [{ town: layout.document.town, url: layout.document.url, pageCount: layout.document.pageCount }], retainUnassignedDistrictClaims: true, publishedOfficeSet: true, ...changes };
	return reconcileConnecticutBallots(JSON.stringify({ documents: [layout.document] }), configuration);
}

test("Connecticut binds all fifteen historical pages to their actual dated publications", () => {
	const expected = [[1, 25, 26, 0, 16], [1, 4, 4, 0, 8], [2, 17, 21, 16, 33], [11, 26, 201, 10, 279]];
	for (const [index, layout] of layouts.entries()) {
		const result = parse(layout);
		assert.deepEqual([result.pageCount, result.records.length, result.claims.length, result.questions.length, result.blankPositions], expected[index]);
		assert.equal(result.unassignedClaimIndexes.length, 0);
		assert.match(layout.sha256, /^[a-f0-9]{64}$/u);
		assert.throws(() => parse(layout, { electionDate: "2026-11-03" }), /Connecticut/u);
		assert.throws(() => parse(layout, { documents: [{ town: "Manchester", url: layout.document.url, pageCount: layout.document.pageCount }] }), /identity/u);
		assert.throws(() => parse(layout, { publishedOfficeSet: undefined }), /Connecticut/u);
	}
});

test("Connecticut retains multi-seat instructions and vacancy terms as printed facts", () => {
	const result = parse(layouts[0]!);
	assert.equal(new Set(result.records.map(record => record.value.office)).size, 8);
	assert.ok(result.records.every(record => record.value.scope === "local" && record.value.jurisdiction === "Andover"));
	assert.equal(result.records.find(record => record.value.name === "Jayne Jurovaty")?.ballotDesignation, "To Fill Vacancy for Two Years");
	assert.ok(result.records.filter(record => record.value.office === "Board of Finance").every(record => record.ballotDesignation === "Vote for Up to Three"));
	assert.ok(result.records.filter(record => record.value.office === "Board of Education").every(record => record.ballotDesignation === "Vote for Up to Two"));
	assert.ok(parse(layouts[1]!).records.every(record => record.ballotDesignation === "Vote for up to Three"));
});

test("Connecticut preserves literal presidential tickets without inventing full names or future nominees", () => {
	for (const layout of layouts.slice(2)) {
		const result = parse(layout);
		assert.deepEqual(result.records.filter(record => record.value.office === "Presidential Electors").map(record => [record.value.name, record.value.party]), [["Harris and Walz", "Democratic"], ["Trump and Vance", "Republican"], ["Stein and Ware", "Green"], ["Oliver and ter Maat", "Libertarian"], ["Kennedy, Jr. and Shanahan", "Petitioning Candidate"]]);
		assert.ok(result.records.every(record => !record.ballotDesignation));
	}
});

test("Connecticut retains continuation questions without producing candidates from instructions", () => {
	const andover = parse(layouts[2]!);
	assert.equal(andover.questions.filter(question => question.page === 2).length, 12);
	assert.ok(andover.questions.every(question => !question.text.includes("COMPLETED VOTING")));
	const hartford = parse(layouts[3]!);
	assert.equal(hartford.claims.filter(claim => claim.page === 11).length, 0);
	assert.equal(hartford.questions.filter(question => question.page === 11).length, 0);
	assert.ok(hartford.claims.every(claim => claim.town === "Hartford" && (claim.scope !== "congressional" || claim.district === "1")));
});

test("Connecticut omits ordinary one-vote metadata despite split bilingual font tokens", () => {
	const layout = structuredClone(layouts[2]!);
	for (const cell of layout.document.pages[0]!.cells.filter(cell => cell.text.includes("Vote for One"))) {
		cell.text = cell.text.replace("Vote for One", "Vote for O ne V o t e p or Uno");
	}
	assert.ok(parse(layout).records.every(record => !record.ballotDesignation));
});

test("Connecticut rejects altered, misplaced or fact-bearing instruction pages", () => {
	for (const mutate of [
		(layout: Layout) => { layout.document.pages.at(-1)!.headerText += "\nAnother candidate"; },
		(layout: Layout) => { layout.document.pages.at(-1)!.cells = [layout.document.pages[0]!.cells[0]!]; },
		(layout: Layout) => { layout.document.pages[0]!.pageKind = "instructions-only"; },
		(layout: Layout) => { layout.document.pages[0]!.pageKind = "questions-only"; },
	]) {
		const layout = structuredClone(layouts[3]!);
		mutate(layout);
		assert.throws(() => parse(layout), /Connecticut/u);
	}
});

test("Connecticut holds unknown offices, unknown parties and displaced or repeated markers", () => {
	for (const mutate of [
		(page: StateBallotGridPage) => {
			const cell = page.cells.find(cell => cell.text.includes("Town Clerk"))!;
			cell.text = cell.logicalText = "1 Unknown Office Vote for One";
		},
		(page: StateBallotGridPage) => {
			const cell = page.cells.find(cell => cell.logicalText === "Democratic Party")!;
			cell.text = cell.logicalText = "Unknown Party";
		},
		(page: StateBallotGridPage) => { page.cells.find(cell => cell.tags.length)!.tags[0]!.top = 0; },
		(page: StateBallotGridPage) => {
			const cell = page.cells.find(cell => cell.tags.length)!;
			cell.tags.push({ ...cell.tags[0]! });
		},
	]) {
		const layout = structuredClone(layouts[0]!);
		mutate(layout.document.pages[0]!);
		assert.throws(() => parse(layout), /Connecticut/u);
	}
});

test("Connecticut distinguishes repeated municipal offices only with different printed designations", () => {
	const layout = structuredClone(layouts[0]!);
	const cell = layout.document.pages[0]!.cells.find(cell => cell.text.includes("Board of Finance"))!;
	cell.text = cell.text.replace("Board of Finance", "Board of Education");
	cell.logicalText = cell.logicalText.replace("Board of Finance", "Board of Education");
	const offices = new Set(parse(layout).records.map(record => record.value.office));
	assert.ok(offices.has("Board of Education (Vote for Up to Three)"));
	assert.ok(offices.has("Board of Education (Vote for Up to Two)"));
	cell.text = cell.text.replace("Three", "Two");
	cell.logicalText = cell.logicalText.replace("Three", "Two");
	assert.throws(() => parse(layout), /distinct printed/u);
});

test("Connecticut reads the published H2/H3 town-index template without relaxing source or date identity", () => {
	const footer = readFileSync(new URL("./fixtures/connecticut-policy-footer.html", import.meta.url), "utf8");
	for (const layout of layouts) {
		const electionDate = layout.electionDate === "2025-11-04" ? "2027-11-02" : "2028-11-07";
		const documentUrl = layout.document.url.replace(`/${layout.electionDate.slice(0, 4)}/`, `/${electionDate.slice(0, 4)}/`);
		const date = `November ${Number(electionDate.slice(-2))}, ${electionDate.slice(0, 4)}`;
		const body = `<main id="mainContent"><h1>${electionDate.slice(0, 4)} General Election Town Ballots</h1><h2>General Election Sample Ballots</h2><h3>${date}</h3><a href="${documentUrl}">${layout.document.town}</a></main>${footer}`;
		const election = { electionId: null, electionDate, pageUrl: `https://portal.ct.gov/sots/election-services/town-ballots/${electionDate.slice(0, 4)}-general-election-sample-ballots` } as const;
		assert.deepEqual(readConnecticutTownDocuments(body, election), [{ town: layout.document.town, url: documentUrl }]);
		for (const changed of [body.replace(date, "November 3, 2026"), body.replace("General Election Sample Ballots", "Unreviewed Publication"), body.replace("/-/media/sots/", "https://example.org/-/media/sots/")]) assert.throws(() => readConnecticutTownDocuments(changed, election));
	}
});

test("PDF grid extraction reproduces the reviewed small, presidential, continuation and instruction layouts", () => {
	for (const item of geometry) {
		const expected = structuredClone(layouts[item.documentIndex]!.document.pages[item.pageNumber - 1]!);
		expected.number = 1;
		assert.deepEqual(readStateBallotPdfGrid(item.wordCorpus, [item.svg], options), [expected]);
		if (expected.cells.length < 30 || expected.pageKind) assert.throws(() => readStateBallotPdfGrid(item.wordCorpus, [item.svg]));
	}
});

test("PDF grid extraction rejects changed instruction bodies, hidden positions and unfamiliar continuation footers", () => {
	const instructions = geometry.find(item => item.pageNumber === 11)!;
	assert.throws(() => readStateBallotPdfGrid(instructions.wordCorpus.replace(">HOW<", ">WHO<"), [instructions.svg], options));
	const question = geometry.find(item => item.pageNumber === 2)!;
	assert.throws(() => readStateBallotPdfGrid(question.wordCorpus.replace(">YOU<", ">SOMEONE<"), [question.svg], options), /footer/u);
	assert.throws(() => readStateBallotPdfGrid(question.wordCorpus.replace(">YOU<", ">1A<"), [question.svg], options), /requires review/u);
	assert.throws(() => readStateBallotPdfGrid(question.wordCorpus, [question.svg], { ...options, instructionPageTextSha256: "invalid" }), /policy/u);
});
