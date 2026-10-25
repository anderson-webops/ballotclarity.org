import type { NationwideLookupResultContext } from "../types/civic";
import { buildElectionView, civicLookupNeedsRefresh, electionHasPassed } from "./ballot-view";

export function needsBallotPreviewRefresh(context: NationwideLookupResultContext | null | undefined, now = new Date()) {
	if (!context) return false;
	if (!context.ballotContentPreviews?.length && context.availability?.ballotCandidates.status === "limited") return true;
	const expired = buildElectionView(context, now).pastPreviews.length > 0 || electionHasPassed(context.election?.date, now);
	return (expired || Boolean(context.resolvedAt)) && civicLookupNeedsRefresh(context, now);
}

export function restoreMatchingBallotPreviews(
	context: NationwideLookupResultContext | null,
	refreshed: NationwideLookupResultContext | null,
	now = new Date(),
) {
	if (!context || !refreshed || !needsBallotPreviewRefresh(context, now))
		return context;
	const expired = buildElectionView(context, now).pastPreviews;
	if (context.result !== "resolved" || refreshed.result !== "resolved" || !context.location || !refreshed.location)
		return context;
	if (context.location.state !== refreshed.location.state || context.location.slug !== refreshed.location.slug || context.inputKind !== refreshed.inputKind || context.selectionId !== refreshed.selectionId)
		return context;
	if (context.inputKind === "zip" && context.lookupQuery !== refreshed.lookupQuery)
		return context;
	const districts = (lookup: NationwideLookupResultContext) => lookup.districtMatches.map(match => `${match.districtType}:${match.districtCode}`).sort().join("|");
	if (districts(context) !== districts(refreshed))
		return context;
	const current = refreshed.ballotContentPreviews ?? [];
	return { ...refreshed, ballotContentPreviews: [...current, ...expired.filter(previous => !current.some(preview => preview.id === previous.id))] };
}
