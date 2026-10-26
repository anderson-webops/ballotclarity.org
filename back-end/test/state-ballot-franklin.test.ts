import assert from "node:assert/strict";
import test from "node:test";
import { readFranklinCandidateDocuments } from "../src/state-ballot-franklin.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";

const source = stateBallotSources.find(source => source.id === "oh-franklin-2026")!;
const escape = (value: string) => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
function words(value: string, left: number, top: number) {
	let position = left;
	return value.split(" ").filter(Boolean).map((token) => {
		const width = token.length * 2.6;
		const result = `<word xMin="${position}" xMax="${position + width}" yMin="${top}" yMax="${top + 9}">${escape(token)}</word>`;
		position += width + 2;
		return result;
	}).join("");
}
const rows = [
	{ name: "Alex One and Blair Two", office: "GOVERNOR AND LIEUTENANT GOVERNOR", party: "Democratic", term: "Full Term", date: "", writeIn: "", website: "www.alexexample.org", noticeParty: "Democratic", noticeWriteIn: false },
	{ name: "Casey Three", office: "U.S. SENATOR", party: "Other-party c", term: "Unexpired Term Ending", date: "1-3-2029", writeIn: "", website: "", noticeParty: "Other-party", noticeWriteIn: false },
	{ name: "Drew Four", office: "REPRESENTATIVE TO CONGRESS 15TH CONGRESSIONAL DISTRICT", party: "N/A", term: "Full Term", date: "", writeIn: "", website: "", noticeParty: "", noticeWriteIn: true },
	{ name: "Emery Five", office: "STATE REPRESENTATIVE OHIO HOUSE DISTRICT 05", party: "N/A", term: "Full Term", date: "", writeIn: "Yes", website: "", noticeParty: "N/A", noticeWriteIn: true },
	{ name: "Finley Six", office: "JUDGE OF COURT OF APPEALS 10TH DISTRICT", party: "", term: "Full Term Commencing", date: "02/09/2027", writeIn: "", website: "", noticeParty: "", noticeWriteIn: false }
];
function fixture(options: { year?: number; continuation?: boolean; alias?: boolean; questionMarker?: boolean } = {}) {
	const year = options.year ?? 2026;
	const heading = () => words(`${year} General Election Candidates`, 51, 24) + words(`Revised October 16, ${year}`, 1073, 24);
	const header = () => words("Name on Ballot", 52, 56) + words("Party", 170, 56) + words("Office", 223, 56) + words("Full Or Unexpired Term", 530, 56) + words("Term Commencing", 635, 56) + words("DWrite-In", 711, 56);
	const candidateRows = rows.map((row, index) => {
		const top = 81 + index * 28;
		const wrapped = index ? words(row.name, 52, top) : words("Alex One and", 52, top - 12) + words("Blair Two", 52, top);
		return wrapped + words(row.party, 170, top) + words(row.office, 223, top) + words(row.term, 530, top) + words(row.date, 635, top) + words(row.writeIn, 715, top) + words("private@example.org", 760, top) + words("555-555-0100", 950, top) + words(row.website, 1025, top);
	});
	const candidates = `<html><body><page width="792" height="1224">${heading()}${header()}${candidateRows.slice(0, options.continuation ? 3 : 5).join("")}</page>${options.continuation ? `<page width="792" height="1224">${heading()}${candidateRows.slice(3).join("")}</page>` : ""}</body></html>`;
	const notices = rows.map((row, index) => {
		const top = 400 + index * 30;
		return words(options.alias && index === 3 ? "Emory Five" : row.name, 42, top) + words(row.noticeParty, 309, top) + (row.noticeWriteIn ? words("(write-in)", 42, top + 13) : "");
	});
	const notice = `<html><body><page width="612" height="792">${words("Election Notice for use with the Federal Write-In Absentee Ballot", 36, 50)}${words("Issued by the Franklin County Board of Elections", 36, 100)}${words(`November ${year === 2028 ? 7 : 3}, ${year} GENERAL ELECTION`, 36, 200)}${words("Name of Candidate", 42, 359)}${words("Office", 180, 359)}${words("Party", 309, 359)}${notices.join("")}${options.questionMarker ? words("Number", 42, 600) + words("(write-in)", 42, 620) : ""}</page></body></html>`;
	return { candidates, notice };
}
function parse(candidates: string, notice: string) {
	return readFranklinCandidateDocuments(source, candidates, notice, createStateCandidateRecord);
}

