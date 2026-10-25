import type { ActiveNationwideLookupContext } from "../src/active-nationwide-lookup.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
	activeNationwideLookupCookieName,
	buildActiveNationwideLookupCookieFromContext,
	readActiveNationwideLookupContext
} from "../src/active-nationwide-lookup.js";

const secret = "test-active-lookup-secret-with-enough-length";

function buildContext(updatedAt?: string): ActiveNationwideLookupContext {
	return {
		actions: [],
		detectedFromIp: false,
		districtMatches: [],
		electionLogistics: null,
		guideAvailability: "not-published",
		inputKind: "zip",
		location: null,
		normalizedAddress: "84604",
		representativeMatches: [
			{
				districtLabel: "Utah House District 60",
				governmentLevel: "state",
				id: "ocd-person/test-representative",
				name: "Test Representative",
				officeDisplayLabel: "State Representative",
				officeTitle: "Representative",
				officeType: "state_house",
				openstatesUrl: "https://openstates.org/person/test-representative/",
				sourceSystem: "Open States",
				updatedAt
			}
		],
		resolvedAt: "2026-10-20T15:00:00.000Z",
		result: "resolved"
	};
}

function roundTrip(context: ActiveNationwideLookupContext) {
	const cookie = buildActiveNationwideLookupCookieFromContext(context, secret);
	assert.ok(cookie);
	return readActiveNationwideLookupContext(`${activeNationwideLookupCookieName}=${encodeURIComponent(cookie)}`, secret);
}

test("cached lookups keep the provider's record date, not the lookup time", () => {
	const restored = roundTrip(buildContext("2026-03-14T08:30:00.000Z"));

	assert.equal(restored?.representativeMatches[0]?.updatedAt, "2026-03-14");
});

test("cached lookups drop missing or malformed provider dates", () => {
	assert.equal(roundTrip(buildContext())?.representativeMatches[0]?.updatedAt, undefined);
	assert.equal(roundTrip(buildContext("not-a-date"))?.representativeMatches[0]?.updatedAt, undefined);
});

test("cached representative websites and portraits survive navigation safely", () => {
	const context = buildContext();
	context.representativeMatches[0]!.officialWebsiteUrl = "https://example.org/representative";
	context.representativeMatches[0]!.profileImages = [{ url: "https://example.org/portrait.jpg", alt: "Alex Example", priority: 20, sourceKind: "official", sourceLabel: "Official portrait", sourceSystem: "Official office" }];
	const restored = roundTrip(context);
	assert.equal(restored?.representativeMatches[0]?.officialWebsiteUrl, "https://example.org/representative");
	assert.equal(restored?.representativeMatches[0]?.profileImages?.[0]?.url, "https://example.org/portrait.jpg");
	context.representativeMatches[0]!.officialWebsiteUrl = "javascript:alert(1)";
	assert.equal(roundTrip(context)?.representativeMatches[0]?.officialWebsiteUrl, undefined);
});
