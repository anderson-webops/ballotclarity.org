import assert from "node:assert/strict";
import test from "node:test";
import { readDcCandidateDocuments } from "../src/state-ballot-dc.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { dcFixture, dcWord } from "./helpers/dc-fixture.js";

const source = configuredStateBallotSources.find(item => item.id === "dc-boe-2026")!;
const read = (documents = dcFixture()) => JSON.parse(JSON.stringify(readDcCandidateDocuments(source, documents, createStateCandidateRecord)));

test("D.C. publications retain office, ward and ANC boundaries without contact data", () => {
	const parsed = read();
	assert.equal(parsed.records.length, 6);
	assert.deepEqual(parsed.documentCounts, [2, 2, 2]);
	assert.equal(parsed.vacancies, 1);
	assert.equal(parsed.records.find((item: { name: string }) => item.name === "Sample Mayor").status, "listed");
	assert.equal(parsed.records.find((item: { name: string }) => item.name === "Sample Educator").jurisdiction, "Ward 3");
	const withdrawn = parsed.records.filter((item: { status: string }) => item.status === "withdrawn");
	assert.equal(withdrawn.length, 2);
	assert.equal(withdrawn[1].district, "6/8F01");
	assert.equal(withdrawn[1].party, "N/A");
	assert.equal(withdrawn[1].name, "Former Writein");
	assert.equal(withdrawn[1].sourceStatus, "Withdrew 10/22/26");
	assert.equal(parsed.records.find((item: { name: string }) => item.name === "Early Row").status, "write-in");
});

test("D.C. reads the first write-in row even when a revised layout moves it above y=82", () => {
	const documents = dcFixture();
	documents[2] = documents[2]!.replace("80.7", "81.5");
	assert.ok(read(documents).records.some((item: { name: string }) => item.name === "Early Row"));
});

test("D.C. unsupported offices, missing columns, unknown parties and detached rows require review", () => {
	for (const [document, before, after] of [[0, "Mayor of the District of Columbia", "Unknown Office"], [0, "Independent", "Unknown Party"], [1, "ANC-SMD Name", "Changed Header"], [2, "Office Sought", "Changed Header"], [2, "Independent", "Unknown Party"]] as const) {
		const documents = dcFixture();
		documents[document] = documents[document]!.replace(before, after);
		assert.throws(() => read(documents));
	}
});

test("D.C. incomplete office blocks, repeated candidates and broken page sequences fail closed", () => {
	for (const mutate of [
		(documents: string[]) => documents[0] = documents[0]!.replace(dcWord(52, 130, "Write-In, if any", 110), ""),
		(documents: string[]) => documents[1] = documents[1]!.replace(dcWord(404, 580, "1", 410), dcWord(404, 580, "2", 410)),
		(documents: string[]) => documents[1] = documents[1]!.replace("</page>", `${dcWord(34, 140, "1A01", 51)}${dcWord(66, 140, "Sample Commissioner", 210)}</page>`)
	]) {
		const documents = dcFixture();
		mutate(documents);
		assert.throws(() => read(documents));
	}
});

test("D.C. malformed geometry, truncated XML, wrong dates and invalid withdrawals fail", () => {
	for (const [before, after] of [["792", "700"], ["xMin=\"52\"", "xMin=\"\""], ["</html>", ""], ["November 3, 2026", "November 4, 2026"], ["10/22/26", "13/22/26"], ["10/22/26", "10/22/25"]]) {
		const documents = dcFixture();
		documents[2] = documents[2]!.replace(before!, after!);
		assert.throws(() => read(documents));
	}
});

test("D.C. future compatibility uses a separately dated synthetic publication, never predicted people", () => {
	const parsed = readDcCandidateDocuments({ ...source, id: "dc-general-2028-11-07", electionDate: "2028-11-07" }, dcFixture(2028), createStateCandidateRecord);
	assert.equal(parsed.records.length, 6);
	assert.equal(parsed.records.filter(item => item.status === "withdrawn").length, 2);
});
