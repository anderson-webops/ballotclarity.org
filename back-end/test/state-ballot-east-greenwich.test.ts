import assert from "node:assert/strict";
import test from "node:test";
import { readEastGreenwichCandidateSample } from "../src/state-ballot-east-greenwich.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { eastGreenwichFixture } from "./helpers/east-greenwich-fixture.js";

const source = stateBallotSources.find(item => item.id === "ri-east-greenwich-2026")!;
test("East Greenwich reads printed parties, terms and local offices without inferred eligibility or results", () => {
	const parsed = readEastGreenwichCandidateSample(source, eastGreenwichFixture(), "0901");
	assert.equal(parsed.records.length, 9);
	assert.equal(parsed.pageCount, 2);
	assert.equal(parsed.houseDistrict, "30");
	assert.ok(parsed.records.every(item => item.status === "listed" && item.sourceAreaLabel === "East Greenwich"));
	const council = parsed.records.filter(item => item.office === "Town Council");
	assert.equal(council.length, 2);
	assert.ok(council.every(item => item.scope === "local" && item.district === "" && item.jurisdiction === "East Greenwich" && item.ballotDesignation === "Two Year Term; Vote for up to 5"));
	assert.equal(parsed.records.find(item => item.name === "Casey Sample")?.party, "Independent");
	assert.equal(parsed.records.filter(item => item.scope === "state-house")[0]?.district, "30");
	assert.equal(new Set(parsed.records.map(item => item.id)).size, parsed.records.length);
});
test("compatible synthetic future layouts and distinct printed House districts remain data-driven", () => {
	const future = { ...source, id: "ri-east-greenwich-general-2030-11-05", electionDate: "2030-11-05" };
	const parsed = readEastGreenwichCandidateSample(future, eastGreenwichFixture(2030, 5, "0903", "24"), "0903");
	assert.equal(parsed.houseDistrict, "24");
	assert.equal(parsed.records.length, 9);
	assert.notEqual(parsed.records[0]?.id, readEastGreenwichCandidateSample(source, eastGreenwichFixture(), "0901").records[0]?.id);
});
test("unknown offices, parties, partial rows, duplicated offices and changing vote instructions require review", () => {
	const body = eastGreenwichFixture();
	for (const [before, after] of [[">Governor<", ">Unknown Office<"], [">REPUBLICAN<", ">New Party<"], [">Blair Sample<", ">Write-in<"], [">Governor<", ">General Treasurer<"], [">Vote for 1<", ">Vote for 2<"], [">Six Year Term<", ">Six Months<"], [">District 35<", ">District 36<"], [">Write-in<", ">Unexpected row<"]]) assert.throws(() => readEastGreenwichCandidateSample(source, body.replace(before!, after!), "0901"), /requires review|disagree/u);
});
test("missing pages, unknown regions, unexpected watermark and provenance mismatches are refused", () => {
	const body = eastGreenwichFixture();
	for (const value of [body.replace(/<page width="648\.000000" height="1260\.000000">[\s\S]*?<\/page>/u, ""), body.replace("width=\"648.000000\"", "width=\"612\""), body.replace(">SA<", ">Hidden Candidate<"), body.replace(">Voting continues<", ">Changed footer<"), body.replace(">State Questions<", ">Vote for 1<"), body.replace("</doc>", "<page width=\"648\" height=\"1260\"></page></doc>"), body.slice(0, -7)]) assert.throws(() => readEastGreenwichCandidateSample(source, value, "0901"), /requires review|incomplete|exceeds/u);
	assert.throws(() => readEastGreenwichCandidateSample(source, body, "0903"), /requires? review/u);
	assert.throws(() => readEastGreenwichCandidateSample({ ...source, electionDate: "2026-11-04" }, body, "0901"), /requires review/u);
	assert.throws(() => readEastGreenwichCandidateSample({ ...source, stateCode: "MA" }, body, "0901"), /requires review/u);
});
