import type { LocationDistrictMatch, LocationRepresentativeMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/server.js";
import { listSupplementalOfficeholdersForDistrictMatches, mergeRepresentativeMatchesWithSupplementalRecords } from "../src/supplemental-officeholders.js";
import { createReviewedFixtureRepository } from "./helpers/reviewed-state-fixtures.js";

const districts: LocationDistrictMatch[] = [
	{ id: "congressional:3", districtType: "congressional", districtCode: "3", label: "Congressional 3", sourceSystem: "Controlled fixture" },
	{ id: "state-senate:24", districtType: "state-senate", districtCode: "24", label: "State Senate 24", sourceSystem: "Controlled fixture" },
	{ id: "state-house:44", districtType: "state-house", districtCode: "44", label: "State House 44", sourceSystem: "Controlled fixture" },
];

test("supplemental officials require the same state, not only a matching district number", () => {
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "OR"), []);
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "GA"), []);
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "CT"), []);
	const utah = listSupplementalOfficeholdersForDistrictMatches(districts, "UT");
	assert.equal(utah.filter(record => record.districtSlug === "state-senate-24").length, 1);
	assert.ok(utah.every(record => record.stateCode === "UT"));
});

test("supplemental matching stays unavailable without a usable explicit state", () => {
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, ""), []);
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "XX"), []);
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "Oregon"), []);
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "ut"), listSupplementalOfficeholdersForDistrictMatches(districts, "UT"));
	assert.deepEqual(listSupplementalOfficeholdersForDistrictMatches(districts, "Utah"), listSupplementalOfficeholdersForDistrictMatches(districts, "UT"));
});

test("state-scoped supplemental merging preserves provider matches without attaching another state's record", () => {
	const provider: LocationRepresentativeMatch = { id: "controlled:oregon", name: "Controlled Oregon Official", districtLabel: "State Senate 24", officeTitle: "State Senator", governmentLevel: null, officeDisplayLabel: "State Senator", officeType: null, sourceSystem: "Controlled fixture" };
	assert.deepEqual(mergeRepresentativeMatchesWithSupplementalRecords([provider], districts, "OR"), [provider]);
	assert.ok(mergeRepresentativeMatchesWithSupplementalRecords([], districts, "UT").some(match => match.id === "supplemental:keven-stratton"));
	assert.equal(mergeRepresentativeMatchesWithSupplementalRecords([], districts, "UT").find(match => match.id === "supplemental:keven-stratton")?.officialWebsiteUrl, undefined);
	assert.deepEqual(mergeRepresentativeMatchesWithSupplementalRecords([], districts, ""), []);
});

test("Oregon lookup, saved context and linked district/official directories never inherit Utah Senate 24", async (context) => {
	const app = await createApp({
		activeLookupCookieSecret: "synthetic-local-state-scope-cookie-secret-long-enough",
		adminMfaEncryptionKey: "synthetic-local-state-scope-mfa-key-long-enough",
		adminDbPath: ":memory:",
		congressClient: null,
		googleCivicClient: null,
		ldaClient: null,
		openFecClient: null,
		openStatesClient: null,
		stateBallotRepository: await createReviewedFixtureRepository(context, { now: () => Date.parse("2026-10-21T12:00:00Z"), fetchText: async () => { throw new Error("No external request"); } }),
		zipLookupLogger: { enabled: false, logPath: ":memory:", async record() {} },
		addressEnrichmentService: { async lookupAddress() {
			return { benchmark: "Public_AR_Current", countyFips: "051", districtMatches: districts, fromCache: false, latitude: 0, longitude: 0, normalizedAddress: "100 Controlled Review St, Portland, OR 97214", representativeMatches: [], state: "OR", vintage: "Current_Current", zip5: "97214" };
		} },
	});
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const base = `http://127.0.0.1:${address.port}`;
	try {
		const response = await fetch(`${base}/api/location`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "100 Controlled Review St, Portland, OR 97214" }) });
		assert.equal(response.status, 200);
		const lookup = await response.json();
		assert.deepEqual(lookup.representativeMatches, []);
		assert.equal(lookup.ballotContentPreviews[0].candidateCount, 12);
		const cookie = response.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
		const active = await (await fetch(`${base}/api/location/active`, { headers: { cookie } })).json();
		assert.deepEqual(active.representativeMatches, []);
		const district = await (await fetch(`${base}/api/districts/state-senate-24`, { headers: { cookie } })).json();
		assert.equal(district.mode, "nationwide");
		assert.deepEqual(district.representatives, []);
		const directory = await (await fetch(`${base}/api/representatives`, { headers: { cookie } })).json();
		assert.equal(directory.mode, "nationwide");
		assert.deepEqual(directory.representatives, []);
	}
	finally {
		await new Promise<void>(resolve => server.close(() => resolve()));
		await app.closeResources();
	}
});
