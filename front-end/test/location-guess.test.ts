import assert from "node:assert/strict";
import test from "node:test";
import {
	buildHomeLocationGuessCopy,
	buildLookupFormLocationGuessCopy,
	buildPlanLocationGuessCopy,
	buildResultsEmptyStateCopy
} from "../src/utils/location-guess.ts";

test("location-guess copy stays manual-only when automatic guessing is disabled", () => {
	const locationGuess = {
		canGuessOnLoad: false,
		mode: "disabled" as const
	};

	assert.match(buildHomeLocationGuessCopy(locationGuess), /manual lookup only/i);
	assert.doesNotMatch(buildHomeLocationGuessCopy(locationGuess), /IP address on load/i);
	assert.match(buildLookupFormLocationGuessCopy(locationGuess), /manual lookup only/i);
	assert.doesNotMatch(buildLookupFormLocationGuessCopy(locationGuess), /IP address on load/i);
	assert.match(buildResultsEmptyStateCopy(locationGuess), /not configured on this host/i);
	assert.match(buildPlanLocationGuessCopy(locationGuess), /manual lookup only/i);
});

test("location-guess copy explains the approximate IP-based path when automatic guessing is enabled", () => {
	const locationGuess = {
		canGuessOnLoad: true,
		mode: "proxy_headers" as const
	};

	assert.match(buildHomeLocationGuessCopy(locationGuess), /IP address on load/i);
	assert.match(buildLookupFormLocationGuessCopy(locationGuess), /replace that guess/i);
	assert.match(buildResultsEmptyStateCopy(locationGuess), /approximate location guess/i);
	assert.match(buildPlanLocationGuessCopy(locationGuess), /best-effort IP-based location guess/i);
});
