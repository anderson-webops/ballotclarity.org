import assert from "node:assert/strict";
import { test } from "node:test";
import { orangeProofPages, readOrangeCandidateProof } from "../src/state-ballot-orange-proof.js";
import { orangeProofField, orangeProofFixture } from "./helpers/orange-proof-fixture.js";

test("Orange County proof reconciles qualified candidates without importing incumbent context or unnamed unqualified filers", () => {
	const result = readOrangeCandidateProof(orangeProofFixture(), "2026-11-03");
	assert.equal(result.contests.length, 2);
	assert.equal(result.candidates.length, 4);
	assert.equal(result.contests[0]!.candidateCount, 3);
	assert.equal(result.contests[0]!.qualifiedCount, 2);
	assert.deepEqual(result.candidates.map(candidate => candidate.name), ["PARTISAN ONE", "PARTISAN TWO", "LOCAL ONE", "LOCAL TWO"]);
	assert.equal(result.candidates[0]!.party, "Republican");
	assert.equal(result.candidates[1]!.party, "Democratic");
	assert.equal(result.candidates[2]!.party, undefined);
	assert.equal(result.candidates[2]!.ballotDesignation, "Synthetic ballot designation");
	assert.equal(result.candidates[2]!.qualifiedDate, "2026-08-07");
	assert.equal(result.sourceStatus, "Qualified Candidates");
	assert.equal(result.nativeVerificationRequired, true);
});

test("Orange County proof preserves contest continuations, source identifiers and separate printed civil clocks", () => {
	const result = readOrangeCandidateProof(orangeProofFixture(), "2026-11-03");
	assert.deepEqual(result.contests[1]!.pages, [1, 2]);
	assert.equal(result.contests[1]!.districtLabel, "*503 Example City");
	assert.equal(result.contests[1]!.sharedWith, "(none)");
	assert.equal(result.contests[1]!.voteFor, 2);
	assert.equal(result.candidates[0]!.sourceCandidateId, result.candidates[2]!.sourceCandidateId);
	assert.notEqual(result.candidates[0]!.id, result.candidates[2]!.id);
	assert.deepEqual(result.printedClocks, [{ page: 1, date: "2026-08-28", time: "15:47:35" }, { page: 2, date: "2026-08-28", time: "15:48:21" }]);
});

test("Orange County proof requires its explicit election date and keeps future examples synthetic", () => {
	assert.equal(readOrangeCandidateProof(orangeProofFixture("2028"), "2028-11-07").electionDate, "2028-11-07");
	for (const date of ["2026-11-04", "2026-02-30", "2026-11-3", "2028-11-07"]) assert.throws(() => readOrangeCandidateProof(orangeProofFixture(), date), /review/u);
	assert.throws(() => readOrangeCandidateProof(orangeProofFixture().replace("General Election -", "Primary Election -"), "2026-11-03"), /review/u);
});

test("Orange County proof rejects changed scope, ballot status, counts and unaccounted candidates", () => {
	const original = orangeProofFixture();
	for (const body of [
		original.replace("Candidates: Qualified Candidates", "Candidates: All Candidates"),
		original.replace("Contests On Ballot", "All Contests"),
		original.replace("ON BALLOT", "OFF BALLOT"),
		original.replace(orangeProofField("2", 964, 190, 7, 11), orangeProofField("4", 964, 190, 7, 11)),
		original.replace(orangeProofField("4", 187, 619, 19), orangeProofField("5", 187, 619, 19)),
		original.replace(orangeProofField("PARTISAN TWO", 167, 471, 13), ""),
		original.replace("</page>", `${orangeProofField("UNASSIGNED CANDIDATE", 167, 850, 7)}</page>`),
	]) assert.throws(() => readOrangeCandidateProof(body, "2026-11-03"), /review/u);
});

test("Orange County proof holds changed geography, office identity and missing continuation metadata", () => {
	const original = orangeProofFixture();
	for (const body of [
		original.replace(orangeProofField("*503 Example City", 502, 845, 7, 200), ""),
		original.replace(orangeProofField("Example City Council", 102, 81, 7), orangeProofField("Other Council", 102, 81, 7)),
		original.replace(orangeProofField("(none)", 168, 120, 10), ""),
		original.replace(orangeProofField("5000", 56, 81, 7), orangeProofField("1020", 56, 81, 7)),
	]) assert.throws(() => readOrangeCandidateProof(body, "2026-11-03"), /review/u);
});

test("Orange County proof rejects missing or contradictory party, designation and qualification fields", () => {
	const original = orangeProofFixture();
	for (const body of [
		original.replace(", Republican", ", Unknown Party"),
		original.replace(orangeProofField(", Republican", 268, 247, 14), ""),
		original.replace(orangeProofField("LOCAL ONE", 167, 156, 13), orangeProofField("LOCAL ONE", 167, 156, 13) + orangeProofField(", Republican", 268, 156, 14)),
		original.replace(orangeProofField("Synthetic ballot designation", 167, 266, 12), ""),
		original.replace("Qualified Date:", "Filed Date:"),
		original.replace("Cand ID:", "Other ID:"),
		original.replace(orangeProofField("2", 1092, 538, 16, 9), orangeProofField("1", 1092, 538, 16, 9)),
		original.replace("8/7/2026", "11/4/2026"),
	]) assert.throws(() => readOrangeCandidateProof(body, "2026-11-03"), /review/u);
});

test("Orange County proof rejects hidden or active markup, unexpected fonts, images and missing coordinates", () => {
	const original = orangeProofFixture();
	for (const body of [
		original.replace("<text top=\"247\"", "<text style=\"display:none\" top=\"247\""),
		original.replace("PARTISAN ONE", "PARTISAN\u202E ONE"),
		original.replace("</pdf2xml>", "<script>hidden()</script></pdf2xml>"),
		original.replace("font=\"13\"", "font=\"99\""),
		original.replace("font=\"13\"", "font=\"\""),
		original.replace("left=\"167\"", "left=\"\""),
		original.replace("id=\"13\" size=\"13\" family=\"BBBBBB+Arial\"", "id=\"13\" size=\"13\" family=\"EEEEEE+Arial\""),
		original.replace("width=\"41\" height=\"38\" src=\"seal.png\"", "width=\"200\" height=\"38\" src=\"seal.png\""),
	]) assert.throws(() => readOrangeCandidateProof(body, "2026-11-03"), /review/u);
});

test("Orange County proof bounds native pages and validates their complete sequence and footer clocks", () => {
	const original = orangeProofFixture();
	for (const body of [
		original.replace("page number=\"2\"", "page number=\"1\""),
		original.replace("width=\"1188\" height=\"918\"", "width=\"1188\" height=\"1900\""),
		original.replace("Page 2 of 2", "Page 2 of 3"),
		original.replace("3:47:35PM", "13:47:35PM"),
		original.replace("8/28/2026", "2/30/2026"),
		"x".repeat(8 * 1024 * 1024 + 1),
	]) assert.throws(() => orangeProofPages(body) && readOrangeCandidateProof(body, "2026-11-03"), /review/u);
});
