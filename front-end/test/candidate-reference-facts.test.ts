import type { PublicElectionReference } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { candidateReferenceFacts } from "../src/utils/candidate-reference-facts.ts";

const reference = (facts: string[]): PublicElectionReference => ({ id: "example", name: "Jane Example", office: "Governor", scope: "statewide", facts, source: { kind: "candidate-statement", title: "Campaign biography", publisher: "Example Campaign", url: "https://example.org/", capturedAt: "2026-11-01T12:00:00Z" } });

test("candidate backgrounds omit generated matching and role metadata but retain substantive facts", () => {
	const original = reference(["Listed by Open States as a serving legislator.", "Recorded role start: January 1, 2025.", "Listed occupation: Teacher", "Education: Example University."]);
	const before = JSON.stringify(original);
	assert.deepEqual(candidateReferenceFacts([original])[0]!.facts, ["Occupation: Teacher", "Education: Example University."]);
	assert.equal(JSON.stringify(original), before);
});

test("duplicate facts and empty reference groups are omitted without adding absence copy", () => {
	assert.deepEqual(candidateReferenceFacts([reference(["Teacher."]), reference(["teacher."])])[0]!.facts, ["Teacher."]);
	assert.equal(candidateReferenceFacts([reference(["Teacher."])], ["teacher."]).length, 0);
	assert.equal(candidateReferenceFacts([reference(["Matched from another dataset."])]).length, 0);
	assert.equal(candidateReferenceFacts([]).length, 0);
});
