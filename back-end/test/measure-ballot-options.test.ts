import assert from "node:assert/strict";
import test from "node:test";
import { buildSeedCoverageSnapshot, isSupportedMeasureBallotOptions, parseCoverageSnapshot } from "../src/coverage-repository.js";

test("binary ballot options preserve supported printed labels and legacy omission", () => {
	for (const options of [undefined, { yes: "Yes", no: "No" }, { yes: "YES", no: "NO" }, { yes: "For", no: "Against" }, { yes: "Approve", no: "Reject" }, { yes: "For general obligation bonds", no: "Against general obligation bonds" }])
		assert.equal(isSupportedMeasureBallotOptions(options), true);
});

test("D.C. printed approval choices retain the complete pair and refuse mixed or reversed meanings", () => {
	const options = { yes: "Yes, to approve", no: "No, to reject" };
	assert.equal(isSupportedMeasureBallotOptions(options), true);
	for (const invalid of [{ yes: options.no, no: options.yes }, { yes: options.yes, no: "No" }, { yes: "Yes", no: options.no }, { yes: "Yes to approve", no: "No to reject" }])
		assert.equal(isSupportedMeasureBallotOptions(invalid), false);
	for (const nested of [false, true]) {
		const snapshot = structuredClone(buildSeedCoverageSnapshot());
		const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
		measure.ballotOptions = options;
		assert.equal(parseCoverageSnapshot(snapshot), snapshot);
		assert.deepEqual(measure.ballotOptions, options);
	}
});

test("Maryland printed constitutional, charter, bond and referred-law labels remain distinct", () => {
	for (const subject of ["the Constitutional Amendment", "Charter Amendment", "the Charter Amendment", "Bond Issue", "the Referred Law"]) {
		const options = { yes: `For ${subject}`, no: `Against ${subject}` };
		assert.equal(isSupportedMeasureBallotOptions(options), true);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.no, no: options.yes }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.yes, no: "Against" }), false);
	}
});

test("unsupported, reversed, duplicate and non-binary choices are not coerced", () => {
	for (const options of [null, [], {}, { yes: "A", no: "B" }, { yes: "Reject", no: "Approve" }, { yes: "For", no: "For" }, { yes: " For", no: "Against" }, { yes: "For", no: "Against", third: "Abstain" }, { yes: "Against general obligation bonds", no: "For general obligation bonds" }])
		assert.equal(isSupportedMeasureBallotOptions(options), false);
});

test("reviewed Colorado combined and measure-specific labels retain their exact pair", () => {
	for (const options of [{ yes: "YES/FOR", no: "NO/AGAINST" }, { yes: "For the Measure", no: "Against the Measure" }]) {
		assert.equal(isSupportedMeasureBallotOptions(options), true);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.no, no: options.yes }), false);
		for (const nested of [false, true]) {
			const snapshot = structuredClone(buildSeedCoverageSnapshot());
			const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
			measure.ballotOptions = options;
			assert.equal(parseCoverageSnapshot(snapshot), snapshot);
			assert.deepEqual(measure.ballotOptions, options);
		}
	}
	for (const options of [{ yes: "YES/FOR", no: "NO" }, { yes: "YES", no: "NO/AGAINST" }, { yes: "YES / FOR", no: "NO / AGAINST" }, { yes: "For the Measure", no: "Against" }, { yes: "For", no: "Against the Measure" }, { yes: "For Incorporation", no: "Against Incorporation" }])
		assert.equal(isSupportedMeasureBallotOptions(options), false);
});

test("reviewed Connecticut bilingual choices preserve complete printed pairs", () => {
	for (const options of [{ yes: "Yes/Sí", no: "No/No" }, { yes: "Yes/Sí", no: "No" }, { yes: "Yes - Si", no: "No - No" }]) {
		assert.equal(isSupportedMeasureBallotOptions(options), true);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.no, no: options.yes }), false);
		for (const nested of [false, true]) {
			const snapshot = structuredClone(buildSeedCoverageSnapshot());
			const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
			measure.ballotOptions = options;
			const parsed = parseCoverageSnapshot(snapshot);
			assert.ok(parsed);
			assert.deepEqual(nested ? parsed.election!.contests.flatMap(contest => contest.measures ?? [])[0]!.ballotOptions : parsed.measures[0]!.ballotOptions, options);
		}
	}
	for (const options of [{ yes: "Yes/Si", no: "No/No" }, { yes: "Yes - Sí", no: "No - No" }, { yes: "Yes - Si", no: "No" }, { yes: "Yes/Sí", no: "No - No" }, { yes: "Sí", no: "No" }])
		assert.equal(isSupportedMeasureBallotOptions(options), false);
});

test("Oklahoma proposal and proposition choices preserve the entire printed pair", () => {
	for (const subject of ["PROPOSAL", "PROPOSITION"]) {
		const options = { yes: `FOR THE ${subject} - YES`, no: `AGAINST THE ${subject} - NO` };
		assert.equal(isSupportedMeasureBallotOptions(options), true);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.no, no: options.yes }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.yes, no: "NO" }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.yes, no: `AGAINST THE ${subject} - YES` }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.yes, no: subject === "PROPOSAL" ? "AGAINST THE PROPOSITION - NO" : "AGAINST THE PROPOSAL - NO" }), false);
		for (const nested of [false, true]) {
			const snapshot = structuredClone(buildSeedCoverageSnapshot());
			const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
			measure.ballotOptions = options;
			assert.equal(parseCoverageSnapshot(snapshot), snapshot);
		}
	}
});

test("reviewed Florida tax, charter and bond choices retain exact binary pairs", () => {
	const pairs = [
		{ yes: "Yes - For the ½ Cent Sales Tax", no: "No - Against the ½ Cent Sales Tax" },
		{ yes: "Yes - For Renewal Of Millage", no: "No - Against Renewal Of Millage" },
		{ yes: "Yes - For the Renewal of the Half-Cent Sales Tax", no: "No - Against the Renewal of the Half-Cent Sales Tax" },
		{ yes: "Yes - In Favor", no: "No - Opposed" },
		{ yes: "Yes - For Approval", no: "No - For Rejection" },
		{ yes: "Yes - For Bonds", no: "No - Against Bonds" },
	];
	for (const [index, options] of pairs.entries()) {
		assert.equal(isSupportedMeasureBallotOptions(options), true);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.no, no: options.yes }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.yes, no: "No" }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: "Yes", no: options.no }), false);
		assert.equal(isSupportedMeasureBallotOptions({ yes: options.yes, no: pairs[(index + 1) % pairs.length]!.no }), false);
		for (const nested of [false, true]) {
			const snapshot = structuredClone(buildSeedCoverageSnapshot());
			const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
			measure.ballotOptions = options;
			assert.equal(parseCoverageSnapshot(snapshot), snapshot);
			assert.deepEqual(measure.ballotOptions, options);
		}
	}
	assert.equal(isSupportedMeasureBallotOptions({ yes: "Yes - For an unspecified tax", no: "No - Against an unspecified tax" }), false);
	assert.equal(isSupportedMeasureBallotOptions({ yes: "Yes - For the 1/2 Cent Sales Tax", no: "No - Against the 1/2 Cent Sales Tax" }), false);
});

test("coverage loading rejects invalid root and nested measure labels", () => {
	for (const nested of [false, true]) {
		const snapshot = structuredClone(buildSeedCoverageSnapshot());
		const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
		measure.ballotOptions = { yes: "A", no: "B" };
		if (nested) snapshot.measures = [];
		assert.throws(() => parseCoverageSnapshot(snapshot), /supported binary ballot-option pair/u);
	}
});
