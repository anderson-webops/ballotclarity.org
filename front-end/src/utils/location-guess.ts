import type { LocationGuessCapability } from "../types/civic";

export interface LocationGuessUiContent {
	home: string;
	lookupForm: string;
	plan: string;
	resultsEmpty: string;
}

export interface ResolvedLocationGuessCapability {
	canGuessOnLoad: boolean;
	mode: LocationGuessCapability["mode"];
	uiContent: LocationGuessUiContent;
}

const automaticGuessUiContent: LocationGuessUiContent = {
	home: "Ballot Clarity can start with an approximate location guess. Enter a ZIP code for a broader preview, or use a full street address for the most precise match.",
	lookupForm: "Ballot Clarity can start with an approximate location guess, but you can replace it here at any time with a full address or ZIP code.",
	plan: "Ballot plan opens when a local guide is available for a ZIP code or full street address.",
	resultsEmpty: "Ballot Clarity does not have saved results in this browser yet. Return to the home page and enter an address or ZIP code to load them here."
};

const manualLookupUiContent: LocationGuessUiContent = {
	home: "Enter a ZIP code for a broader preview, or use a full street address for the most precise match.",
	lookupForm: "Enter a full address or ZIP code here to load civic results.",
	plan: "Ballot plan opens when a local guide is available for a ZIP code or full street address.",
	resultsEmpty: "Ballot Clarity does not have saved results in this browser yet. Return to the home page and enter an address or ZIP code to load them here."
};

export function resolveLocationGuessCapability(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
): ResolvedLocationGuessCapability {
	if (locationGuess?.canGuessOnLoad) {
		return {
			canGuessOnLoad: true,
			mode: locationGuess.mode,
			uiContent: automaticGuessUiContent
		};
	}

	return {
		canGuessOnLoad: false,
		mode: locationGuess?.mode ?? "disabled",
		uiContent: manualLookupUiContent
	};
}

export function canGuessLocationOnLoad(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
) {
	return resolveLocationGuessCapability(locationGuess).canGuessOnLoad;
}

export function buildLocationGuessUiContent(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
) {
	return resolveLocationGuessCapability(locationGuess).uiContent;
}

export function buildHomeLocationGuessCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
) {
	return buildLocationGuessUiContent(locationGuess).home;
}

export function buildLookupFormLocationGuessCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
) {
	return buildLocationGuessUiContent(locationGuess).lookupForm;
}

export function buildResultsEmptyStateCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
) {
	return buildLocationGuessUiContent(locationGuess).resultsEmpty;
}

export function buildPlanLocationGuessCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad" | "mode"> | null
) {
	return buildLocationGuessUiContent(locationGuess).plan;
}
