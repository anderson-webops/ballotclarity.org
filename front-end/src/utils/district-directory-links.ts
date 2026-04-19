import type { DistrictSummary, RepresentativeSummary } from "~/types/civic";

const externalHrefPattern = /^https?:\/\//;

export interface DistrictDirectoryRepresentativePopoverLink {
	external: boolean;
	href: string;
	name: string;
	officeDisplayLabel: string;
	party: string;
}

export function buildDistrictRepresentativeBadgeHref(
	representatives: RepresentativeSummary[],
	districtHref: string
) {
	if (!representatives.length)
		return undefined;

	if (representatives.length === 1)
		return representatives[0]?.href;

	return districtHref;
}

export function buildDistrictRepresentativePopoverLinks(
	representatives: RepresentativeSummary[]
): DistrictDirectoryRepresentativePopoverLink[] {
	return representatives
		.filter(representative => Boolean(representative.href))
		.map(representative => ({
			external: externalHrefPattern.test(representative.href),
			href: representative.href,
			name: representative.name,
			officeDisplayLabel: representative.officeDisplayLabel,
			party: representative.party
		}));
}

export function buildDistrictRepresentativeBadgeTitle(
	district: Pick<DistrictSummary, "title">,
	representatives: RepresentativeSummary[]
) {
	if (!representatives.length)
		return "";

	if (representatives.length === 1)
		return `Open ${representatives[0]?.name} for ${district.title}`;

	return `Open ${district.title} and review ${representatives.length} linked representatives`;
}
