import assert from "node:assert/strict";
import test from "node:test";
import { readReviewedSantaFeCandidates } from "../src/reviewed-santa-fe-candidates.js";
import { santaFeFixture, santaFeWord } from "./helpers/santa-fe-fixture.js";

test("Santa Fe native preparation retains named choices, literal tickets and county scope", () => {
	const result = readReviewedSantaFeCandidates(santaFeFixture(), "2026-11-03");
	assert.equal(result.pageCount, 1);
	assert.equal(result.evidence.length, 6);
	assert.deepEqual(result.evidence.map(item => item.record.party), ["Democratic Party", "Republican Party", "Democratic Party", "Republican Party", "Forward Party", undefined]);
	assert.equal(result.evidence[2]!.record.name, "EXAMPLE CHEN AND EXAMPLE ORTIZ");
	assert.equal(result.evidence[3]!.record.name, "EXAMPLE LÓPEZ");
	assert.equal(result.evidence[3]!.record.district, "41");
	assert.equal(result.evidence[4]!.record.scope, "local");
	assert.equal(result.evidence[4]!.record.jurisdiction, "Santa Fe County, New Mexico");
	assert.equal(result.evidence[5]!.record.office, "Retain EXAMPLE SHANNON as Justice of the Supreme Court");
	assert.ok(result.evidence.every(item => item.page === 1 && item.record.status === "listed"));
});

test("Santa Fe preparation accepts actually printed future dates and names, not current rosters", () => {
	const result = readReviewedSantaFeCandidates(santaFeFixture("2028", "7").replaceAll("EXAMPLE RIVERA", "NEW NAME"), "2028-11-07");
	assert.equal(result.evidence[0]!.record.name, "NEW NAME");
	assert.throws(() => readReviewedSantaFeCandidates(santaFeFixture("2028", "7"), "2026-11-03"), /printed publisher or election/u);
	assert.throws(() => readReviewedSantaFeCandidates(santaFeFixture(), "2026-11-04"), /date requires review/u);
});

test("Santa Fe geometry, column, party and office changes require review", () => {
	for (const body of [
		santaFeFixture().replace("width=\"612\"", "width=\"792\""),
		santaFeFixture().replace("CANDIDATE(S)", "CONTACT"),
		santaFeFixture().replace("EXAMPLE FORD (R)", "EXAMPLE FORD (OTHER)"),
		santaFeFixture().replace("COUNTY SHEIRFF", "UNKNOWN OFFICE"),
		santaFeFixture().replace("</html>", ""),
		santaFeFixture().replace("FOR/AGAINST", "OTHER"),
		santaFeFixture().replace("Shall EXAMPLE SHANNON", "Shall ANOTHER NAME"),
		santaFeFixture().replace("SUPREME COURT</word>", "COURT OF APPEALS</word>"),
		santaFeFixture().replace("EXAMPLE RIVERA (D)", "test@example.org (D)"),
		santaFeFixture().replace("EXAMPLE FORD (R)", "EXAMPLE RIVERA (D)"),
		santaFeFixture().replace("</page>", `${santaFeWord(42, 550, "STATE REPRESENTATIVE")}</page>`),
	]) assert.throws(() => readReviewedSantaFeCandidates(body, "2026-11-03"), /Santa Fe/u);
});

test("Santa Fe named local retentions stay local without inferring personal eligibility", () => {
	const body = santaFeFixture().replace("SUPREME COURT</word>", "DISTRICT COURT JUDGE, DIVISION 7</word>").replace("Justice of the Supreme Court?", "District Court Judge, Division 7?");
	const record = readReviewedSantaFeCandidates(body, "2026-11-03").evidence.at(-1)!.record;
	assert.equal(record.scope, "local");
	assert.equal(record.district, "7");
	assert.equal(record.jurisdiction, "Santa Fe County, New Mexico");
	assert.equal(record.party, undefined);
});
