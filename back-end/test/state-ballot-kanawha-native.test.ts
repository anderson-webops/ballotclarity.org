import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { readKanawhaTestDocument, readKanawhaTestText, validateKanawhaPdfStructure } from "../src/state-ballot-kanawha-native.js";
import { StateBallotPdfCapabilityError } from "../src/state-ballot-pdf.js";

const digest = "a".repeat(64);
function section(heading: string, rows: string[], voteLimit = 1, question = false) {
	return `${heading}\nVote For ${voteLimit}\n          TOTAL VOTE %\n${rows.map(row => `${row}          0`).join("\n")}\n${question ? "" : "Write-In Totals          0\n"}Total Votes Cast          0\n`;
}
function report(year = "2026") {
	const date = year === "2026" ? "November 3, 2026" : "November 7, 2028";
	const header = `Summary Results Report          UNOFFICIAL RESULTS\nGeneral Election\n${date}          Kanawha County, WV\n`;
	const stats = "TOTAL\nStatistics\nElection Day Precincts Reporting          0 of 183\nAbsentee/ Early Precincts Reporting          0 of 183\nRegistered Voters - Total          121,007\nBallots Cast - Total          0\nBallots Cast - Blank          0\nVoter Turnout - Total          0.00%\n";
	const footer = (page: number) => `Election Summary - 10/14/${year} 09:49AM          Page ${page} of 2\n\f`;
	return header + stats
		+ section("FOR U.S. SENATOR", ["REP ALEX EXAMPLE", "DEM BLAIR EXAMPLE", "CST CASEY EXAMPLE", "NO CANDIDATE(S) NOMINATED"])
		+ section("FOR STATE SENATOR UNEXPIRED 17TH DISTRICT", ["IND DREW EXAMPLE"])
		+ section("AMENDMENT NO. 1", ["FOR", "AGAINST"], 1, true) + footer(1)
		+ header + section("FOR MAGISTRATE DIV 6 UNEXP", ["ELLIS EXAMPLE"])
		+ section("FOR CITY COUNCIL WARD 2 CITY OF CHARLESTON", ["DEM FRANKIE EXAMPLE"], 2)
		+ section("FOR MAYOR TOWN OF CHESAPEAKE", ["GARY (GUS) EXAMPLE", "HAYDEN EXAMPLE"])
		+ section("FOR TREASURER CITY OF CHARLESTON", ["REP INDIGO EXAMPLE"])
		+ section("LIBRARY LEVY", ["For the Levies", "Against the Levies"], 1, true) + footer(2);
}
function structure() {
	return { pages: [{ object: "1 0 R" }, { object: "3 0 R" }], encrypt: { encrypted: false }, acroform: { needappearances: false, fields: [] }, attachments: {}, qpdf: [{ jsonversion: 2 }, {
		"obj:2 0 R": { value: { "/BaseFont": "/Helvetica", "/Encoding": "/WinAnsiEncoding", "/Subtype": "/Type1", "/Type": "/Font" } },
		"obj:1 0 R": { value: { "/Type": "/Page", "/MediaBox": [0, 0, 612, 792], "/Resources": { "/Font": { "/F1": "2 0 R" } } } },
		"obj:3 0 R": { value: { "/Type": "/Page", "/MediaBox": [0, 0, 612, 792], "/Resources": { "/Font": { "/F1": "2 0 R" } } } },
	}] };
}

test("Kanawha test reports preserve complete candidate, party, office and source-page facts", () => {
	const parsed = readKanawhaTestText(report(), digest);
	assert.equal(parsed.candidates.length, 9);
	assert.equal(parsed.candidateOccurrences, 9);
	assert.equal(parsed.contests.length, 6);
	assert.equal(parsed.pages, 2);
	assert.deepEqual(parsed.candidates.slice(0, 4).map(item => item.party), ["Republican", "Democratic", "Constitution", "Independent"]);
	assert.equal(parsed.candidates[0]!.sourcePartyCode, "REP");
	assert.equal(parsed.candidates[4]!.sourceDivision, "6");
	assert.equal(parsed.candidates[4]!.party, undefined);
	assert.equal(parsed.candidates[5]!.jurisdiction, "City of Charleston");
	assert.equal(parsed.candidates[5]!.voteLimit, 2);
	assert.equal(parsed.candidates[6]!.jurisdiction, "Town of Chesapeake");
	assert.equal(parsed.candidates[6]!.party, undefined);
	assert(parsed.candidates.every(item => item.occurrences.length === 1 && item.occurrences[0]!.line > 0));
});

test("Kanawha keeps unexpired terms and municipal wards separate from voter applicability", () => {
	const parsed = readKanawhaTestText(report(), digest);
	assert.equal(parsed.candidates[3]!.scope, "state-senate");
	assert.equal(parsed.candidates[3]!.district, "17");
	assert.equal(parsed.candidates[3]!.ballotDesignation, "Unexpired term");
	assert.equal(parsed.candidates[4]!.scope, "local");
	assert.equal(parsed.candidates[4]!.district, "");
	assert.equal(parsed.candidates[5]!.district, "");
	assert.equal(parsed.candidates[5]!.office, "City Council, Ward 2");
	assert(!("status" in parsed.candidates[0]!));
	assert(!("seats" in parsed.candidates[5]!));
});

