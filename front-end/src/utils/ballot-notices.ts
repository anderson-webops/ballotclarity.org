import type { BallotContentPreview, NationwideLookupResultContext } from "~/types/civic";

export const ballotInformationDisclaimer = "Not an official election website. Ballot information may be incomplete, inaccurate or out of date. Confirm your ballot with your election office.";

const genericMeasureCoverageNotes = new Set([
	"Selected local questions only; other races and ballot questions are not included.",
	"Statewide measures only; local candidates and measures are not included.",
	"Districtwide measures only; candidate races are not included."
]);

export function publicCoverageLimit(limits?: string[]) {
	return limits?.find(note => note.trim() && !genericMeasureCoverageNotes.has(note.trim()))?.trim() ?? "";
}

export function hasBallotInformation(context: Pick<NationwideLookupResultContext, "ballotContentPreviews" | "guideContent"> | null | undefined) {
	return Boolean(context?.guideContent?.verifiedContestPackage || context?.ballotContentPreviews?.some(preview => preview.contests.some(contest => contest.candidates.some(candidate => candidate.name.trim()) || (contest.referendum && (contest.referendum.title || contest.referendum.brief || contest.referendum.text || contest.referendum.responses.length)))));
}

export function ballotSourceNotes(previews: BallotContentPreview[]) {
	return [...new Set(previews.filter(preview => !preview.id.startsWith("ga-fulton-")).map(preview => preview.disclaimer
		.replace(/^Dated snapshot; later changes and local contests may be missing\.\s*/u, "")
		.replace(/^State records; local contests may be missing\.\s*/u, "")
		.trim()).filter(Boolean))];
}
