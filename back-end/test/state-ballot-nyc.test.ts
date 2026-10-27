import assert from "node:assert/strict";
import test from "node:test";
import { readNycCandidateIndex } from "../src/state-ballot-nyc-discovery.js";
import { nycNativePages } from "../src/state-ballot-nyc-native.js";
import { nycGeneralDate, readNycCandidateDocument } from "../src/state-ballot-nyc.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { nycDocumentFixture, nycDraftSource, nycIndexFixture } from "./helpers/nyc-fixture.js";

const parse = (body = nycDocumentFixture(), source = nycDraftSource) => readNycCandidateDocument(source, body, createStateCandidateRecord);

test("NYC combines explicit fusion ballot lines and repeated borough appearances without inventing tickets", () => {
	const result = parse();
	assert.equal(result.records.length, 11);
	assert.equal(result.claims.length, 20);
	const ticket = result.records.find(record => record.scope === "statewide")!;
	assert.equal(ticket.name, "Example Governor / Example Lieutenant");
	assert.equal(ticket.party, "Democratic / Working Families");
	assert.equal(result.claims.filter(claim => claim.recordId === ticket.id).length, 10);
	assert(result.records.every(record => record.status === "listed" && record.sourceStatus === "Tentative"));
	assert.equal(result.asOfDate, "2026-09-11");
	assert.equal(result.printedAt, "9/11/2026 10:26:11AM");
	assert.equal(result.pages, 11);
	assert(!JSON.stringify(result).includes("Private fixture mailing field"));
});

test("NYC retains printed seats, judicial regions and legislative districts without inferring vote limits", () => {
	const result = parse();
	const judges = result.records.filter(record => record.office.startsWith("Judge"));
	assert.equal(judges.length, 5);
	assert(judges.every(record => record.seats === 3 && record.scope === "local" && record.voteLimit === undefined));
	assert.equal(result.records.find(record => record.office.startsWith("State Senator - 2th"))!.district, "2");
	assert.equal(result.records.find(record => record.office.startsWith("State Senator"))!.party, "New Civic Party");
	assert(result.records.every(record => record.termYears === undefined && record.candidateUrl === undefined));
});

test("NYC consolidates matching citywide proposals but retains all five source-page occurrences", () => {
	const result = parse();
	assert.equal(result.questions.length, 1);
	assert.equal(result.questionOccurrences.length, 5);
	assert.equal(result.questions[0]!.audience, "New York City");
	assert.equal(result.questions[0]!.pages.length, 5);
	assert.deepEqual(result.questions[0]!.choices, ["Yes", "No"]);
	assert.equal(result.questions[0]!.voterApplicabilityVerified, false);
	assert.throws(() => parse(nycDocumentFixture().replace("The official proposal changes", "A different proposal changes")), /conflicting/u);
	assert.throws(() => parse(nycDocumentFixture().replace(">No</text>", ">Yes</text>")), /choice/u);
});

test("NYC accepts explicitly dated future publications without changing annual URLs in code", () => {
	const source = { ...nycDraftSource, id: "ny-nyc-general-2028-11-07", electionDate: "2028-11-07" };
	assert.equal(parse(nycDocumentFixture("2028", "07"), source).records.length, 11);
	assert.equal(readNycCandidateIndex(nycIndexFixture("2028", "7"))[0]!.electionDate, source.electionDate);
	assert.throws(() => parse(nycDocumentFixture(), source), /identity/u);
	assert.throws(() => nycGeneralDate("2026-11-04"), /date/u);
});

test("NYC rejects changed status, conflicting dates, repeated lines and truncated borough inventories", () => {
	for (const body of [nycDocumentFixture().replace("TENTATIVE", "CERTIFIED"), nycDocumentFixture().replace("PRINTED AS OF:", "Updated:"), nycDocumentFixture().replace("Page 3 of 3", "Page 3 of 4"), nycDocumentFixture().replace("Bronx All Parties", "Kings All Parties"), nycDocumentFixture().replace("Working Families", "Democratic"), nycDocumentFixture().replace("Example Governor / Example Lieutenant", "Example Governor"), nycDocumentFixture().replace("9/11/2026", "11/31/2026")]) assert.throws(() => parse(body), /review/u);
});

test("NYC accounts for every native field and rejects unsupported styling or column geometry", () => {
	for (const body of [nycDocumentFixture().replace("</page>", "<image src=\"unknown.png\"/></page>"), nycDocumentFixture().replace("left=\"26\"", "left=\"27\""), nycDocumentFixture().replace("height=\"918\"", "height=\"1188\""), nycDocumentFixture().replace("#000000", "#FFFFFF"), nycDocumentFixture().replace("</page>", "<text top=\"900\" left=\"0\" width=\"100\" height=\"16\" font=\"7\">Unassigned content</text></page>")]) assert.throws(() => nycNativePages(body) && parse(body), /review/u);
});

test("NYC discovers both actually linked formats while distinguishing unavailable future elections", () => {
	const result = readNycCandidateIndex(nycIndexFixture());
	assert.equal(result.length, 1);
	assert.equal(result[0]!.pdfUrl, "https://www.vote.nyc/sites/default/files/pdf/candidates/2026/actually-published-2026.pdf");
	assert(result[0]!.rtfUrl.endsWith("/actual-other-name.rtf"));
	assert.deepEqual(readNycCandidateIndex("<div id=\"block-basic-content\"><div class=\"group-right\"><h2>No current publication</h2></div></div>"), []);
});

test("NYC discovery holds contradictory labels, missing formats and unsafe or orphaned document links", () => {
	for (const body of [nycIndexFixture().replace(" - (DOC)", " - (PDF)"), nycIndexFixture().replace("actual-other-name.rtf", "different.doc"), nycIndexFixture().replace("href=\"/sites", "href=\"https://unreviewed.example/sites"), nycIndexFixture().replace("actually-published-2026.pdf", "actually-published-2026.pdf?token=x"), nycIndexFixture().replace("General Election Contest List", "Other General Election Contest List"), nycIndexFixture().replace("</div></div>", "<a href=\"/orphan.pdf\">General Contest List</a></div></div>")]) assert.throws(() => readNycCandidateIndex(body), /review/u);
});
