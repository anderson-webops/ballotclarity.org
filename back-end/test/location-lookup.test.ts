import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverageResponse } from "../src/launch-profile.js";
import { buildLocationLookupResponse, buildLocationLookupSlug } from "../src/location-lookup.js";

test("location lookup slugs are normalized in a single bounded pass", () => {
	assert.equal(buildLocationLookupSlug("Alpharetta, Georgia"), "alpharetta-georgia");
	assert.equal(buildLocationLookupSlug("  Fulton___County  "), "fulton-county");
	assert.equal(buildLocationLookupSlug("Québec / 123"), "qu-bec-123");
	assert.equal(buildLocationLookupSlug("---"), "");
	assert.equal(
		buildLocationLookupSlug(`${"A".repeat(300)}${"!".repeat(300)}B`),
		`${"a".repeat(300)}-b`,
	);
});

test("out-of-guide addresses retain a recognized state without putting the address in location labels", () => {
	const coverage = buildCoverageResponse("empty", "2026-10-21T00:00:00Z", { mode: "disabled", canGuessOnLoad: false });
	for (const [stateAbbreviation, stateName] of [["PA", "Pennsylvania"], ["WV", "West Virginia"]]) {
		const result = buildLocationLookupResponse("100 Controlled Review St", null, [], null, undefined, "empty", coverage, { stateAbbreviation });
		assert.equal(result.result, "resolved");
		assert.equal(result.guideAvailability, "not-published");
		assert.equal(result.electionSlug, undefined);
		assert.equal(result.location?.state, stateName);
		assert.equal(result.location?.displayName, stateName);
		assert.equal(result.location?.lookupMode, "address-submitted");
		assert.equal(result.location?.requiresOfficialConfirmation, true);
		assert.doesNotMatch(JSON.stringify(result.location), /100|Controlled|Review/iu);
	}
});

test("out-of-guide address state is never inferred from submitted text or an unknown provider code", () => {
	const coverage = buildCoverageResponse("empty", "2026-10-21T00:00:00Z", { mode: "disabled", canGuessOnLoad: false });
	for (const geoContext of [undefined, {}, { stateAbbreviation: "ZZ", stateName: "Pennsylvania" }]) {
		const result = buildLocationLookupResponse("100 Controlled Review St, Harrisburg, PA 17120", null, [], null, undefined, "empty", coverage, geoContext);
		assert.equal(result.location, undefined);
	}
});
