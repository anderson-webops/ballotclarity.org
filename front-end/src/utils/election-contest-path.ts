import type { Contest } from "../types/civic";

export function electionContestPath(contest: Pick<Contest, "slug" | "type" | "measures">, electionSlug: string) {
	if (contest.type === "measure" && contest.measures?.length === 1)
		return `/measure/${encodeURIComponent(contest.measures[0]!.slug)}?election=${encodeURIComponent(electionSlug)}`;
	return `/contest/${encodeURIComponent(contest.slug)}`;
}
