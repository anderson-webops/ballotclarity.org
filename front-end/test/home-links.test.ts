import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeNationwideSummaryHref } from "../src/utils/home-links.ts";

test("homepage nationwide summary links keep the active lookup context", () => {
	const context = {
		lookupQuery: "84604",
		selectionId: "zip:84604:provo-utah"
	};

	assert.equal(
		buildHomeNationwideSummaryHref("/districts", context),
		"/districts?lookup=84604&selection=zip%3A84604%3Aprovo-utah"
	);
	assert.equal(
		buildHomeNationwideSummaryHref("/representatives", context),
		"/representatives?lookup=84604&selection=zip%3A84604%3Aprovo-utah"
	);
});

test("homepage nationwide summary links still work without an active lookup context", () => {
	assert.equal(buildHomeNationwideSummaryHref("/districts", null), "/districts");
	assert.equal(buildHomeNationwideSummaryHref("/representatives", null), "/representatives");
});