test("Kanawha placeholders, aggregate statistics and write-in totals never become people or results", () => {
	const parsed = readKanawhaTestText(report(), digest);
	assert.equal(parsed.contests[0]!.placeholderRows, 1);
	assert(!parsed.candidates.some(item => /NOMINATED|Write-In|Total/u.test(item.name)));
	assert.doesNotMatch(JSON.stringify(parsed.candidates), /121,007|ballotsCast|votesCast|turnout|address|phone|email/iu);
	assert.equal(parsed.questions.length, 2);
	assert.deepEqual(parsed.questions[0]!.choices, ["FOR", "AGAINST"]);
	assert.equal(parsed.questions[0]!.completeBallotText, false);
	assert.deepEqual(parsed.questions[1]!.choices, ["For the Levies", "Against the Levies"]);
});

test("Kanawha publication clocks retain minute precision without an invented time zone", () => {
	const parsed = readKanawhaTestText(report(), digest);
	assert.equal(parsed.sourceAsOfDate, "2026-10-14");
	assert.equal(parsed.publicationClock, "2026-10-14T09:49");
	assert.equal(parsed.publicationClockPrecision, "minute");
	assert.equal(parsed.electionDate, "2026-11-03");
	assert.throws(() => readKanawhaTestText(report().replace("09:49AM", "09:50AM"), digest));
});

test("Kanawha future examples require explicit mutually consistent dates and complete pagination", () => {
	assert.equal(readKanawhaTestText(report("2028"), digest).electionDate, "2028-11-07");
	for (const text of [report().replace("November 3", "November 4"), report().replace("General Election", "Primary Election"), report().replace("Kanawha County", "Other County"), report().replace("Page 2 of 2", "Page 3 of 2"), report().replace("Page 1 of 2", "Page 1 of 3"), report().replace("10/14/2026", "11/04/2026"), report().replace("09:49AM", "13:49AM")]) assert.throws(() => readKanawhaTestText(text, digest));
});

test("Kanawha holds actual vote counts and reporting progress rather than importing election results", () => {
	for (const text of [report().replace("0 of 183", "1 of 183"), report().replace("Total          0\n", "Total          1\n"), report().replace("ALEX EXAMPLE          0", "ALEX EXAMPLE          1"), report().replace("0.00%", "0.01%"), report().replace("Total Votes Cast          0", "Total Votes Cast          10")]) assert.throws(() => readKanawhaTestText(text, digest));
});

test("Kanawha rejects unknown offices, parties, malformed choices and duplicate identities", () => {
	for (const text of [report().replace("FOR TREASURER", "FOR UNKNOWN OFFICE"), report().replace("REP ALEX", "ZZZ ALEX"), report().replace("REP ALEX EXAMPLE", "ALEX EXAMPLE"), report().replace("AGAINST          0", "For the Levies          0"), report().replace("DEM BLAIR EXAMPLE", "REP ALEX EXAMPLE"), report().replace("BLAIR EXAMPLE", "Blair Example"), report().replace("Write-In Totals          0\n", ""), report().replace("Vote For 2", "Vote For 21")]) assert.throws(() => readKanawhaTestText(text, digest));
});

test("Kanawha empty validated rosters remain empty instead of manufacturing candidate facts", () => {
	const body = report().replace(/(?:REP|DEM|CST|IND) [A-Z ]+EXAMPLE|ELLIS EXAMPLE|GARY \(GUS\) EXAMPLE|HAYDEN EXAMPLE/gu, "NO CANDIDATE(S) NOMINATED");
	assert.equal(readKanawhaTestText(body, digest).candidates.length, 0);
});

test("Kanawha PDF structure requires the reviewed standard font, resources and page boundaries", () => {
	assert.deepEqual(validateKanawhaPdfStructure(JSON.stringify(structure())), { pages: 2, font: "Helvetica", encoding: "WinAnsiEncoding" });
	for (const change of [
		(value: ReturnType<typeof structure>) => { value.encrypt.encrypted = true; },
		(value: ReturnType<typeof structure>) => { Object.assign(value.attachments, { extra: {} }); },
		(value: ReturnType<typeof structure>) => { Object.assign(value.qpdf[1], { "obj:4 0 R": { value: { "/JavaScript": "unknown" } } }); },
		(value: ReturnType<typeof structure>) => { Object.assign(value.qpdf[1], { "obj:2 0 R": { value: { "/BaseFont": "/Unknown", "/Encoding": "/WinAnsiEncoding", "/Subtype": "/Type1", "/Type": "/Font" } } }); },
		(value: ReturnType<typeof structure>) => { Object.assign(value.qpdf[1], { "obj:1 0 R": { value: { "/Type": "/Page", "/MediaBox": [0, 0, 612, 792], "/CropBox": [0, 0, 10, 10] } } }); },
		(value: ReturnType<typeof structure>) => { value.pages.push({ object: "missing" }); },
	]) {
		const value = structure();
		change(value);
		assert.throws(() => validateKanawhaPdfStructure(JSON.stringify(value)));
	}
});

test("Kanawha native input bounds and worker capability failures remain explicit", async () => {
	for (const value of ["", " ".repeat(4 * 1024 * 1024 + 1), `${report()}\u0000`, report().replace("ALEX", "ALEX\uFFFD")]) assert.throws(() => readKanawhaTestText(value, digest));
	assert.throws(() => readKanawhaTestText(report(), "invalid"));
	await assert.rejects(readKanawhaTestDocument(Buffer.from("%PDF-1.4"), { objectExecutable: "relative-qpdf" }), StateBallotPdfCapabilityError);
});
