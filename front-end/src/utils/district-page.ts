import type {
	DistrictRecordResponse,
	DistrictSummary,
	LocationLookupAction,
	NationwideLookupResultContext,
	OfficialResource,
	Source
} from "../types/civic";
import { buildDistrictCandidateAvailabilityNote, buildDistrictRepresentativeAvailabilityNote, buildNationwideDistrictRoleGuide } from "./district-availability";
import { buildNationwideDirectoryResponses } from "./nationwide-directory";
import { toLookupSlug } from "./nationwide-slug";

const censusGeocoderDocsUrl = "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html";
const openStatesUrl = "https://openstates.org";

function toOfficialResource(action: LocationLookupAction): OfficialResource | null {
	if (action.kind !== "official-verification" || !action.url)
		return null;

	return {
		authority: "official-government",
		label: action.title,
		note: action.description,
		sourceLabel: action.badge || "Official election tool",
		sourceSystem: "Official election verification",
		url: action.url
	};
}

function toProviderSource({
	authority,
	date,
	id,
	note,
	publisher,
	sourceSystem,
	title,
	url
}: {
	authority: Source["authority"];
	date: string;
	id: string;
	note: string;
	publisher: string;
	sourceSystem: string;
	title: string;
	url: string;
}) {
	return {
		authority,
		date,
		id,
		note,
		publisher,
		sourceSystem,
		title,
		type: "official record",
		url
	} satisfies Source;
}

function buildNationwideSources(
	context: NationwideLookupResultContext,
	district: DistrictSummary,
	updatedAt: string
) {
	const directoryBundle = buildNationwideDirectoryResponses(context);
	const districtMatch = context.districtMatches.find((match) => {
		return match.id === district.slug || match.label === district.title;
	}) ?? context.districtMatches.find(match => match.label === district.title);
	const representativeMatches = context.representativeMatches.filter((match) => {
		return directoryBundle.representatives.representatives.some((representative) => {
			return representative.districtSlug === district.slug && representative.slug === toLookupSlug(match.id || match.name);
		});
	});
	const sources: Source[] = [];

	if (districtMatch) {
		sources.push(toProviderSource({
			authority: districtMatch.sourceSystem.toLowerCase().includes("census") ? "official-government" : "open-data",
			date: updatedAt,
			id: `district:${district.slug}:match`,
			note: `Provider-backed district match carried into this page from the active nationwide lookup.`,
			publisher: districtMatch.sourceSystem,
			sourceSystem: districtMatch.sourceSystem,
			title: `${district.title} district match`,
			url: districtMatch.sourceSystem.toLowerCase().includes("census") ? censusGeocoderDocsUrl : openStatesUrl
		}));
	}

	for (const representative of representativeMatches) {
		sources.push(toProviderSource({
			authority: representative.sourceSystem.toLowerCase().includes("open states") ? "nonprofit-provider" : "open-data",
			date: updatedAt,
			id: `representative:${representative.id}`,
			note: `Representative record linked to this district from the active nationwide lookup.`,
			publisher: representative.sourceSystem,
			sourceSystem: representative.sourceSystem,
			title: representative.name,
			url: representative.openstatesUrl || openStatesUrl
		}));
	}

	for (const action of context.actions.filter(item => item.kind === "official-verification" && item.url)) {
		sources.push(toProviderSource({
			authority: "official-government",
			date: updatedAt,
			id: `official:${action.id}`,
			note: action.description,
			publisher: action.badge || "Official election tool",
			sourceSystem: "Official election verification",
			title: action.title,
			url: action.url as string
		}));
	}

	return Array.from(new Map(sources.map(source => [source.id, source])).values());
}

export interface DistrictPageRecord extends DistrictRecordResponse {
	candidateAvailabilityNote: string;
	districtOriginLabel: string;
	districtOriginNote: string;
	mode: "guide" | "nationwide";
	officialResources: OfficialResource[];
	representativeAvailabilityNote: string;
}

export function buildGuideDistrictPageRecord(data: DistrictRecordResponse): DistrictPageRecord {
	return {
		...data,
		candidateAvailabilityNote: buildDistrictCandidateAvailabilityNote(data.candidates.length, true),
		districtOriginLabel: "Published district page",
		districtOriginNote: data.note,
		mode: "guide",
		officialResources: [],
		representativeAvailabilityNote: data.representatives.length
			? `${data.representatives.length} current officeholder${data.representatives.length === 1 ? "" : "s"} ${data.representatives.length === 1 ? "is" : "are"} attached to this published district page.`
			: "This published district page does not currently have an incumbent officeholder card attached."
	};
}

export function buildNationwideDistrictPageRecord(
	context: NationwideLookupResultContext | null | undefined,
	districtSlug: string
): DistrictPageRecord | null {
	if (!context || context.result !== "resolved")
		return null;

	const directoryBundle = buildNationwideDirectoryResponses(context);
	const district = directoryBundle.districts.districts.find(item => item.slug === districtSlug);

	if (!district)
		return null;

	const updatedAt = directoryBundle.districts.updatedAt;
	const representatives = directoryBundle.representatives.representatives.filter(item => item.districtSlug === district.slug);
	const hasPublishedGuide = context.guideAvailability === "published";
	const officialResources = context.actions
		.map(toOfficialResource)
		.filter((resource): resource is OfficialResource => Boolean(resource));

	return {
		candidates: [],
		candidateAvailabilityNote: buildDistrictCandidateAvailabilityNote(0, hasPublishedGuide),
		district: {
			...district,
			description: `${district.summary}. This district page is being rendered from the active nationwide lookup context rather than a published local guide.`,
			electionSlug: context.electionSlug || "",
			roleGuide: buildNationwideDistrictRoleGuide(district)
		},
		districtOriginLabel: "Nationwide lookup fallback",
		districtOriginNote: context.inputKind === "zip"
			? "This district page was assembled from the active ZIP-based nationwide lookup. District and representative matches can still be useful, but a full street address remains the stronger precision path when multiple local layers could overlap."
			: "This district page was assembled from the active nationwide lookup so the district hub does not dead-end when a published local guide is not available.",
		election: context.election ?? {
			date: updatedAt,
			jurisdictionSlug: "",
			locationName: context.location?.displayName || context.normalizedAddress || "Nationwide lookup",
			name: "Nationwide civic lookup context",
			slug: context.electionSlug || "nationwide-lookup",
			updatedAt
		},
		mode: "nationwide",
		note: "This district page is the nationwide-safe district detail fallback for the active lookup. It keeps district context, linked officials, provider provenance, and official election tools visible even when a published local guide is not available.",
		officialResources,
		relatedContests: [],
		representativeAvailabilityNote: buildDistrictRepresentativeAvailabilityNote(district, representatives.length),
		representatives,
		sources: buildNationwideSources(context, district, updatedAt),
		updatedAt
	};
}