test("Franklin's synthetic PDF rows preserve joint tickets, write-ins, terms, parties and safe campaign links", () => {
	const { candidates, notice } = fixture();
	const result = parse(candidates, notice);
	assert.equal(result.records.length, 5);
	assert.equal(result.revision, "Revised October 16, 2026");
	assert.equal(result.records[0]!.name, "Alex One and Blair Two");
	assert.equal(result.records[0]!.candidateUrl, "https://www.alexexample.org/");
	assert.equal(result.records[1]!.party, "Other-party");
	assert.match(result.records[1]!.office, /unexpired term ending 1-3-2029/u);
	assert.equal(result.records[2]!.status, "write-in");
	assert.equal(result.records[2]!.sourceStatus, "Registered write-in in county FWAB notice");
	assert.equal(result.records[2]!.district, "15");
	assert.equal(result.records[3]!.sourceStatus, "Registered write-in");
	assert.equal(result.records[4]!.scope, "local");
	assert.equal(result.records[4]!.district, "");
	assert.equal(result.records[4]!.jurisdiction, "Ohio Court of Appeals, 10th District");
	assert.equal(result.records[4]!.party, undefined);
	assert.doesNotMatch(JSON.stringify(result), /private@example|555-555/u);
});

test("Franklin's continuation page does not discard its first candidate when column headings are not repeated", () => {
	const one = fixture();
	const continuation = fixture({ continuation: true });
	assert.deepEqual(parse(continuation.candidates, continuation.notice).records, parse(one.candidates, one.notice).records);
});

test("Franklin's synthetic later election is read from both source documents, not substituted into a current roster", () => {
	const { candidates, notice } = fixture({ year: 2028 });
	const future = { ...source, electionDate: "2028-11-07", id: "oh-franklin-general-2028-11-07" };
	assert.equal(readFranklinCandidateDocuments(future, candidates, notice, createStateCandidateRecord).records.length, 5);
	assert.throws(() => parse(candidates, notice), /election heading/u);
});

test("Franklin's differing name spelling needs exact reviewed election and office evidence", () => {
	const { candidates, notice } = fixture({ alias: true });
	assert.throws(() => parse(candidates, notice), /cannot be reconciled/u);
	const alias = { electionDate: "2026-11-03", name: "Emery Five", noticeName: "Emory Five", office: rows[3]!.office };
	const result = readFranklinCandidateDocuments(source, candidates, notice, createStateCandidateRecord, [alias]);
	assert.equal(result.records[3]!.name, "Emery Five");
	assert.equal(result.records[3]!.status, "write-in");
	for (const invalid of [{ ...alias, electionDate: "2028-11-07" }, { ...alias, office: "COUNTY AUDITOR" }, { ...alias, name: "Another Person" }])
		assert.throws(() => readFranklinCandidateDocuments(source, candidates, notice, createStateCandidateRecord, [invalid]), /spelling evidence/u);
});

test("Franklin's question section cannot produce candidate write-ins", () => {
	const { candidates, notice } = fixture({ questionMarker: true });
	assert.equal(parse(candidates, notice).records.filter(record => record.status === "write-in").length, 2);
});

test("Franklin's reader refuses unknown offices, parties, term dates and write-in states", () => {
	const { candidates, notice } = fixture();
	for (const body of [candidates.replace(">Democratic<", ">Unknown<"), candidates.replace(">02/09/2027<", ">02/31/2027<"), candidates.replace(">Yes<", ">Maybe<")])
		assert.throws(() => parse(body, notice));
	assert.throws(() => parse(candidates.replace("GOVERNOR", "UNKNOWN"), notice), /office requires review/u);
	assert.throws(() => parse(candidates.replace("October", "February").replace(">16,<", ">30,<"), notice), /revision/u);
});

test("Franklin's reader rejects missing or contradictory supplemental evidence", () => {
	const { candidates, notice } = fixture();
	assert.throws(() => parse(candidates, notice.replace("Other-party", "Republican")), /clipped/u);
	assert.throws(() => parse(candidates, notice.replace(/<word\b[^>]*>\(write-in\)<\/word>/gu, "")), /write-in sources disagree/u);
	assert.throws(() => parse(candidates, notice.replace("November", "October")), /FWAB election identity/u);
	assert.throws(() => parse(candidates, notice.replace("Drew", "Rory")), /cannot be reconciled/u);
	assert.throws(() => parse(candidates, notice.replace("Drew", "Drew Middle")), /cannot be reconciled/u);
});

test("Franklin's reader bounds geometry, input size, normalization and candidate identities", () => {
	const { candidates, notice } = fixture();
	assert.throws(() => parse(candidates.replace("width=\"792\"", "width=\"600\""), notice), /dimensions/u);
	assert.throws(() => parse(candidates.replace("xMin=\"52\"", "xMin=\"NaN\""), notice), /geometry/u);
	assert.throws(() => parse("x".repeat(4 * 1024 * 1024 + 1), notice), /bounds/u);
	assert.throws(() => parse("<div>".repeat(65) + candidates + "</div>".repeat(65), notice), /structure/u);
	assert.throws(() => readFranklinCandidateDocuments(source, candidates, notice, () => null), /normalization/u);
	assert.throws(() => readFranklinCandidateDocuments(source, candidates, notice, (source, values) => ({ ...createStateCandidateRecord(source, values)!, id: "same" })), /identities/u);
});
