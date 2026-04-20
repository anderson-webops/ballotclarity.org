import type { NationwideLookupResultContext } from "~/types/civic";
import { buildNationwideRouteTarget } from "./nationwide-route-context";

type ResultsSummaryContext = Pick<
	NationwideLookupResultContext,
	"districtMatches" | "guideAvailability" | "lookupQuery" | "representativeMatches" | "selectionId"
> | null | undefined;

export interface ResultsSummaryItem {
	href?: string;
	label: string;
	note: string;
	value: string | number;
}

export function buildResultsSummaryItems(
	activeResult: ResultsSummaryContext,
	officialToolCount: number,
	routeQuery?: Record<string, unknown> | null
): ResultsSummaryItem[] {
	const lookupContext = activeResult
		? {
				lookupQuery: activeResult.lookupQuery,
				selectionId: activeResult.selectionId
			}
		: null;

	return [
		{
			href: buildNationwideRouteTarget("/districts", lookupContext, routeQuery),
			label: "District matches",
			note: "Matched from your current lookup.",
			value: activeResult?.districtMatches.length ?? 0
		},
		{
			href: buildNationwideRouteTarget("/representatives", lookupContext, routeQuery),
			label: "Representatives",
			note: "Current representative records linked below when available.",
			value: activeResult?.representativeMatches.length ?? 0
		},
		{
			label: "Official tools",
			note: "State and county election links for this area.",
			value: officialToolCount
		},
		{
			label: "Guide status",
			note: "Detailed ballot pages open when a local guide is published.",
			value: activeResult?.guideAvailability === "published" ? "Published" : "Not published"
		}
	];
}
