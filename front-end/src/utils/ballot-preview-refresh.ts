import type { NationwideLookupResultContext } from "../types/civic";

export function needsBallotPreviewRefresh(context: NationwideLookupResultContext | null | undefined) {
	return Boolean(context && !context.ballotContentPreviews?.length && context.availability?.ballotCandidates.status === "limited");
}

export function restoreMatchingBallotPreviews(
	context: NationwideLookupResultContext | null,
	refreshed: NationwideLookupResultContext | null,
) {
	if (!context || !refreshed || !needsBallotPreviewRefresh(context) || !refreshed.ballotContentPreviews?.length)
		return context;
	if (context.result !== "resolved" || refreshed.result !== "resolved" || !context.location || !refreshed.location)
		return context;
	if (context.location.state !== refreshed.location.state || context.location.slug !== refreshed.location.slug || context.inputKind !== refreshed.inputKind || context.selectionId !== refreshed.selectionId)
		return context;
	if (context.inputKind === "zip" && context.lookupQuery !== refreshed.lookupQuery)
		return context;
	const districts = (lookup: NationwideLookupResultContext) => lookup.districtMatches.map(match => `${match.districtType}:${match.districtCode}`).sort().join("|");
	if (districts(context) !== districts(refreshed))
		return context;
	return { ...context, ballotContentPreviews: refreshed.ballotContentPreviews };
}
