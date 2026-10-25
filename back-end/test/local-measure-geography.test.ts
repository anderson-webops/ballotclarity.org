import type { JurisdictionSummary } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { findSupportedCoverageSummaries } from "../src/location-lookup.js";

const summaries: JurisdictionSummary[] = [
	{ slug: "winthrop", name: "Winthrop", displayName: "Winthrop, Maine", state: "Maine", jurisdictionType: "town", description: "", nextElectionName: "Local questions", nextElectionSlug: "winthrop-questions", updatedAt: "2026-10-23T00:00:00Z" },
	{ slug: "penobscot", name: "Penobscot County", displayName: "Penobscot County, Maine", state: "Maine", jurisdictionType: "county", description: "", nextElectionName: "County question", nextElectionSlug: "penobscot-question", updatedAt: "2026-10-23T00:00:00Z" }
];

test("local guides require the correct jurisdiction kind and an exact area match", () => {
	const matches = (countyName: string, locality: string) => findSupportedCoverageSummaries(summaries, { countyName, locality, stateAbbreviation: "ME", stateName: "Maine" }).map(summary => summary.slug);
	assert.deepEqual(matches("Kennebec", "Winthrop"), ["winthrop"]);
	assert.deepEqual(matches("Penobscot", "Orono"), ["penobscot"]);
	assert.deepEqual(matches("Winthrop", "Elsewhere"), []);
	assert.deepEqual(matches("South Penobscot", "Elsewhere"), []);
	assert.deepEqual(matches("Elsewhere", "Penobscot"), []);
	assert.deepEqual(matches("Kennebec", "North Winthrop"), []);
});

test("unknown local geography never selects the only guide in a state", () => {
	assert.deepEqual(findSupportedCoverageSummaries([summaries[0]!], { stateAbbreviation: "ME", stateName: "Maine" }), []);
	assert.deepEqual(findSupportedCoverageSummaries(summaries, { countyName: "Penobscot", locality: "Winthrop", stateAbbreviation: "ND", stateName: "North Dakota" }), []);
});

test("independent cities use county-equivalent geography without matching a neighboring county", () => {
	const city = { ...summaries[0]!, slug: "baltimore-city", name: "Baltimore City", displayName: "Baltimore City, Maryland", state: "Maryland", jurisdictionType: "independent-city" };
	const county = { ...city, slug: "baltimore-county", name: "Baltimore County", displayName: "Baltimore County, Maryland", jurisdictionType: "county" };
	const matches = (countyName?: string, locality?: string) => findSupportedCoverageSummaries([city, county], { countyName, locality, stateAbbreviation: "MD", stateName: "Maryland" }).map(summary => summary.slug);
	assert.deepEqual(matches("Baltimore city", "Baltimore"), ["baltimore-city"]);
	assert.deepEqual(matches("Baltimore County", "Towson"), ["baltimore-county"]);
	assert.deepEqual(matches("Baltimore County", "Baltimore"), ["baltimore-county"]);
	assert.deepEqual(matches(undefined, "Baltimore"), []);
	assert.deepEqual(matches("Elsewhere", "Baltimore City"), []);
	assert.deepEqual(matches("South Baltimore City", "Baltimore"), []);
});

test("existing capitalized county types and official name prefixes keep matching", () => {
	const fulton = { ...summaries[0]!, slug: "fulton", name: "Fulton County", displayName: "Fulton County, Georgia", state: "Georgia", jurisdictionType: "County" };
	assert.deepEqual(findSupportedCoverageSummaries([fulton], { countyName: "Fulton", locality: "Atlanta", stateAbbreviation: "GA", stateName: "Georgia" }), [fulton]);
	const winthrop = { ...summaries[0]!, name: "Town of Winthrop" };
	assert.deepEqual(findSupportedCoverageSummaries([winthrop], { countyName: "Kennebec", locality: "Winthrop", stateAbbreviation: "ME" }), [winthrop]);
});

