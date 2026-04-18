interface DistrictPageCandidateLinkTarget {
	slug: string;
}

interface DistrictPageRepresentativeLinkTarget {
	href: string;
}

export function buildDistrictCandidateSummaryHref(candidates: DistrictPageCandidateLinkTarget[]) {
	if (!candidates.length)
		return undefined;

	if (candidates.length === 1)
		return `/candidate/${candidates[0]!.slug}`;

	return "#candidates";
}

export function buildDistrictRepresentativeSummaryHref(representatives: DistrictPageRepresentativeLinkTarget[]) {
	if (!representatives.length)
		return undefined;

	if (representatives.length === 1)
		return representatives[0]!.href;

	return "#representatives";
}
