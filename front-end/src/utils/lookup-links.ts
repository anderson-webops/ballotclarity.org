import type {
	LocationDistrictMatch,
	LocationRepresentativeMatch,
	NationwideLookupResultContext
} from "~/types/civic";
import { buildNationwideRouteTarget } from "./nationwide-route-context";
import { buildNationwideRepresentativeSlug, toLookupSlug } from "./nationwide-slug";

type LookupRouteCarrier = Pick<NationwideLookupResultContext, "lookupQuery" | "selectionId"> | null | undefined;

function buildLookupRouteCarrier(lookup: LookupRouteCarrier) {
	return {
		lookupQuery: lookup?.lookupQuery,
		selectionId: lookup?.selectionId
	};
}

export function buildNationwideDistrictHref(
	match: Pick<LocationDistrictMatch, "id" | "label">,
	lookup?: LookupRouteCarrier
) {
	return buildNationwideRouteTarget(
		`/districts/${toLookupSlug(match.id || match.label)}`,
		buildLookupRouteCarrier(lookup)
	);
}

export function buildNationwideRepresentativeHref(
	match: Pick<LocationRepresentativeMatch, "id" | "name">,
	lookup?: LookupRouteCarrier
) {
	return buildNationwideRouteTarget(
		`/representatives/${buildNationwideRepresentativeSlug(match)}`,
		buildLookupRouteCarrier(lookup)
	);
}
