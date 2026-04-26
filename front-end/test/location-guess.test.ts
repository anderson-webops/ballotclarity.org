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
	assert.match(uiContent.home, /full street address/i);
	assert.doesNotMatch(uiContent.home, /manual lookup only/i);
	assert.match(uiContent.lookupForm, /full address or ZIP code/i);
	assert.doesNotMatch(uiContent.lookupForm, /manual lookup only/i);
	assert.match(uiContent.resultsEmpty, /enter an address or ZIP code/i);
	assert.match(uiContent.plan, /local guide/i);
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
	assert.match(uiContent.home, /approximate location guess/i);
	assert.match(uiContent.lookupForm, /replace it here/i);
	assert.match(uiContent.resultsEmpty, /saved results in this browser yet/i);
	assert.match(uiContent.plan, /local guide/i);
	assert.equal(buildHomeLocationGuessCopy(locationGuess), uiContent.home);
	assert.equal(buildLookupFormLocationGuessCopy(locationGuess), uiContent.lookupForm);
	assert.equal(buildResultsEmptyStateCopy(locationGuess), uiContent.resultsEmpty);
	assert.equal(buildPlanLocationGuessCopy(locationGuess), uiContent.plan);
});
