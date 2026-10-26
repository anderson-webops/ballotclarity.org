import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { readWinnebagoCandidateDocument } from "../src/state-ballot-winnebago.js";
import { winnebagoField, winnebagoFixture } from "./helpers/winnebago-fixture.js";

const source: StateBallotSource = { id: "il-winnebago-2026", stateCode: "IL", label: "Winnebago County general-election candidates", electionDate: "2026-11-03", url: "https://wincoil.gov/media/attachments/2026/09/25/november-2026-candidate-list.pdf", pageUrl: "https://wincoil.gov/departments/clerks-office/election-information", format: "reviewed-pdf", retrievalPolicy: "manual-snapshot", snapshotStorage: "external" };
const read = (body = winnebagoFixture()) => readWinnebagoCandidateDocument(source, body, createStateCandidateRecord);

test("Winnebago native preparation preserves tickets, printed parties, regional scope and page evidence", () => {
	const result = read();
	assert.equal(result.records.length, 11);
	assert.equal(result.pageCount, 2);
	assert.deepEqual(result.claims.map(claim => claim.page), [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2]);
	assert.deepEqual(result.records.filter(row => row.office === "GOVERNOR/LIEUTENANT GOV.").map(row => row.name), ["SAMPLE GOVERNOR / SAMPLE PARTNER", "SECOND GOVERNOR / SECOND PARTNER"]);
	assert.equal(result.records.find(row => row.name === "SAMPLE INDEPENDENT")!.party, "Independent");
	assert.equal(result.records.find(row => row.name === "SAMPLE REPRESENTATIVE")!.district, "16");
	assert.equal(result.records.find(row => row.name === "SAMPLE REPRESENTATIVE")!.scope, "congressional");
	const board = result.records.find(row => row.name === "SAMPLE BOARD MEMBER")!;
	assert.equal(board.ballotDesignation, "Unexpired 2-year term");
	assert.equal(board.scope, "local");
	assert.equal(board.district, "");
	assert.equal(board.jurisdiction, "Winnebago County, Illinois, County Board District 12");
	const judge = result.records.find(row => row.name === "SAMPLE JUDGE")!;
	assert.equal(judge.scope, "local");
	assert.equal(judge.party, "Nonpartisan");
	assert.equal(judge.ballotDesignation, "Judicial retention");
	assert.equal(judge.office, "4TH APPELLATE COURT JUDGE RETENTION: SAMPLE JUDGE");
	assert(result.records.every(row => row.sourceStatus === "Published general-election candidate"));
	assert(!JSON.stringify(result).includes("PRIVATE SAMPLE"));
	assert(!result.records.some(row => row.name === "NO CANDIDATE"));
});

test("Winnebago native preparation keeps every judge's retention question separate", () => {
	const result = read(winnebagoFixture().replace(winnebagoField("SAMPLE JUDGE", 293, 666), winnebagoField("SAMPLE JUDGE", 293, 666) + winnebagoField("SECOND JUDGE", 293, 685)));
	const judges = result.records.filter(row => row.ballotDesignation === "Judicial retention");
	assert.equal(judges.length, 2);
	assert.equal(new Set(judges.map(row => row.office)).size, 2);
	assert(judges.every(row => row.office.endsWith(`: ${row.name}`)));
	assert(judges.every(row => row.sourceDistrictLabel === "4TH APPELLATE COURT JUDGE RETENTION"));
	assert.deepEqual(result.claims.filter(claim => judges.some(judge => judge.id === claim.recordId)).map(claim => claim.officeLabel), ["4TH APPELLATE COURT JUDGE RETENTION", "4TH APPELLATE COURT JUDGE RETENTION"]);
});

