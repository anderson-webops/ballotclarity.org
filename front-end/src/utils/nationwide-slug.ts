import type { LocationRepresentativeMatch } from "~/types/civic";

export function toLookupSlug(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export function buildNationwideRepresentativeSlug(match: Pick<LocationRepresentativeMatch, "id" | "name">) {
	return toLookupSlug(match.name || match.id || "representative");
}

export function buildNationwideRepresentativeRouteAliases(match: Pick<LocationRepresentativeMatch, "id" | "name">) {
	return Array.from(new Set([
		buildNationwideRepresentativeSlug(match),
		toLookupSlug(match.id || match.name || "representative")
	]));
}
