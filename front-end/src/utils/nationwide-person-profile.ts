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
import { classifyRepresentative } from "./representative-classification";

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

	const classification = classifyRepresentative({
		districtLabel: representative.districtLabel,
		governmentLevel: representative.governmentLevel,
		officeSought: representative.officeDisplayLabel,
		officeTitle: representative.officeSought,
		officeType: representative.officeType,
		stateName: context.location?.state,
	});
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
			note: "Representative record matched from your saved lookup.",
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
			note: "District match attached from your saved lookup.",
			publisher: "U.S. Census Geocoder",
			sourceSystem: "U.S. Census Geocoder",
			title: district.title,
			url: censusGeocoderDocsUrl
		}));
	}

	const sources = [...providerSources, ...officialSources];
	const districtAvailabilityNote = district
		? buildDistrictRepresentativeAvailabilityNote(district, 1)
		: "District information is attached when available.";
	const biography: EvidenceBlock[] = [
		{
			id: `provider:${representative.slug}`,
			sources,
			summary: representative.openstatesUrl
				? `${representative.name} is listed here as a current official from your saved lookup.`
				: `${representative.name} is listed here from your saved lookup.`,
			title: "Office record"
		}
	];
	const whatWeKnow: TrustBullet[] = [
		buildTrustBullet("lookup-match", districtAvailabilityNote, sources),
		buildTrustBullet(
			"official-tools",
			context.actions.some(action => action.kind === "official-verification")
				? "Official election links are available for this area."
				: "No official election links were attached to this lookup.",
			sources
		)
	];
	const whatWeDoNotKnow: TrustBullet[] = [
		buildTrustBullet(
			"guide-status",
			"Candidate comparisons are not attached on this page. Funding and influence appear only when Ballot Clarity can match the person reliably.",
			sources
		),
		buildTrustBullet(
			"lookup-precision",
			context.inputKind === "zip"
				? "This came from a ZIP lookup, so confirm district details with a full street address or official tools."
				: "Check the linked official records if you need exact confirmation.",
			sources
		)
	];

	return {
		note: "Person page built from your saved lookup.",
		updatedAt,
		person: {
			ballotStatusLabel: "Published ballot status unavailable in this area",
			comparison: null,
			contestSlug: district?.slug || representative.districtSlug,
			districtLabel: representative.districtLabel,
			districtSlug: district?.slug || representative.districtSlug,
			freshness: buildFreshness(updatedAt),
			funding: null,
			governmentLevel: classification.governmentLevel,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: representative.location,
			methodologyNotes: [
				"This page is based on your saved lookup, not a published local guide.",
				"ZIP-based lookups can be broader than a full street-address match."
			],
			name: representative.name,
			officeDisplayLabel: classification.officeDisplayLabel,
			officeholderLabel: representative.officeholderLabel,
			officeType: classification.officeType,
			officeSought: representative.officeSought,
			onCurrentBallot: false,
			openstatesUrl: representative.openstatesUrl,
			party: representative.party,
			provenance: {
				asOf: updatedAt,
				label: representative.provenance?.label || "Nationwide lookup representative match",
				note: representative.provenance?.note || "Matched from your saved lookup.",
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
