import assert from "node:assert/strict";
import test from "node:test";
import {
	buildHomeLocationGuessCopy,
	buildLocationGuessUiContent,
	buildLookupFormLocationGuessCopy,
	buildPlanLocationGuessCopy,
	buildResultsEmptyStateCopy,
	canGuessLocationOnLoad,
	resolveLocationGuessCapability
} from "../src/utils/location-guess.ts";

test("location-guess copy stays manual-only when automatic guessing is disabled", () => {
	const locationGuess = {
		canGuessOnLoad: false,
		mode: "disabled" as const
	};

	const resolvedCapability = resolveLocationGuessCapability(locationGuess);
	const uiContent = buildLocationGuessUiContent(locationGuess);

	assert.equal(canGuessLocationOnLoad(locationGuess), false);
	assert.equal(resolvedCapability.canGuessOnLoad, false);
	assert.equal(resolvedCapability.mode, "disabled");
	assert.match(uiContent.home, /manual lookup only/i);
	assert.doesNotMatch(uiContent.home, /IP address on load/i);
	assert.match(uiContent.lookupForm, /manual lookup only/i);
	assert.doesNotMatch(uiContent.lookupForm, /IP address on load/i);
	assert.match(uiContent.resultsEmpty, /not configured on this host/i);
	assert.match(uiContent.plan, /manual lookup only/i);
	assert.equal(buildHomeLocationGuessCopy(locationGuess), uiContent.home);
	assert.equal(buildLookupFormLocationGuessCopy(locationGuess), uiContent.lookupForm);
	assert.equal(buildResultsEmptyStateCopy(locationGuess), uiContent.resultsEmpty);
	assert.equal(buildPlanLocationGuessCopy(locationGuess), uiContent.plan);
});

test("location-guess copy explains the approximate IP-based path when automatic guessing is enabled", () => {
	const locationGuess = {
		canGuessOnLoad: true,
		mode: "proxy_headers" as const
	};

	const resolvedCapability = resolveLocationGuessCapability(locationGuess);
	const uiContent = buildLocationGuessUiContent(locationGuess);

	assert.equal(canGuessLocationOnLoad(locationGuess), true);
	assert.equal(resolvedCapability.canGuessOnLoad, true);
	assert.equal(resolvedCapability.mode, "proxy_headers");
	assert.match(uiContent.home, /IP address on load/i);
	assert.match(uiContent.lookupForm, /replace it here/i);
	assert.match(uiContent.resultsEmpty, /saved results in this browser yet/i);
	assert.match(uiContent.plan, /best-effort IP-based location guess/i);
	assert.equal(buildHomeLocationGuessCopy(locationGuess), uiContent.home);
	assert.equal(buildLookupFormLocationGuessCopy(locationGuess), uiContent.lookupForm);
	assert.equal(buildResultsEmptyStateCopy(locationGuess), uiContent.resultsEmpty);
	assert.equal(buildPlanLocationGuessCopy(locationGuess), uiContent.plan);
});
