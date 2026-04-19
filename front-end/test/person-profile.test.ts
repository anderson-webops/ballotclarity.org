import assert from "node:assert/strict";
import test from "node:test";
import { buildPersonLinkageConfidence, buildPersonSummaryItems, hasPersonFunding, hasPersonInfluence } from "../src/utils/person-profile.ts";

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

test("person summary items link to office, funding, and influence sections with honest states", () => {
	const linkedItems = buildPersonSummaryItems({
		dataThroughLabel: "March 31, 2026",
		formatCurrency: value => `$${value.toLocaleString("en-US")}`,
		fundingHref: "#funding",
		fundingStatusSummary: "No funding data attached yet.",
		fundingTotalRaised: 1949647,
		hasFunding: true,
		hasInfluence: true,
		influenceHref: "#influence",
		influenceNoteCount: 1,
		influenceStatusSummary: "No influence context attached yet.",
		officeDisplayLabel: "U.S. Senator for Georgia",
		officeHref: "#office-context"
	});

	assert.deepEqual(linkedItems, [
		{
			href: "#office-context",
			label: "Current office",
			note: "Office context attached to this person record.",
			value: "U.S. Senator for Georgia"
		},
		{
			href: "#funding",
			label: "Funding data",
			note: "Source-backed finance summary available. Data through March 31, 2026.",
			value: "$1,949,647"
		},
		{
			href: "#influence",
			label: "Influence context",
			note: "Lobbying, donor, or disclosure context is attached below.",
			value: "1 notes"
		}
	]);

	const unavailableItems = buildPersonSummaryItems({
		dataThroughLabel: "March 31, 2026",
		formatCurrency: value => `$${value.toLocaleString("en-US")}`,
		fundingHref: "#funding",
		fundingStatusSummary: "No matched state finance source is configured for this jurisdiction.",
		hasFunding: false,
		hasInfluence: false,
		influenceHref: "#influence",
		influenceNoteCount: 0,
		influenceStatusSummary: "No matched state disclosure filings were found.",
		officeDisplayLabel: "Georgia State Senator for District 48",
		officeHref: "#office-context"
	});

	assert.equal(unavailableItems[1]?.href, "#funding");
	assert.equal(unavailableItems[1]?.value, "Unavailable");
	assert.equal(unavailableItems[1]?.note, "No matched state finance source is configured for this jurisdiction.");
	assert.equal(unavailableItems[2]?.href, "#influence");
	assert.equal(unavailableItems[2]?.value, "Unavailable");
	assert.equal(unavailableItems[2]?.note, "No matched state disclosure filings were found.");
});
