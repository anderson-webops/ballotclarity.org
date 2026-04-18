import assert from "node:assert/strict";
import test from "node:test";
import { buildPersonLinkageConfidence, hasPersonFunding, hasPersonInfluence } from "../src/utils/person-profile.ts";

test("person profile helpers expose linkage confidence labels", () => {
	assert.equal(buildPersonLinkageConfidence("direct").label, "High linkage confidence");
	assert.equal(buildPersonLinkageConfidence("crosswalked").label, "Moderate linkage confidence");
	assert.equal(buildPersonLinkageConfidence("inferred").label, "Approximate linkage");
});

test("person profile helpers detect funding and influence module availability", () => {
	const person = {
		funding: {
			cashOnHand: 100,
			provenanceLabel: "Source-backed finance summary",
			smallDonorShare: 0.2,
			sources: [],
			summary: "Finance summary",
			topFunders: [],
			totalRaised: 500
		},
		lobbyingContext: [],
		publicStatements: [{ id: "statement-1", sources: [], summary: "Statement", title: "Statement" }]
	} as const;

	assert.equal(hasPersonFunding(person as never), true);
	assert.equal(hasPersonInfluence(person as never), true);
	assert.equal(hasPersonFunding({ ...person, funding: null } as never), false);
	assert.equal(hasPersonInfluence({ ...person, publicStatements: [] } as never), false);
});
