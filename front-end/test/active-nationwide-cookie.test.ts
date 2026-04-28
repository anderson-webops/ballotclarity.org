import assert from "node:assert/strict";
import test from "node:test";
import { parseActiveNationwideLookupCookie } from "../src/utils/active-nationwide-cookie.ts";

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
	assert.equal(parsed.representativeMatches[0].officeDisplayLabel, "Georgia State Senator for District 48");
});
