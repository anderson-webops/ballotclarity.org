import assert from "node:assert/strict";
import test from "node:test";
import { readPulaskiCandidateNotice } from "../src/state-ballot-pulaski.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { pulaskiNoticeFixture } from "./helpers/pulaski-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "ar-pulaski-candidates-2026")!;
const read = (body = pulaskiNoticeFixture()) => readPulaskiCandidateNotice(source, body);
test("Pulaski's native notice reader includes bottom-column rows and preserves printed ambiguity", () => {
	const actual = read();
	assert.equal(actual.records.length, 8);
	assert.equal(actual.namedOfficeGroups, 7);
	assert.equal(actual.unopposedAsPrinted, 3);
	assert.equal(actual.records[3]!.name, "Last Candidate");
	assert.equal(actual.records[4]!.name, "Pulaski County Assessor, Example Longname Person");
	assert.equal(actual.records[1]!.office, "State Representative District 77");
	assert.equal(actual.records[6]!.office, "Jacksonville Council Member W4 P1");
	assert(actual.records.every(record => record.status === "listed"));
	assert.deepEqual(actual.claims.map(item => item.page), [1, 1, 1, 1, 2, 2, 2, 2]);
});
test("Pulaski's native notice reader rejects broken headings, columns, parties, page sequences and wraps", () => {
	for (const body of [
		pulaskiNoticeFixture().replace("November 3, 2026", "November 4, 2026"),
		pulaskiNoticeFixture().replace("Page 2 of 3", "Page 1 of 3"),
		pulaskiNoticeFixture().replace("width=\"612\"", "width=\"700\""),
		pulaskiNoticeFixture().replace("xMin=\"420\"", "xMin=\"415\""),
		pulaskiNoticeFixture().replace("State Representative District 77", "Unreviewed Office"),
		pulaskiNoticeFixture().replace("Sample Senator-DEM", "Sample Senator-UNKNOWN"),
		pulaskiNoticeFixture().replace("Pulaski County Assessor, Example Longname", "Unclear Wrapped Row"),
		pulaskiNoticeFixture().replace("CANDIDATES FOR THIS ELECTION", "SOMETHING ELSE"),
		pulaskiNoticeFixture().replaceAll("CONSTITUTIONAL AMENDMENTS", "Other material"),
		`${pulaskiNoticeFixture()}\u0000`
	]) assert.throws(() => read(body), /Pulaski/u);
});
