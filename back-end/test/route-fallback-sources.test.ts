import type { ActiveNationwideLookupContext } from "../src/active-nationwide-lookup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { buildNationwideDistrictRecordResponse, buildNationwideDistrictRoleGuide, buildNationwideDistrictsResponse, buildNationwidePersonProfileResponse, buildRouteFallbackDistrictRecordResponse, buildRouteFallbackPersonProfileResponse } from "../src/active-nationwide-lookup.js";

test("fallback district pages do not cite their own availability as evidence", () => {
	for (const slug of ["county-033", "city-seattle", "congressional-7"]) {
		const response = buildRouteFallbackDistrictRecordResponse(slug);
		assert.deepEqual(response.sources, []);
		assert.deepEqual(response.representatives, []);
		assert.equal(response.district.description, "");
		assert.equal(response.district.summary, "");
		assert.equal(response.note, "");
		assert.doesNotMatch(JSON.stringify(response), /page availability|Ballot Clarity public records|\/coverage/u);
	}
});

test("fallback person pages do not invent sources or biography content", () => {
	const { person } = buildRouteFallbackPersonProfileResponse("example-person");
	assert.equal(person.sourceCount, 0);
	assert.deepEqual(person.sources, []);
	assert.deepEqual(person.biography, []);
	assert.deepEqual(person.whatWeKnow, []);
	assert.deepEqual(person.methodologyNotes, []);
	assert.doesNotMatch(JSON.stringify(person), /page availability|Public page identity|honest unavailable state/u);
});

test("lookup-backed districts retain genuine government evidence", () => {
	const context: ActiveNationwideLookupContext = {
		actions: [],
		detectedFromIp: false,
		districtMatches: [{ districtCode: "033", districtType: "county", id: "county:033", label: "King County", sourceSystem: "U.S. Census Geocoder" }],
		electionLogistics: null,
		guideAvailability: "not-published",
		inputKind: "zip",
		location: { coverageLabel: "Civic results available", displayName: "Seattle, Washington", lookupInput: "98101", lookupMode: "zip-preview", requiresOfficialConfirmation: true, slug: "seattle-wa", state: "WA" },
		normalizedAddress: "98101",
		representativeMatches: [],
		resolvedAt: "2026-10-24T12:00:00.000Z",
		result: "resolved",
	};
	const district = buildNationwideDistrictsResponse(context).districts[0];
	assert.ok(district);
	const response = buildNationwideDistrictRecordResponse(context, district.slug);
	assert.ok(response);
	assert.ok(response.sources.some(source => source.authority === "official-government" && source.url.startsWith("https://geocoding.geo.census.gov/")));
	assert.doesNotMatch(JSON.stringify(response.sources), /page availability|:fallback/u);
	const alias = buildNationwideDistrictRecordResponse(context, "county-033");
	assert.ok(alias);
	assert.equal(alias.district.slug, response.district.slug);
	assert.deepEqual(alias.sources, response.sources);
	assert.equal(buildNationwideDistrictRecordResponse(context, "county-999"), null);
	context.districtMatches.push({ id: "place:5363000", districtCode: "5363000", districtType: "Incorporated Place", label: "Seattle city", sourceSystem: "U.S. Census Geocoder" });
	context.representativeMatches.push({ id: "controlled-mayor", name: "Mayor Fixture", officeTitle: "Mayor", officeDisplayLabel: "Mayor", officeType: "mayor", governmentLevel: "city", districtLabel: "Seattle city", sourceSystem: "Open States", openstatesUrl: "https://openstates.org/person/mayor-fixture", party: "Example" });
	const place = buildNationwideDistrictRecordResponse(context, "place-5363000");
	assert.ok(place);
	assert.equal(place.district.title, "Seattle city");
	assert.equal(place.district.slug, "seattle-city");
	assert.equal(place.representatives[0]?.name, "Mayor Fixture");
	assert.equal(place.representatives[0]?.summary, "");
	assert.equal(buildNationwideDistrictRecordResponse(context, "place-0000000"), null);
	assert.ok(place.sources.every(source => !source.note));
	const profile = buildNationwidePersonProfileResponse(context, place.representatives[0]!.slug);
	assert.ok(profile);
	assert.equal(profile.person.name, "Mayor Fixture");
	assert.equal(profile.person.summary, "");
	assert.ok(profile.person.sources.some(source => source.publisher === "Open States" && source.url === "https://openstates.org/person/mayor-fixture"));
	assert.deepEqual(profile.person.biography, []);
	assert.deepEqual(profile.person.whatWeKnow, []);
	assert.deepEqual(profile.person.methodologyNotes, []);
	assert.equal(profile.person.whatWeDoNotKnow.length, 1);
	assert.match(profile.person.whatWeDoNotKnow[0]!.text, /ZIP-based lookup/u);
	assert.ok(profile.person.sources.length > 0);
	assert.ok(profile.person.sources.every(source => !source.note));
});

test("generated district responsibilities contain duties rather than lookup instructions", () => {
	assert.deepEqual(buildNationwideDistrictRoleGuide({ jurisdiction: "Local", office: "County", title: "County 033" }).decisionAreas, [
		"County administration and budgeting",
		"County services and local implementation",
	]);
	assert.deepEqual(buildNationwideDistrictRoleGuide({ jurisdiction: "Local", office: "City", title: "Seattle city" }).decisionAreas, ["City governance and municipal services"]);
	assert.deepEqual(buildNationwideDistrictRoleGuide({ jurisdiction: "Local", office: "Unknown", title: "District" }).decisionAreas, []);
	for (const jurisdiction of ["Federal", "State"] as const) {
		const guide = buildNationwideDistrictRoleGuide({ jurisdiction, office: "Legislature", title: "District 7" });
		assert.equal(guide.decisionAreas.length, 3);
		assert.doesNotMatch(guide.decisionAreas.join(" "), /verification|matching|discovery/u);
	}
});
