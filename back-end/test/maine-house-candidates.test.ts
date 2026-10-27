import assert from "node:assert/strict";
import test from "node:test";
import { readMaineHouseCandidates } from "../src/maine-house-candidates.js";
import { maineHouseFixture } from "./helpers/maine-house-fixture.js";

test("Maine House reader retains names, source party labels, residences and explicit incumbency markers", () => {
	const result = readMaineHouseCandidates(maineHouseFixture());
	assert.equal(result.legislature, 133);
	assert.equal(result.records.length, 2);
	assert.equal(result.districts.length, 151);
	assert.equal(result.reportedIncumbents, 1);
	assert.equal(result.records[0]!.name, "Example, Ada");
	assert.equal(result.records[0]!.party, "Democrat");
	assert.equal(result.records[0]!.partyCode, "D");
	assert.equal(result.records[0]!.incumbent, true);
	assert.equal(result.records[1]!.incumbent, false);
	assert.equal(result.records[0]!.residenceMunicipality, "Example Town");
});

test("Maine House keeps unofficial status and legislative context separate from an election date or qualification", () => {
	const result = readMaineHouseCandidates(maineHouseFixture());
	assert.equal(result.sourceStatus, "Unofficial");
	assert.equal(result.electionDateVerified, false);
	assert(!("electionDate" in result));
	assert(result.records.every(record => !("status" in record) && !("scope" in record) && !("jurisdiction" in record)));
	assert.equal(result.districts.filter(district => district.reportedCandidates === 0).length, 150);
});

test("Maine House ignores regenerating header clocks and retains stable identities at identical substantive facts", () => {
	const original = readMaineHouseCandidates(maineHouseFixture());
	const regenerated = readMaineHouseCandidates(maineHouseFixture().replace("October 27, 2026 - 7:48 AM", "October 28, 2026 - 8:15 AM"));
	assert.deepEqual(regenerated, original);
	const next = readMaineHouseCandidates(maineHouseFixture(134).replace("134rd", "134th"));
	assert.equal(next.legislature, 134);
	assert.notEqual(next.records[0]!.id, original.records[0]!.id);
	assert.equal(next.electionDateVerified, false);
});

test("Maine House reconciles all published counts and the complete district sequence", () => {
	for (const body of [maineHouseFixture().replace("<h3>2</h3>", "<h3>3</h3>"), maineHouseFixture().replace("<h3>1</h3>", "<h3>0</h3>"), maineHouseFixture().replace("<h3>151</h3>", "<h3>150</h3>"), maineHouseFixture().replace("id=\"district-151\"", "id=\"district-150\""), maineHouseFixture().replace("2 Candidates", "1 Candidate"), maineHouseFixture().replace("District 151</h5>", "District 152</h5>")]) assert.throws(() => readMaineHouseCandidates(body), /review/u);
});

test("Maine House rejects duplicate identities and contradictory or unknown party labels", () => {
	for (const body of [maineHouseFixture().replace("Sample, Bert", "Example, Ada").replaceAll("Republican", "Democrat").replace(">R</span>", ">D</span>"), maineHouseFixture().replace(">D</span>", ">R</span>"), maineHouseFixture().replace("Democrat", "Unreviewed Party"), maineHouseFixture().replace(">D</span>", ">X</span>")]) assert.throws(() => readMaineHouseCandidates(body), /review/u);
});

test("Maine House rejects hidden meaningful content and unknown candidate text instead of dropping it", () => {
	for (const body of [maineHouseFixture().replace("<body>", "<body hidden>"), maineHouseFixture().replace("<strong>", "<strong style='display:none'>"), maineHouseFixture().replace("class=\"text-end\"", "class=\"text-end d-none\""), maineHouseFixture().replace("<strong>", "<strong aria-hidden='true'>"), maineHouseFixture().replace("</li>", "<span>Unexpected status</span></li>")]) assert.throws(() => readMaineHouseCandidates(body), /review/u);
});

test("Maine House holds changed attribution, certification, district ownership and candidate markup", () => {
	for (const body of [maineHouseFixture().replace("133rd Legislature", "133st Legislature"), maineHouseFixture().replace("</li>", "<script>changed()</script></li>"), maineHouseFixture().replace("<li ", "<li onclick='changed()' "), maineHouseFixture().replace("is unofficial", "is certified"), maineHouseFixture().replace("Robert Hunt", "Other Publisher"), maineHouseFixture().replace("133rd Legislature", "District 133"), maineHouseFixture().replace("title='Incumbent'", "title='Winner'"), maineHouseFixture().replace("<strong>", "<strong>Unassigned</strong><strong>"), maineHouseFixture().replace("Example, Ada", "12345")]) assert.throws(() => readMaineHouseCandidates(body), /review/u);
});

test("Maine House bounds body and DOM complexity while preserving independent parties", () => {
	assert.throws(() => readMaineHouseCandidates(" ".repeat(2 * 1024 * 1024 + 1)), /bounds/u);
	assert.throws(() => readMaineHouseCandidates("<div>".repeat(70) + maineHouseFixture()), /DOM bounds/u);
	for (const [code, party] of [["U", "Unenrolled"], ["I", "Independent"], ["N", "No Labels"]]) {
		const result = readMaineHouseCandidates(maineHouseFixture().replace(">D</span>", `>${code}</span>`).replace("Democrat", party!));
		assert.equal(result.records[0]!.party, party);
	}
});