test("meaningful place-name words and conflicting states cannot produce a local match", () => {
	const oldTown = { ...summaries[0]!, name: "Old Town", displayName: "Old Town, Maine" };
	assert.deepEqual(findSupportedCoverageSummaries([oldTown], { locality: "Old", stateAbbreviation: "ME" }), []);
	assert.deepEqual(findSupportedCoverageSummaries([oldTown], { locality: "Old Town", stateAbbreviation: "ME" }), [oldTown]);
	assert.deepEqual(findSupportedCoverageSummaries(summaries, { locality: "Winthrop", stateAbbreviation: "ND", stateName: "Maine" }), []);
	assert.deepEqual(findSupportedCoverageSummaries([{ ...summaries[0]!, jurisdictionType: "unknown" }], { locality: "Winthrop", stateAbbreviation: "ME" }), []);
});

test("postal locality and county names do not establish township, village or district eligibility", () => {
	for (const jurisdictionType of ["township", "Township", "village", "school-district", "School-District", "intermediate-school-district", "special-district"]) {
		const local = { ...summaries[0]!, slug: "mi-example-area", name: "Example", displayName: "Example, Michigan", state: "Michigan", jurisdictionType };
		const statewide = { ...local, slug: "mi-state", name: "Michigan", jurisdictionType: "state" };
		const county = { ...local, slug: "mi-example-county", name: "Example County", jurisdictionType: "county" };
		const matches = findSupportedCoverageSummaries([statewide, county, local], { countyName: "Example", locality: "Example", stateAbbreviation: "MI", stateName: "Michigan" });
		assert.deepEqual(matches.map(summary => summary.slug), [statewide.slug, county.slug], jurisdictionType);
	}
});

test("New York City guides match all five constituent counties, including neighborhood postal names", () => {
	const city = { ...summaries[0]!, slug: "ny-new-york-city", name: "New York City", displayName: "New York City, New York", state: "New York", jurisdictionType: "city" };
	for (const [countyName, locality] of [["Bronx County", "Bronx"], ["Kings County", "Brooklyn"], ["New York County", "New York"], ["Queens County", "Flushing"], ["Richmond County", "Staten Island"], ["Queens", "Jamaica"], ["County of Kings", "Brooklyn"]]) {
		assert.deepEqual(findSupportedCoverageSummaries([city], { countyName, locality, stateAbbreviation: "NY", stateName: "New York" }), [city]);
	}
	assert.deepEqual(findSupportedCoverageSummaries([city], { countyName: "Queens", stateAbbreviation: "NY" }), [city]);
	assert.deepEqual(findSupportedCoverageSummaries([{ ...city, jurisdictionType: "municipality" }], { countyName: "New York", stateAbbreviation: "NY" }).map(summary => summary.slug), [city.slug]);
});

test("New York City guides require same-state constituent-county evidence, not a city or ZIP guess", () => {
	const city = { ...summaries[0]!, slug: "ny-new-york-city", name: "New York City", displayName: "New York City, New York", state: "NY", jurisdictionType: "city" };
	for (const countyName of [undefined, "", "Nassau", "Westchester", "Monroe", "South Queens", "Kingsbury"]) {
		assert.deepEqual(findSupportedCoverageSummaries([city], { countyName, locality: "New York City", postalCode: "10001", stateAbbreviation: "NY" }), []);
	}
	assert.deepEqual(findSupportedCoverageSummaries([city], { countyName: "Kings", locality: "Brooklyn", stateAbbreviation: "NY", stateName: "New Jersey" }), []);
	assert.deepEqual(findSupportedCoverageSummaries([city], { countyName: "Richmond", locality: "New York City", stateAbbreviation: "VA" }), []);
	const county = { ...city, name: "New York County", displayName: "New York County, New York", jurisdictionType: "county" };
	assert.deepEqual(findSupportedCoverageSummaries([county], { countyName: "Queens", locality: "New York City", stateAbbreviation: "NY" }), []);
});
