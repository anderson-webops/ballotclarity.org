import assert from "node:assert/strict";
import test from "node:test";
import { buildActiveNationwideLookupCookieValue, parseActiveNationwideLookupCookie } from "../src/utils/active-nationwide-cookie.ts";

test("active nationwide lookup cookie parser accepts compact shell-only guide payloads", () => {
	const payload = {
		d: 0,
		dm: [
			["county:121", "Fulton County", "county", "121", "U.S. Census Geocoder"],
			["state-senate:048", "State Senate District 48", "state-senate", "048", "U.S. Census Geocoder"],
		],
		es: "2026-fulton-county-general",
		ga: "p",
		ik: "z",
		l: ["Fulton County, Georgia", "fulton-county-georgia", "Georgia", "zip-preview", 1],
		q: "30022",
		r: "resolved",
		rm: [
			[
				"ocd-person/314d7845-ba55-4bd4-809a-c7c7aea26690",
				"Shawn Still",
				"Senator 48",
				"Senator",
				"Republican",
				"state",
				"state_senate",
				"Georgia State Senator for District 48",
				"Open States",
				"https://openstates.org/person/shawn-still/",
				"https://www.legis.ga.gov/api/images/default-source/portraits/still-shawn-5016.jpg",
			],
		],
		t: "2026-04-26T20:00:00.000Z",
		v: 2,
	};
	const parsed = parseActiveNationwideLookupCookie(encodeURIComponent(JSON.stringify(payload)));

	assert.ok(parsed);
	assert.equal(parsed.guideAvailability, "published");
	assert.equal(parsed.lookupQuery, "30022");
	assert.equal(parsed.location?.displayName, "Fulton County, Georgia");
	assert.equal(parsed.districtMatches.length, 2);
	assert.equal(parsed.representativeMatches.length, 1);
	assert.equal(parsed.representativeMatches[0].name, "Shawn Still");
	assert.equal(parsed.representativeMatches[0].openstatesUrl, "https://openstates.org/person/shawn-still/");
	assert.equal(parsed.representativeMatches[0].officeDisplayLabel, "Georgia State Senator for District 48");
	assert.equal(parsed.representativeMatches[0].profileImages?.[0]?.url, "https://www.legis.ga.gov/api/images/default-source/portraits/still-shawn-5016.jpg");
});

test("active nationwide lookup cookie builder emits compact browser-safe payloads", () => {
	const cookieValue = buildActiveNationwideLookupCookieValue({
		actions: [
			{
				badge: "Official",
				description: "Official Utah voter portal for registration status, address updates, polling location lookup, and related voter tools.",
				id: "utah-voter-portal",
				kind: "official-verification",
				title: "Utah voter registration portal",
				url: "https://vote.utah.gov/"
			}
		],
		availability: null,
		detectedFromIp: false,
		districtMatches: [
			{
				districtCode: "049",
				districtType: "County",
				id: "utah-county",
				label: "Utah County",
				sourceSystem: "U.S. Census Geocoder"
			}
		],
		election: null,
		electionLogistics: null,
		fromCache: false,
		guideAvailability: "not-published",
		guideContent: null,
		inputKind: "zip",
		location: {
			displayName: "Provo, Utah",
			lookupMode: "zip-preview",
			requiresOfficialConfirmation: true,
			slug: "provo-utah",
			state: "Utah"
		},
		lookupQuery: "84604",
		normalizedAddress: "84604",
		note: "Saved lookup results are active in this browser.",
		representativeMatches: [
			{
				districtLabel: "Representative UT-03",
				governmentLevel: "federal",
				id: "ocd-person/mike-kennedy",
				name: "Mike Kennedy",
				officeDisplayLabel: "U.S. Representative for Utah's 3rd Congressional District",
				officeTitle: "Representative",
				officeType: "us_house",
				openstatesUrl: "https://openstates.org/person/mike-kennedy/",
				party: "Republican",
				profileImages: [
					{
						alt: "Portrait of Mike Kennedy",
						priority: 20,
						sourceKind: "provider",
						sourceLabel: "Open States image",
						sourceSystem: "Open States",
						url: "https://example.com/mike-kennedy.jpg"
					}
				],
				sourceSystem: "Open States"
			}
		],
		resolvedAt: "2026-04-26T20:00:00.000Z",
		result: "resolved",
		selectionOptions: []
	});
	const parsed = parseActiveNationwideLookupCookie(cookieValue);

	assert.ok(cookieValue.length < 1200);
	assert.ok(parsed);
	assert.equal(parsed.location?.displayName, "Provo, Utah");
	assert.equal(parsed.representativeMatches[0].name, "Mike Kennedy");
	assert.equal(parsed.representativeMatches[0].openstatesUrl, "https://openstates.org/person/mike-kennedy/");
	assert.equal(parsed.representativeMatches[0].profileImages?.[0]?.url, "https://example.com/mike-kennedy.jpg");
});
