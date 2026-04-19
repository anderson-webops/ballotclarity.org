import type { NationwideLookupResultContext } from "~/types/civic";
import { buildNationwideRouteTarget } from "./nationwide-route-context";

function buildLookupRouteCarrier(context: NationwideLookupResultContext | null | undefined) {
	return {
		lookupQuery: context?.lookupQuery,
		selectionId: context?.selectionId
	};
}

export function buildHomeNationwideSummaryHref(
	path: "/districts" | "/representatives",
	context: NationwideLookupResultContext | null | undefined
) {
	return buildNationwideRouteTarget(path, buildLookupRouteCarrier(context));
}
