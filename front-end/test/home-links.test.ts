import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeNationwideSummaryHref } from "../src/utils/home-links.ts";

test("homepage area summary links keep the selected area result", () => {
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

test("homepage area summary links still work without a selected area result", () => {
	assert.equal(buildHomeNationwideSummaryHref("/districts", null), "/districts");
	assert.equal(buildHomeNationwideSummaryHref("/representatives", null), "/representatives");
});