test("Winnebago native preparation rejects broken pages, dates, labels, tickets and lost candidate styling", () => {
	for (const [caseIndex, body] of [
		winnebagoFixture().replace("number=\"2\"", "number=\"3\""),
		winnebagoFixture().replace("width=\"918\"", "width=\"900\""),
		winnebagoFixture().replace("Page 1 of 2", "Page 1 of 3"),
		winnebagoFixture().replace("9/25/2026", "11/4/2026"),
		winnebagoFixture().replace("9/25/2026", "2/30/2026"),
		winnebagoFixture().replace("GENERAL", "PRIMARY"),
		winnebagoFixture().replace("DEMOCRAT", "OTHER PARTY"),
		winnebagoFixture().replace("SHERIFF", "NEW OFFICE"),
		winnebagoFixture().replace("DISTRICT TWELVE -", "DISTRICT UNREVIEWED -"),
		winnebagoFixture().replace(winnebagoField("SAMPLE PARTNER", 293, 335), ""),
		winnebagoFixture().replace("SAMPLE GOVERNOR /", "SAMPLE GOVERNOR"),
		winnebagoFixture().replace("INDEPENDENT CANDIDATE", "UNREVIEWED CANDIDATE"),
		winnebagoFixture().replace(winnebagoField("SAMPLE SENATOR", 293, 206), winnebagoField("SAMPLE SENATOR", 293, 206, false)),
		winnebagoFixture().replace(winnebagoField("SAMPLE SENATOR", 293, 206), winnebagoField("SAMPLE SENATOR", 294, 206)),
		winnebagoFixture().replace("</page>", `${winnebagoField("NEW HEADING", 450, 150)}</page>`),
		winnebagoFixture().replace("</page>", "<image src=\"unread.png\"/></page>"),
		`${winnebagoFixture()}\u0000`,
		winnebagoFixture().replace("SAMPLE JUDGE", "NO CANDIDATE"),
		winnebagoFixture().replace("</pdf2xml>", ""),
		winnebagoFixture().replace(winnebagoField("4TH APPELLATE COURT JUDGE RETENTION", 33, 648), winnebagoField("4TH APPELLATE COURT JUDGE RETENTION", 33, 648, false)),
		winnebagoFixture().replace("9/25/2026", "9/26/2026"),
		winnebagoFixture().replace("123 PRIVATE SAMPLE RD.", "UNREVIEWED PERSON"),
		winnebagoFixture().replace("OTHER COMMISSIONER", "SAMPLE COMMISSIONER")
	].entries()) assert.throws(() => read(body), /Winnebago/u, `case ${caseIndex}`);
});

test("Winnebago native preparation retains school-region and judicial-vacancy labels without district matching", () => {
	const school = read(winnebagoFixture().replace("16TH CONGRESSIONAL", "BOONE-WINNEBAGO SUPERINTENDENT OF SCHOOLS")).records.find(row => row.name === "SAMPLE REPRESENTATIVE")!;
	assert.equal(school.scope, "local");
	assert.equal(school.district, "");
	assert.equal(school.jurisdiction, "Illinois, BOONE-WINNEBAGO school region");
	const judge = read(winnebagoFixture().replace("16TH CONGRESSIONAL", "17TH CIRCUIT - 1ST SUB CIRCUIT SAMPLE VACANCY")).records.find(row => row.name === "SAMPLE REPRESENTATIVE")!;
	assert.equal(judge.scope, "local");
	assert.equal(judge.ballotDesignation, "SAMPLE VACANCY");
});

test("Winnebago native preparation preserves literal Unicode and accepts a matching future general election", () => {
	assert.equal(read(winnebagoFixture().replace("SAMPLE SENATOR", "SAMPLE PICHÉ")).records[0]!.name, "SAMPLE PICHÉ");
	assert.throws(() => read(winnebagoFixture(2028)), /Winnebago/u);
	assert.equal(readWinnebagoCandidateDocument({ ...source, electionDate: "2028-11-07" }, winnebagoFixture(2028), createStateCandidateRecord).records.length, 11);
	assert.throws(() => readWinnebagoCandidateDocument({ ...source, stateCode: "WI" }, winnebagoFixture(), createStateCandidateRecord), /Winnebago/u);
	assert.throws(() => readWinnebagoCandidateDocument({ ...source, electionDate: "2028-11-08" }, winnebagoFixture(2028), createStateCandidateRecord), /Winnebago/u);
	assert.throws(() => readWinnebagoCandidateDocument(source, winnebagoFixture(), () => null), /Winnebago/u);
});
