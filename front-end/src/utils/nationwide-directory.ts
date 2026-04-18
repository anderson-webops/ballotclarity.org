import type {
	Contest,
	DistrictsResponse,
	DistrictSummary,
	LocationDistrictMatch,
	LocationRepresentativeMatch,
	NationwideLookupResultContext,
	RepresentativesResponse
} from "~/types/civic";

function toSlug(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function normalizeDistrictLabel(label: string) {
	return label.trim().toLowerCase();
}

function deriveNationwideDistrictJurisdiction(districtType: string): Contest["jurisdiction"] {
	const normalizedType = districtType.toLowerCase();

	if (normalizedType.includes("congress") || normalizedType.includes("federal"))
		return "Federal";

	if (normalizedType.includes("state"))
		return "State";

	return "Local";
}

function buildDistrictSummary(
	match: LocationDistrictMatch,
	updatedAt: string
) {
	const slug = toSlug(match.id || match.label);

	return {
		candidateCount: 0,
		href: `/districts/${slug}`,
		jurisdiction: deriveNationwideDistrictJurisdiction(match.districtType),
		office: match.districtType || "District",
		representativeCount: 0,
		slug,
		summary: `${match.sourceSystem ?? "Provider"} geographic match`,
		title: match.label,
		updatedAt
	} satisfies DistrictSummary;
}

function buildRepresentativeSummary(
	match: LocationRepresentativeMatch,
	updatedAt: string
) {
	return {
		incumbent: true,
		name: match.name,
		officeSought: match.officeTitle,
		party: match.party ?? "Unknown",
		slug: toSlug(match.id || match.name),
		summary: match.sourceSystem ? `Matched from ${match.sourceSystem}` : "Matched from nationwide lookup",
		districtLabel: match.districtLabel,
		districtSlug: toSlug(match.districtLabel),
		fundingSummary: "Not available from the nationwide lookup layer.",
		href: match.openstatesUrl ?? "/representatives",
		influenceSummary: "Not available from the nationwide lookup layer.",
		sourceCount: match.openstatesUrl ? 1 : 0,
		updatedAt
	} satisfies RepresentativesResponse["representatives"][number];
}

function buildNationwideDirectoryUpdatedAt() {
	return new Date().toISOString();
}

export interface NationwideDirectoryBundle {
	districts: DistrictsResponse;
	representatives: RepresentativesResponse;
}

export function buildNationwideDirectoryResponses(
	context: NationwideLookupResultContext | null | undefined
): NationwideDirectoryBundle {
	const updatedAt = buildNationwideDirectoryUpdatedAt();
	const districtMatches = context?.districtMatches ?? [];
	const representativeMatches = context?.representativeMatches ?? [];
	const districtBySlug = new Map<string, DistrictSummary>();
	const districtRepresentatives = new Map<string, string>();
	const normalizedDistrictToSlug = new Map<string, string>();

	for (const district of districtMatches) {
		const districtSummary = buildDistrictSummary(district, updatedAt);
		if (!districtBySlug.has(districtSummary.slug))
			districtBySlug.set(districtSummary.slug, districtSummary);

		normalizedDistrictToSlug.set(normalizeDistrictLabel(district.label), districtSummary.slug);
	}

	for (const representative of representativeMatches) {
		const normalizedDistrictLabel = normalizeDistrictLabel(representative.districtLabel);
		const districtSlug = normalizedDistrictToSlug.get(normalizedDistrictLabel) ?? toSlug(representative.districtLabel);
		const districtSummary = districtBySlug.get(districtSlug);

		if (districtSummary)
			districtSummary.representativeCount += 1;

		districtRepresentatives.set(representative.id, districtSlug);
	}

	const districts = Array.from(districtBySlug.values());
	const representatives = representativeMatches.map((representative) => {
		const summary = buildRepresentativeSummary(representative, updatedAt);
		const districtSlug = districtRepresentatives.get(representative.id) ?? toSlug(representative.districtLabel);

		return {
			...summary,
			districtSlug: districtSlug || summary.districtSlug
		};
	});

	return {
		districts: {
			updatedAt,
			note: "Derived from active nationwide lookup coverage.",
			districts
		},
		representatives: {
			districts,
			note: "Derived from active nationwide lookup coverage.",
			representatives,
			updatedAt
		}
	};
}
