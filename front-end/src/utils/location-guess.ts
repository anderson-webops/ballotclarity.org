import type { LocationGuessCapability } from "../types/civic";

function canGuessLocationOnLoad(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad"> | null
) {
	return Boolean(locationGuess?.canGuessOnLoad);
}

export function buildHomeLocationGuessCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad"> | null
) {
	if (canGuessLocationOnLoad(locationGuess))
		return "Ballot Clarity can make a best-effort location guess from your IP address on load. Enter a ZIP code to replace it with a broader nationwide preview, or use a full street address for the strongest district match.";

	return "This host is currently running manual lookup only. Enter a ZIP code for a broader nationwide preview, or use a full street address for the strongest district match.";
}

export function buildLookupFormLocationGuessCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad"> | null
) {
	if (canGuessLocationOnLoad(locationGuess))
		return "Ballot Clarity can make a best-effort location guess from your IP address on load, but you can replace that guess here at any time with a full address or ZIP code.";

	return "This host is currently using manual lookup only. Enter a full address or ZIP code here to load civic results.";
}

export function buildResultsEmptyStateCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad"> | null
) {
	if (canGuessLocationOnLoad(locationGuess))
		return "Ballot Clarity does not have an active nationwide lookup context in this browser yet. The automatic approximate location guess may have been unavailable for this request, so return to the home-page lookup and enter an address or ZIP code to load civic results here.";

	return "Ballot Clarity does not have an active nationwide lookup context in this browser yet. Automatic location guessing is not configured on this host right now, so return to the home-page lookup and enter an address or ZIP code to load civic results here.";
}

export function buildPlanLocationGuessCopy(
	locationGuess?: Pick<LocationGuessCapability, "canGuessOnLoad"> | null
) {
	if (canGuessLocationOnLoad(locationGuess))
		return "Ballot Clarity may start with a best-effort IP-based location guess, but the ballot plan still needs a published local guide confirmed from a ZIP code or full street address.";

	return "This host is currently using manual lookup only, and the ballot plan still needs a published local guide confirmed from a ZIP code or full street address.";
}
