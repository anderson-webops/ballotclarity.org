import type { RepresentativeSummary } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepresentative } from "../src/utils/representative-classification.ts";

import {
	groupRepresentativeSummariesByGovernmentLevel,
	resolveRepresentativeContentSummary,
	resolveRepresentativePresentation,
} from "../src/utils/representative-presentation.ts";

test("countywide agency roles retain their sourced identity", () => {
	for (const officeTitle of ["Sheriff", "District Attorney", "Solicitor General", "Tax Commissioner"]) assert.equal(classifyRepresentative({ officeTitle, districtLabel: "Fulton County", districtType: "county", stateCode: "GA" }).officeDisplayLabel, `Fulton County ${officeTitle}`);
});

test("county commission labels distinguish members, chair and vice chair without repeating the district", () => {
	for (const [officeTitle, districtLabel, expected] of [["County Commission Chair", "Fulton County", "Fulton County Commission Chair"], ["County Commissioner, District 1", "Fulton County Commission District 1", "Fulton County Commissioner, District 1"], ["County Commission Vice Chair, District 6", "Fulton County Commission District 6", "Fulton County Commission Vice Chair, District 6"]]) {
		assert.equal(classifyRepresentative({ officeTitle, districtLabel, districtType: "county-commission", stateCode: "GA" }).officeDisplayLabel, expected);
	}
});

test("representative content summaries omit generated matching commentary", () => {
	for (const summary of ["Matched from Open States", "Matched from Congress.gov", "Matched from area results", "Matched from current area results", "  Matched from Open States  ", "", "  ", null, undefined])
		assert.equal(resolveRepresentativeContentSummary(summary), "");
});

test("representative content summaries preserve substantive descriptions", () => {
	assert.equal(resolveRepresentativeContentSummary("Serves in the U.S. Senate."), "Serves in the U.S. Senate.");
	assert.equal(resolveRepresentativeContentSummary("  Served two terms on the city council.  "), "Served two terms on the city council.");
});

const representatives: RepresentativeSummary[] = [
	{
		ballotStatusLabel: "Published ballot status unavailable in this area",
		districtLabel: "Georgia",
		districtSlug: "ga-sen-statewide",
		fundingAvailable: true,
		fundingSummary: "Attached",
		governmentLevel: "federal",
		href: "/representatives/jon-ossoff",
		incumbent: true,
		influenceAvailable: true,
		influenceSummary: "Attached",
		location: "Alpharetta, Georgia",
		name: "Jon Ossoff",
		officeDisplayLabel: "U.S. Senator for Georgia",
		officeholderLabel: "Current officeholder",
		officeSought: "U.S. Senate",
		officeType: "us_senate",
		onCurrentBallot: false,
		party: "Democratic",
		provenance: null,
		slug: "jon-ossoff",
		sourceCount: 0,
		sources: [],
		summary: "Federal officeholder",
		updatedAt: "2026-04-18T20:45:00.000Z",
	},
	{
		ballotStatusLabel: "Published ballot status unavailable in this area",
		districtLabel: "State House District 48",
		districtSlug: "state-house-48",
		fundingAvailable: false,
		fundingSummary: "Unavailable",
		governmentLevel: "state",
		href: "/representatives/scott-hilton",
		incumbent: true,
		influenceAvailable: false,
		influenceSummary: "Unavailable",
		location: "Alpharetta, Georgia",
		name: "Scott Hilton",
		officeDisplayLabel: "Georgia State Representative for District 48",
		officeholderLabel: "Current officeholder",
		officeSought: "State House District 48",
		officeType: "state_house",
		onCurrentBallot: false,
		party: "Republican",
		provenance: null,
		slug: "scott-hilton",
		sourceCount: 0,
		sources: [],
		summary: "State officeholder",
		updatedAt: "2026-04-18T20:45:00.000Z",
	},
	{
		ballotStatusLabel: "Published ballot status unavailable in this area",
		districtLabel: "Fulton County",
		districtSlug: "fulton-county",
		fundingAvailable: false,
		fundingSummary: "Unavailable",
		governmentLevel: "county",
		href: "/representatives/robb-pitts",
		incumbent: true,
		influenceAvailable: false,
		influenceSummary: "Unavailable",
		location: "Alpharetta, Georgia",
		name: "Robb Pitts",
		officeDisplayLabel: "Fulton County Commission Chair",
		officeholderLabel: "Current officeholder",
		officeSought: "County Commission Chair",
		officeType: "county_commission",
		onCurrentBallot: false,
		party: "Nonpartisan",
		provenance: null,
		slug: "robb-pitts",
		sourceCount: 0,
		sources: [],
		summary: "County officeholder",
		updatedAt: "2026-04-18T20:45:00.000Z",
	},
	{
		ballotStatusLabel: "Published ballot status unavailable in this area",
		districtLabel: "Johns Creek city",
		districtSlug: "johns-creek-city",
		fundingAvailable: false,
		fundingSummary: "Unavailable",
		governmentLevel: "city",
		href: "/representatives/john-bradberry",
		incumbent: true,
		influenceAvailable: false,
		influenceSummary: "Unavailable",
		location: "Alpharetta, Georgia",
		name: "John Bradberry",
		officeDisplayLabel: "Mayor of Johns Creek",
		officeholderLabel: "Current officeholder",
		officeSought: "Mayor",
		officeType: "mayor",
		onCurrentBallot: false,
		party: "Nonpartisan",
		provenance: null,
		slug: "john-bradberry",
		sourceCount: 0,
		sources: [],
		summary: "City officeholder",
		updatedAt: "2026-04-18T20:45:00.000Z",
	},
];

