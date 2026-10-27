import type { StateBallotWorkbookSheet } from "../src/state-ballot-workbook.js";
import assert from "node:assert/strict";
import test from "node:test";
import { parseBooneCandidateSheets } from "../src/state-ballot-boone-native.js";

function sheets(): StateBallotWorkbookSheet[] {
	return [{ sheet: "Sheet1", data: [
		["Candidate Name", null, "Office", "Party", "Address", "Contact"],
		[null, null, "Assessor"],
		["Alex Example", null, null, "R", "Excluded residence", "excluded@example.invalid"],
		[],
		[null, null, "County Council District #2"],
		["Blair Example", null, "District #2", "D"],
		[null, null, "Center 1,3-6, Union 2"],
		[null, null, "Trustee (Center Twp.)"],
		["Casey Example", null, "Do not put on ballot", "I"],
		[null, null, "Western Boone"],
		[null, null, "Clinton"],
		["Drew Example"],
		[null, null, "Jackson"],
		["Drew Example"],
	] }];
}

test("Boone native facts preserve source offices, party codes and separate school areas", () => {
	const result = parseBooneCandidateSheets(sheets());
	assert.equal(result.claims.length, 5);
	assert.equal(result.sourceRows, 14);
	assert.equal(result.claims[0]!.party, "Republican");
	assert.equal(result.claims[0]!.sourcePartyCode, "R");
	assert.equal(result.claims[1]!.sourceDistrictLabel, "District #2");
	assert.equal(result.claims[1]!.party, "Democratic");
	assert.equal(result.claims[2]!.party, "Independent");
	assert.deepEqual(result.claims.slice(3).map(claim => claim.officePath), [["Western Boone", "Clinton"], ["Western Boone", "Jackson"]]);
	assert.equal(result.claims[3]!.party, undefined);
	assert.deepEqual(result.offices[1]!.areaNotes, [{ text: "Center 1,3-6, Union 2", sourceRow: 7 }]);
});

test("an explicit Boone ballot exclusion remains evidence rather than active ballot qualification", () => {
	const result = parseBooneCandidateSheets(sheets());
	assert.equal(result.claims[2]!.ballotExclusion, true);
	assert.equal(result.claims[2]!.ballotInstruction, "Do not put on ballot");
	assert.equal(result.claims[2]!.sourceRow, 9);
	assert.equal("status" in result.claims[2]!, false);
	assert.equal("electionDate" in result, false);
	assert.equal("jurisdiction" in result.claims[2]!, false);
});

test("Boone names and office facts do not retain addresses, contacts or personal assignments", () => {
	const original = parseBooneCandidateSheets(sheets());
	assert.doesNotMatch(JSON.stringify(original), /Excluded residence|excluded@|address|contact|voter/iu);
	const changed = sheets();
	changed[0]!.data[2]![4] = "Different excluded residence";
	changed[0]!.data[2]![5] = "different@example.invalid";
	assert.deepEqual(parseBooneCandidateSheets(changed), original);
});

test("Boone changed columns, parties, missing context and contradictory districts require review", () => {
	for (const change of [
		(value: StateBallotWorkbookSheet[]) => { value[0]!.sheet = "Changed"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[0]![2] = "Changed"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[2]![1] = "Unexpected column"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[2]![3] = "Unknown"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[1]![2] = "Unknown office"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[5]![2] = "District #3"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[8]![2] = "Unreviewed instruction"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[10]![2] = "Unknown school area"; },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data.push(value[0]!.data[13]!); },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data.splice(1, 1); },
		(value: StateBallotWorkbookSheet[]) => { value[0]!.data[2]![0] = null; },
		(value: StateBallotWorkbookSheet[]) => { value.push(value[0]!); },
	]) {
		const changed = sheets();
		change(changed);
		assert.throws(() => parseBooneCandidateSheets(changed), /requires review/u);
	}
});
