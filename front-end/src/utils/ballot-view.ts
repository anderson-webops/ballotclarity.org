import type { BallotContentPreview, BallotContentPreviewCandidate, NationwideLookupResultContext } from "~/types/civic";
import { buildNationwideLookupRouteQuery } from "./nationwide-route-context";

type ElectionContext = Pick<NationwideLookupResultContext, "ballotContentPreviews" | "election" | "electionLogistics">;

export const ballotRecordStatusLabels: Record<string, string> = { "filed": "Filed", "qualified": "Qualified", "write-in": "Write-in", "withdrawn": "Withdrawn", "disqualified": "Disqualified", "defeated": "Defeated", "elected": "Elected", "unopposed": "Unopposed", "inactive": "Inactive" };

function electionDateTime(value: string | null | undefined) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
	const time = Date.parse(`${value}T00:00:00Z`);
	return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function electionHasPassed(value: string | null | undefined, now: Date) {
	const time = electionDateTime(value);
	return time !== null && now.getTime() >= time + 36 * 60 * 60 * 1000;
}

export function civicLookupNeedsRefresh(context: { resolvedAt?: string }, now: Date) {
	const capturedAt = Date.parse(context.resolvedAt ?? "");
	return !Number.isFinite(capturedAt) || now.getTime() - capturedAt > 86_400_000 || capturedAt > now.getTime();
}

export function buildElectionView(context: ElectionContext, now: Date, sourceDates: string[] = []) {
	const all = context.ballotContentPreviews ?? [];
	const previews = all.filter(preview => !electionHasPassed(preview.electionDate, now));
	const pastPreviews = all.filter(preview => electionHasPassed(preview.electionDate, now));
	const dates = [context.election?.date, context.electionLogistics?.electionDay, ...all.map(preview => preview.electionDate), ...sourceDates].filter((value): value is string => electionDateTime(value) !== null);
	const nearElection = dates.some(date => !electionHasPassed(date, now) && electionDateTime(date)! - now.getTime() <= 90 * 86_400_000);
	const betweenElections = dates.length > 0 && !nearElection && !previews.some(preview => electionDateTime(preview.electionDate) === null);
	return { previews, pastPreviews, betweenElections };
}

function validIdentifier(value: string) {
	return /^[\w:.-]{1,160}$/u.test(value) && value !== "." && value !== "..";
}

export function buildBallotCandidateTarget(preview: BallotContentPreview, candidate: BallotContentPreviewCandidate, context?: Pick<NationwideLookupResultContext, "lookupQuery" | "selectionId">) {
	if (!validIdentifier(preview.id) || !validIdentifier(candidate.id)) return null;
	const state = preview.sourceAuthority === "official-government" ? /^official-state-([a-z]{2})$/u.exec(preview.providerId)?.[1]?.toUpperCase() : null;
	if (state) return { path: `/record/${state}/${encodeURIComponent(candidate.id)}`, query: { ...buildNationwideLookupRouteQuery(context), source: preview.id, name: candidate.name } };
	return { path: `/ballot-record/${encodeURIComponent(preview.id)}/${encodeURIComponent(candidate.id)}`, query: { ...buildNationwideLookupRouteQuery(context) } };
}

export function findBallotCandidate(context: Pick<NationwideLookupResultContext, "ballotContentPreviews"> | null | undefined, sourceId: string, candidateId: string) {
	if (!validIdentifier(sourceId) || !validIdentifier(candidateId)) return null;
	const preview = context?.ballotContentPreviews?.find(item => item.id === sourceId);
	if (!preview) return null;
	const matches = preview.contests.flatMap(contest => contest.candidates.filter(candidate => candidate.id === candidateId).map(candidate => ({ candidate, contest, preview })));
	return matches.length === 1 ? matches[0]! : null;
}