test("representative presentation groups directory cards by government level in scan order", () => {
	const groups = groupRepresentativeSummariesByGovernmentLevel(representatives, "Georgia");

	assert.deepEqual(groups.map(group => group.label), [
		"Federal officials",
		"State officials",
		"County officials",
		"City officials",
	]);
	assert.deepEqual(groups.map(group => group.representatives[0]?.name), [
		"Jon Ossoff",
		"Scott Hilton",
		"Robb Pitts",
		"John Bradberry",
	]);
});

test("representative presentation exposes human-readable level labels and normalized office copy", () => {
	assert.deepEqual(resolveRepresentativePresentation(representatives[0], "Georgia"), {
		governmentLevel: "federal",
		levelLabel: "Federal",
		officeDisplayLabel: "U.S. Senator for Georgia",
	});
	assert.deepEqual(resolveRepresentativePresentation(representatives[1], "Georgia"), {
		governmentLevel: "state",
		levelLabel: "State",
		officeDisplayLabel: "Georgia State Representative for District 48",
	});
	assert.deepEqual(resolveRepresentativePresentation(representatives[2], "Georgia"), {
		governmentLevel: "county",
		levelLabel: "County",
		officeDisplayLabel: "Fulton County Commission Chair",
	});
	assert.deepEqual(resolveRepresentativePresentation(representatives[3], "Georgia"), {
		governmentLevel: "city",
		levelLabel: "City",
		officeDisplayLabel: "Mayor of Johns Creek",
	});
});

test("representative presentation derives the correct state name from provider-style federal district labels", () => {
	assert.deepEqual(classifyRepresentative({
		districtLabel: "Senator Georgia",
		officeTitle: "Senator",
		stateName: "United States",
	}), {
		governmentLevel: "federal",
		officeDisplayLabel: "U.S. Senator for Georgia",
		officeType: "us_senate",
	});

	assert.deepEqual(classifyRepresentative({
		districtLabel: "Representative GA-7",
		officeTitle: "Representative",
		stateName: "United States",
	}), {
		governmentLevel: "federal",
		officeDisplayLabel: "U.S. Representative for Georgia's 7th Congressional District",
		officeType: "us_house",
	});
});
