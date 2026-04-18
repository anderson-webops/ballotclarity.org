import type {
	EvidenceBlock,
	FreshnessMeta,
	NationwideLookupResultContext,
	PersonProfileResponse,
	Source,
	TrustBullet
} from "../types/civic";
import { buildDistrictRepresentativeAvailabilityNote } from "./district-availability";
import { buildNationwideDirectoryResponses } from "./nationwide-directory";
import { buildNationwideRepresentativeRouteAliases, buildNationwideRepresentativeSlug } from "./nationwide-slug";

const censusGeocoderDocsUrl = "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html";
const openStatesUrl = "https://openstates.org";

function buildFreshness(updatedAt: string): FreshnessMeta {
	return {
		contentLastVerifiedAt: updatedAt,
		dataLastUpdatedAt: updatedAt,
		nextReviewAt: updatedAt,
		status: "up-to-date",
		statusLabel: "Lookup-backed",
		statusNote: "This profile reflects the latest nationwide lookup currently saved in this browser. Verify critical details against the attached provider record and official election tools."
	};
}

function buildSource({
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

function buildTrustBullet(id: string, text: string, sources: Source[], note?: string): TrustBullet {
	return {
		id,
		note,
		sources,
		text
	};
}

export function buildNationwidePersonProfileResponse(
	context: NationwideLookupResultContext | null | undefined,
	representativeSlug: string
): PersonProfileResponse | null {
	if (!context || context.result !== "resolved")
		return null;

	const directoryBundle = buildNationwideDirectoryResponses(context);
	const representativeMatch = context.representativeMatches.find(match => buildNationwideRepresentativeRouteAliases(match).includes(representativeSlug)) ?? null;
	const representative = directoryBundle.representatives.representatives.find(item => item.slug === (representativeMatch ? buildNationwideRepresentativeSlug(representativeMatch) : representativeSlug));

	if (!representative)
		return null;

	const district = directoryBundle.districts.districts.find(item => item.slug === representative.districtSlug) ?? null;
	const updatedAt = directoryBundle.representatives.updatedAt;
	const officialSources = context.actions
		.filter(action => action.kind === "official-verification" && action.url)
		.map(action => buildSource({
			authority: "official-government",
			date: updatedAt,
			id: `official:${action.id}`,
			note: action.description,
			publisher: action.badge || "Official election tool",
			sourceSystem: "Official election verification",
			title: action.title,
			url: action.url as string
		}));
	const providerSources: Source[] = [
		buildSource({
			authority: representative.openstatesUrl ? "nonprofit-provider" : "open-data",
			date: updatedAt,
			id: `representative:${representative.slug}`,
			note: "Representative record carried into this page from the active nationwide lookup.",
			publisher: representative.openstatesUrl ? "Open States" : "Nationwide lookup provider",
			sourceSystem: representative.provenance?.label || "Nationwide lookup representative match",
			title: representative.name,
			url: representative.openstatesUrl || openStatesUrl
		})
	];

	if (district) {
		providerSources.push(buildSource({
			authority: "official-government",
			date: updatedAt,
			id: `district:${district.slug}`,
			note: "District geography attached from the active nationwide lookup.",
			publisher: "U.S. Census Geocoder",
			sourceSystem: "U.S. Census Geocoder",
			title: district.title,
			url: censusGeocoderDocsUrl
		}));
	}

	const sources = [...providerSources, ...officialSources];
	const districtAvailabilityNote = district
		? buildDistrictRepresentativeAvailabilityNote(district, 1)
		: "District context is attached from the active nationwide lookup when available.";
	const biography: EvidenceBlock[] = [
		{
			id: `provider:${representative.slug}`,
			sources,
			summary: representative.openstatesUrl
				? `${representative.name} is linked here through the active nationwide lookup and the matched provider-backed representative record.`
				: `${representative.name} is linked here through the active nationwide lookup.`,
			title: "Provider-backed office record"
		}
	];
	const whatWeKnow: TrustBullet[] = [
		buildTrustBullet("lookup-match", districtAvailabilityNote, sources),
		buildTrustBullet(
			"official-tools",
			context.actions.some(action => action.kind === "official-verification")
				? "Official election tools remain attached to the current lookup context for ballot confirmation, voter status, or polling-place verification."
				: "No official election tool links were attached to this lookup response.",
			sources
		)
	];
	const whatWeDoNotKnow: TrustBullet[] = [
		buildTrustBullet(
			"guide-status",
			"Candidate-field and ballot-comparison records are not attached to this person page. Finance and influence modules appear only when Ballot Clarity can verify a reliable person-level linkage for them.",
			sources
		),
		buildTrustBullet(
			"lookup-precision",
			context.inputKind === "zip"
				? "This record came from a ZIP-based lookup and should be treated as a likely match until verified against a full street address or official election tools."
				: "Provider-backed person matching can still be incomplete and should be verified against the linked provider record and official tools.",
			sources
		)
	];

	return {
		note: "Representative profile assembled from the active nationwide lookup context rather than a published local person record.",
		updatedAt,
		person: {
			ballotStatusLabel: "Published ballot status unavailable in this area",
			comparison: null,
			contestSlug: district?.slug || representative.districtSlug,
			districtLabel: representative.districtLabel,
			districtSlug: district?.slug || representative.districtSlug,
			freshness: buildFreshness(updatedAt),
			funding: null,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: representative.location,
			methodologyNotes: [
				"This page is generated from the active nationwide lookup and should not be mistaken for a published local person record.",
				"Provider-backed representative matches can be crosswalked or approximate, especially for ZIP-based lookups."
			],
			name: representative.name,
			officeholderLabel: representative.officeholderLabel,
			officeSought: representative.officeSought,
			onCurrentBallot: false,
			openstatesUrl: representative.openstatesUrl,
			party: representative.party,
			provenance: {
				asOf: updatedAt,
				label: representative.provenance?.label || "Nationwide lookup representative match",
				note: representative.provenance?.note || "Derived from the active nationwide lookup rather than a published local person record.",
				source: "lookup",
				status: representative.provenance?.status || "crosswalked"
			},
			publicStatements: [],
			slug: representative.slug,
			sourceCount: sources.length,
			sources,
			summary: representative.summary,
			topIssues: [],
			biography,
			updatedAt,
			whatWeDoNotKnow,
			whatWeKnow
		}
	};
}
