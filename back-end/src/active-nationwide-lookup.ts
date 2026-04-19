import type {
	DistrictRecordResponse,
	DistrictsResponse,
	ElectionSummary,
	LocationDistrictMatch,
	LocationLookupAction,
	LocationLookupResponse,
	LocationRepresentativeMatch,
	LocationSelection,
	OfficialResource,
	PersonProfileResponse,
	RepresentativesResponse,
	RepresentativeSummary,
	Source,
	TrustBullet,
} from "./types/civic.js";
import { classifyRepresentative } from "./representative-classification.js";

export interface ActiveNationwideLookupContext {
	actions: LocationLookupAction[];
	detectedFromIp: boolean;
	districtMatches: LocationDistrictMatch[];
	electionSlug?: string;
	guideAvailability: "not-published";
	inputKind: "address" | "zip";
	location: LocationSelection | null;
	normalizedAddress: string;
	representativeMatches: LocationRepresentativeMatch[];
	selectionId?: string;
	resolvedAt: string;
	result: "resolved";
}

export const activeNationwideLookupCookieName = "ballot-clarity-nationwide-lookup";
const cookieMaxAgeSeconds = 60 * 60 * 24 * 7;
const censusGeocoderDocsUrl = "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html";
const openStatesUrl = "https://openstates.org";

type DistrictScope = "city" | "county" | "federal-house" | "label" | "state-house" | "state-senate";
type DistrictDescriptor = Pick<DistrictsResponse["districts"][number], "jurisdiction" | "office" | "title">;
const numericDistrictCodePattern = /\d+/;
const congressionalSlugPrefixPattern = /^congressional-/u;
const representativeStateDistrictPattern = /\b[A-Z]{2}\s*-\s*\d+\b/i;
const senatorPrefixPattern = /^senator-/u;
const stateDistrictCodePattern = /\b[A-Z]{2}\s*-\s*(\d+)\b/i;
const stateHouseSlugPrefixPattern = /^state-house-/u;
const stateSenateSlugPrefixPattern = /^state-senate-/u;
const representativePrefixPattern = /^representative-/u;

function normalizeValue(value: string | null | undefined) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toLookupSlug(value: string) {
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

function buildNationwideRepresentativeRouteAliases(match: Pick<LocationRepresentativeMatch, "id" | "name">) {
	return Array.from(new Set([
		buildNationwideRepresentativeSlug(match),
		toLookupSlug(match.id || match.name || "representative"),
	]));
}

function titleCaseToken(value: string) {
	return value
		.split("-")
		.filter(Boolean)
		.map((segment) => {
			if (segment.length <= 2)
				return segment.toUpperCase();

			if (segment.startsWith("mc") && segment.length > 2)
				return `Mc${segment.charAt(2).toUpperCase()}${segment.slice(3)}`;

			return segment.charAt(0).toUpperCase() + segment.slice(1);
		})
		.join(" ");
}

function inferDistrictTitleFromSlug(slug: string) {
	const normalizedSlug = toLookupSlug(slug);

	if (normalizedSlug.startsWith("congressional-"))
		return `Congressional District ${normalizedSlug.replace(congressionalSlugPrefixPattern, "")}`;

	if (normalizedSlug.startsWith("state-senate-"))
		return `State Senate District ${normalizedSlug.replace(stateSenateSlugPrefixPattern, "")}`;

	if (normalizedSlug.startsWith("state-house-"))
		return `State House District ${normalizedSlug.replace(stateHouseSlugPrefixPattern, "")}`;

	if (normalizedSlug.endsWith("-county"))
		return titleCaseToken(normalizedSlug);

	if (normalizedSlug.endsWith("-city"))
		return titleCaseToken(normalizedSlug);

	return titleCaseToken(normalizedSlug);
}

function inferRepresentativeNameFromSlug(slug: string) {
	return titleCaseToken(toLookupSlug(slug));
}

function parseCookieHeader(cookieHeader: string | undefined) {
	return Object.fromEntries(
		String(cookieHeader || "")
			.split(";")
			.map(item => item.trim())
			.filter(Boolean)
			.map((item) => {
				const separatorIndex = item.indexOf("=");

				if (separatorIndex === -1)
					return [item, ""];

				return [item.slice(0, separatorIndex), item.slice(separatorIndex + 1)];
			})
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function isPresent<T>(value: T | null): value is T {
	return value !== null;
}

function sanitizeLocationSelection(value: unknown): LocationSelection | null {
	if (!isRecord(value))
		return null;

	const displayName = typeof value.displayName === "string" ? value.displayName : "";
	const slug = typeof value.slug === "string" ? value.slug : "";
	const state = typeof value.state === "string" ? value.state : "";

	if (!displayName || !slug || !state)
		return null;

	return {
		coverageLabel: typeof value.coverageLabel === "string" ? value.coverageLabel : "",
		displayName,
		lookupInput: typeof value.lookupInput === "string" ? value.lookupInput : undefined,
		lookupMode: value.lookupMode === "address-submitted" || value.lookupMode === "address-verified" || value.lookupMode === "coverage-selection" || value.lookupMode === "zip-preview"
			? value.lookupMode
			: undefined,
		requiresOfficialConfirmation: value.requiresOfficialConfirmation === true,
		slug,
		state,
	};
}

function sanitizeDistrictMatch(value: unknown): LocationDistrictMatch | null {
	if (!isRecord(value))
		return null;

	const districtCode = typeof value.districtCode === "string" ? value.districtCode : "";
	const districtType = typeof value.districtType === "string" ? value.districtType : "";
	const id = typeof value.id === "string" ? value.id : "";
	const label = typeof value.label === "string" ? value.label : "";
	const sourceSystem = typeof value.sourceSystem === "string" ? value.sourceSystem : "";

	if (!districtCode || !districtType || !id || !label || !sourceSystem)
		return null;

	return {
		districtCode,
		districtType,
		id,
		label,
		sourceSystem,
	};
}

function sanitizeRepresentativeMatch(value: unknown): LocationRepresentativeMatch | null {
	if (!isRecord(value))
		return null;

	const districtLabel = typeof value.districtLabel === "string" ? value.districtLabel : "";
	const id = typeof value.id === "string" ? value.id : "";
	const name = typeof value.name === "string" ? value.name : "";
	const officeTitle = typeof value.officeTitle === "string" ? value.officeTitle : "";
	const sourceSystem = typeof value.sourceSystem === "string" ? value.sourceSystem : "";

	if (!districtLabel || !id || !name || !officeTitle || !sourceSystem)
		return null;

	const classification = classifyRepresentative({
		districtLabel,
		governmentLevel: value.governmentLevel === "federal" || value.governmentLevel === "state" || value.governmentLevel === "county" || value.governmentLevel === "city"
			? value.governmentLevel
			: null,
		officeSought: typeof value.officeDisplayLabel === "string" ? value.officeDisplayLabel : undefined,
		officeTitle,
		officeType: value.officeType === "us_senate"
			|| value.officeType === "us_house"
			|| value.officeType === "state_senate"
			|| value.officeType === "state_house"
			|| value.officeType === "county_commission"
			|| value.officeType === "county_official"
			|| value.officeType === "city_official"
			|| value.officeType === "mayor"
			|| value.officeType === "other"
			? value.officeType
			: null,
	});

	return {
		districtLabel,
		governmentLevel: classification.governmentLevel,
		id,
		name,
		officeDisplayLabel: typeof value.officeDisplayLabel === "string" && value.officeDisplayLabel
			? value.officeDisplayLabel
			: classification.officeDisplayLabel,
		officeType: classification.officeType,
		officeTitle,
		openstatesUrl: typeof value.openstatesUrl === "string" ? value.openstatesUrl : undefined,
		party: typeof value.party === "string" ? value.party : undefined,
		sourceSystem,
	};
}

function sanitizeLookupAction(value: unknown): LocationLookupAction | null {
	if (!isRecord(value))
		return null;

	const id = typeof value.id === "string" ? value.id : "";
	const kind = value.kind === "ballot-guide" || value.kind === "official-verification" ? value.kind : null;
	const title = typeof value.title === "string" ? value.title : "";
	const description = typeof value.description === "string" ? value.description : "";

	if (!id || !kind || !title || !description)
		return null;

	return {
		badge: typeof value.badge === "string" ? value.badge : undefined,
		description,
		electionSlug: typeof value.electionSlug === "string" ? value.electionSlug : undefined,
		id,
		kind,
		location: sanitizeLocationSelection(value.location) ?? undefined,
		title,
		url: typeof value.url === "string" ? value.url : undefined,
	};
}

function sanitizeActiveNationwideLookupContext(value: unknown): ActiveNationwideLookupContext | null {
	if (!isRecord(value) || value.result !== "resolved" || value.guideAvailability !== "not-published")
		return null;

	const districtMatches = Array.isArray(value.districtMatches)
		? value.districtMatches.map(sanitizeDistrictMatch).filter((item): item is LocationDistrictMatch => Boolean(item))
		: [];
	const representativeMatches = Array.isArray(value.representativeMatches)
		? value.representativeMatches.map(sanitizeRepresentativeMatch).filter((item): item is LocationRepresentativeMatch => Boolean(item))
		: [];

	if (!districtMatches.length && !representativeMatches.length)
		return null;

	return {
		actions: Array.isArray(value.actions)
			? value.actions.map(sanitizeLookupAction).filter((item): item is LocationLookupAction => Boolean(item))
			: [],
		detectedFromIp: value.detectedFromIp === true,
		districtMatches,
		electionSlug: typeof value.electionSlug === "string" ? value.electionSlug : undefined,
		guideAvailability: "not-published",
		inputKind: value.inputKind === "address" ? "address" : "zip",
		location: sanitizeLocationSelection(value.location),
		normalizedAddress: typeof value.normalizedAddress === "string" ? value.normalizedAddress : "",
		representativeMatches,
		selectionId: typeof value.selectionId === "string" ? value.selectionId : undefined,
		resolvedAt: typeof value.resolvedAt === "string" && value.resolvedAt
			? value.resolvedAt
			: new Date().toISOString(),
		result: "resolved",
	};
}

function buildCookiePayload(context: ActiveNationwideLookupContext) {
	return {
		actions: context.actions
			.filter(action => action.kind === "official-verification")
			.map(action => ({
				badge: action.badge,
				description: action.description,
				id: action.id,
				kind: action.kind,
				title: action.title,
				url: action.url,
			})),
		detectedFromIp: context.detectedFromIp,
		districtMatches: context.districtMatches,
		electionSlug: context.electionSlug,
		guideAvailability: context.guideAvailability,
		inputKind: context.inputKind,
		location: context.location,
		normalizedAddress: context.normalizedAddress,
		representativeMatches: context.representativeMatches,
		selectionId: context.selectionId,
		resolvedAt: context.resolvedAt,
		result: context.result,
	};
}

function normalizeDistrictCode(value: string | null | undefined) {
	const rawValue = String(value ?? "").trim();

	if (!rawValue)
		return "";

	const stateDistrictMatch = rawValue.match(stateDistrictCodePattern);

	if (stateDistrictMatch?.[1])
		return String(Number.parseInt(stateDistrictMatch[1], 10));

	const numericMatch = rawValue.match(numericDistrictCodePattern);

	if (numericMatch?.[0])
		return String(Number.parseInt(numericMatch[0], 10));

	return normalizeValue(rawValue);
}

function buildLabelFallbackKey(label: string, locationState: string | undefined) {
	return `label:${normalizeValue(locationState) || "unknown"}:${normalizeValue(label)}`;
}

function buildCanonicalKey(scope: DistrictScope, districtCode: string, locationState: string | undefined, label: string) {
	return `${scope}:${normalizeValue(locationState) || "unknown"}:${districtCode || normalizeValue(label)}`;
}

function deriveDistrictScopeFromMatch(match: LocationDistrictMatch): DistrictScope {
	const normalizedType = normalizeValue(match.districtType);
	const normalizedLabel = normalizeValue(match.label);

	if (normalizedType.includes("congress"))
		return "federal-house";

	if (normalizedType.includes("state-senate"))
		return "state-senate";

	if (normalizedType.includes("state-house") || normalizedType.includes("state-assembly"))
		return "state-house";

	if (normalizedType.includes("county") || normalizedLabel.includes("county"))
		return "county";

	if (normalizedType.includes("city") || normalizedLabel.endsWith("-city"))
		return "city";

	return "label";
}

function buildDistrictSlugFromMatch(match: LocationDistrictMatch) {
	const scope = deriveDistrictScopeFromMatch(match);
	const districtCode = normalizeDistrictCode(match.districtCode || match.label);

	if (scope === "federal-house" && districtCode)
		return `congressional-${districtCode}`;

	if (scope === "state-senate" && districtCode)
		return `state-senate-${districtCode}`;

	if (scope === "state-house" && districtCode)
		return `state-house-${districtCode}`;

	return toLookupSlug(match.label);
}

function deriveRepresentativeScope(match: LocationRepresentativeMatch, locationState: string | undefined): DistrictScope {
	const normalizedOfficeTitle = normalizeValue(match.officeTitle);
	const normalizedDistrictLabel = normalizeValue(match.districtLabel);
	const normalizedState = normalizeValue(locationState);
	const strippedDistrictLabel = normalizedDistrictLabel
		.replace(senatorPrefixPattern, "")
		.replace(representativePrefixPattern, "");

	if (normalizedDistrictLabel.includes("congress"))
		return "federal-house";

	if (normalizedOfficeTitle.includes("representative")) {
		if (representativeStateDistrictPattern.test(match.districtLabel))
			return "federal-house";

		return "state-house";
	}

	if (normalizedOfficeTitle.includes("senator")) {
		if (normalizedState && (strippedDistrictLabel === normalizedState || strippedDistrictLabel === `${normalizedState}-statewide`))
			return "label";

		return "state-senate";
	}

	if (normalizedDistrictLabel.includes("county"))
		return "county";

	if (normalizedDistrictLabel.endsWith("-city"))
		return "city";

	return "label";
}

function buildDistrictMatchKeys(match: LocationDistrictMatch, locationState: string | undefined) {
	const scope = deriveDistrictScopeFromMatch(match);
	const districtCode = normalizeDistrictCode(match.districtCode || match.label);

	return [
		buildCanonicalKey(scope, districtCode, locationState, match.label),
		buildLabelFallbackKey(match.label, locationState),
	];
}

function buildRepresentativeMatchKeys(match: LocationRepresentativeMatch, locationState: string | undefined) {
	const scope = deriveRepresentativeScope(match, locationState);
	const districtCode = normalizeDistrictCode(match.districtLabel);
	const keys = new Set<string>([
		buildLabelFallbackKey(match.districtLabel, locationState),
	]);

	keys.add(buildCanonicalKey(scope, districtCode, locationState, match.districtLabel));

	return [...keys];
}

function buildOfficialResource(action: LocationLookupAction): OfficialResource | null {
	if (action.kind !== "official-verification" || !action.url)
		return null;

	return {
		authority: "official-government",
		label: action.title,
		note: action.description,
		sourceLabel: action.badge || "Official election tool",
		sourceSystem: "Official election verification",
		url: action.url,
	};
}

function toSource({
	authority,
	date,
	id,
	note,
	publisher,
	sourceSystem,
	title,
	url,
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
		url,
	} satisfies Source;
}

function buildTrustBullet(id: string, text: string, sources: Source[], note?: string): TrustBullet {
	return {
		id,
		note,
		sources,
		text,
	};
}

function deriveNationwideDistrictJurisdiction(districtType: string): "Federal" | "Local" | "State" {
	const normalizedType = districtType.toLowerCase();

	if (normalizedType.includes("congress") || normalizedType.includes("federal"))
		return "Federal";

	if (normalizedType.includes("state"))
		return "State";

	return "Local";
}

function deriveDistrictPipelineKind(district: DistrictDescriptor) {
	const normalizedOffice = normalizeValue(district.office);
	const normalizedTitle = normalizeValue(district.title);

	if (district.jurisdiction === "Federal")
		return "federal";

	if (district.jurisdiction === "State")
		return "state";

	if (normalizedOffice.includes("county") || normalizedTitle.includes("county"))
		return "county";

	if (normalizedOffice.includes("city") || normalizedTitle.includes("city"))
		return "city";

	return "other-local";
}

function buildDistrictRepresentativeAvailabilityNote(district: DistrictDescriptor, representativeCount: number) {
	if (representativeCount > 0)
		return `${representativeCount} current official${representativeCount === 1 ? "" : "s"} ${representativeCount === 1 ? "is" : "are"} linked from the active nationwide lookup for this district.`;

	const kind = deriveDistrictPipelineKind(district);

	if (kind === "county")
		return "No county officeholder data is connected for this area yet. This does not mean the county has no officials, only that the current nationwide provider set does not yet publish a county officeholder pipeline here.";

	if (kind === "city")
		return "City officeholder data is not yet available from the current nationwide provider set. This does not mean the city has no officials, only that Ballot Clarity cannot yet attach them here.";

	if (kind === "other-local")
		return "Local officeholder data is not yet fully connected for this area. Official local election tools remain the verification path until a local officeholder pipeline is attached.";

	return "No current official record is linked from the active nationwide provider set for this district yet.";
}

function buildDistrictCandidateAvailabilityNote(hasPublishedGuide: boolean) {
	return hasPublishedGuide
		? "Candidate field records are attached to this district page from the published local guide."
		: "Candidate field records, contest summaries, and local ballot-guide pages remain unavailable here because Ballot Clarity does not currently have a published local guide for this district.";
}

export function buildNationwideDistrictRoleGuide(district: DistrictDescriptor) {
	const kind = deriveDistrictPipelineKind(district);

	if (kind === "federal") {
		return {
			decisionAreas: [
				"Federal legislation and oversight",
				"Appropriations and district project advocacy",
				"Constituent casework with federal agencies",
			],
			summary: "This district identifies the federal office area tied to the current nationwide lookup.",
			whyItMatters: "Federal district matches help confirm the current U.S. House officeholder and the official election tools tied to that geography.",
		};
	}

	if (kind === "state") {
		return {
			decisionAreas: [
				"State budget and appropriations",
				"State statutory changes",
				"Committee oversight and constituent services",
			],
			summary: "This district identifies the state legislative office area tied to the current nationwide lookup.",
			whyItMatters: "State legislative district matches help orient voters to the current officeholder, the district geography, and the official election tools tied to that area.",
		};
	}

	if (kind === "county") {
		return {
			decisionAreas: [
				"County administration and budgeting",
				"County services and local implementation",
				"Local verification through county election offices",
			],
			summary: "This county geography is attached as a lookup orientation layer, even when Ballot Clarity does not yet have a county officeholder pipeline for it.",
			whyItMatters: "County matches still help users reach the right official county election tools and verify which local government area a lookup resolved into.",
		};
	}

	if (kind === "city") {
		return {
			decisionAreas: [
				"City governance and municipal services",
				"Council, mayoral, and local administrative context",
				"Official local verification through municipal or county election tools",
			],
			summary: "This city geography is attached as a lookup orientation layer, even when Ballot Clarity does not yet have city officeholder records for it.",
			whyItMatters: "City matches still help users verify locality, official tools, and the local jurisdiction tied to the current lookup.",
		};
	}

	return {
		decisionAreas: [
			"Jurisdiction verification",
			"District and office matching",
			"Official election tool discovery",
		],
		summary: "This district is part of the active nationwide lookup context for the current location.",
		whyItMatters: "Even when Ballot Clarity does not yet have a published local guide, this district layer helps orient the user around geography, offices, and official verification tools.",
	};
}

function buildUpdatedAt(context: ActiveNationwideLookupContext) {
	return context.resolvedAt || new Date().toISOString();
}

function buildDirectoryBundle(context: ActiveNationwideLookupContext) {
	const updatedAt = buildUpdatedAt(context);
	const locationLabel = context.location?.displayName || context.normalizedAddress || "Nationwide lookup";
	const locationState = context.location?.state;
	const districtBySlug = new Map<string, DistrictsResponse["districts"][number]>();
	const districtRepresentatives = new Map<string, string>();
	const districtKeyToSlug = new Map<string, string>();

	for (const districtMatch of context.districtMatches) {
		const slug = buildDistrictSlugFromMatch(districtMatch);
		const summary = {
			candidateCount: 0,
			href: `/districts/${slug}`,
			jurisdiction: deriveNationwideDistrictJurisdiction(districtMatch.districtType),
			office: districtMatch.districtType || "District",
			representativeCount: 0,
			slug,
			summary: `${districtMatch.sourceSystem ?? "Provider"} geographic match`,
			title: districtMatch.label,
			updatedAt,
		} satisfies DistrictsResponse["districts"][number];

		if (!districtBySlug.has(slug))
			districtBySlug.set(slug, summary);

		for (const key of buildDistrictMatchKeys(districtMatch, locationState))
			districtKeyToSlug.set(key, slug);
	}

	for (const representative of context.representativeMatches) {
		const districtSlug = buildRepresentativeMatchKeys(representative, locationState)
			.map(key => districtKeyToSlug.get(key))
			.find((slug): slug is string => Boolean(slug))
			?? toLookupSlug(representative.districtLabel);
		const district = districtBySlug.get(districtSlug);

		if (district)
			district.representativeCount += 1;

		districtRepresentatives.set(representative.id, districtSlug);
	}

	const districts = Array.from(districtBySlug.values());
	const representatives = context.representativeMatches.map((representative) => {
		const slug = buildNationwideRepresentativeSlug(representative);
		const districtSlug = districtRepresentatives.get(representative.id) ?? toLookupSlug(representative.districtLabel);
		const sources = representative.openstatesUrl
			? [
					toSource({
						authority: "nonprofit-provider",
						date: updatedAt,
						id: `representative:${slug}`,
						note: "Representative record carried into this directory card from the active nationwide lookup.",
						publisher: "Open States",
						sourceSystem: representative.sourceSystem || "Open States",
						title: representative.name,
						url: representative.openstatesUrl,
					}),
				]
			: [];

		return {
			ballotStatusLabel: "Published ballot status unavailable in this area",
			districtLabel: representative.districtLabel,
			districtSlug,
			fundingAvailable: false,
			fundingSummary: "No person-level funding record is attached to this representative yet.",
			governmentLevel: representative.governmentLevel,
			href: `/representatives/${slug}`,
			id: representative.id,
			incumbent: true,
			influenceAvailable: false,
			influenceSummary: "No person-level influence record is attached to this representative yet.",
			location: locationLabel,
			name: representative.name,
			officeDisplayLabel: representative.officeDisplayLabel,
			officeTitle: representative.officeTitle,
			officeSought: representative.officeTitle,
			officeholderLabel: "Current officeholder",
			officeType: representative.officeType,
			onCurrentBallot: false,
			openstatesUrl: representative.openstatesUrl,
			party: representative.party ?? "Unknown",
			provenance: {
				label: representative.sourceSystem ? `${representative.sourceSystem} representative match` : "Nationwide lookup representative match",
				note: "Derived from the active nationwide lookup layer rather than a published local ballot guide.",
				status: "crosswalked",
			},
			slug,
			sourceCount: sources.length,
			sources,
			summary: representative.sourceSystem ? `Matched from ${representative.sourceSystem}` : "Matched from nationwide lookup",
			updatedAt,
		} satisfies RepresentativeSummary;
	});

	return {
		districts,
		representatives,
		updatedAt,
	};
}

function buildRepresentativeSources(context: ActiveNationwideLookupContext, representative: RepresentativeSummary, districtTitle: string | null, updatedAt: string) {
	const sources: Source[] = [
		toSource({
			authority: representative.openstatesUrl ? "nonprofit-provider" : "open-data",
			date: updatedAt,
			id: `representative:${representative.slug}`,
			note: "Representative record carried into this page from the active nationwide lookup.",
			publisher: representative.openstatesUrl ? "Open States" : "Nationwide lookup provider",
			sourceSystem: representative.provenance?.label || "Nationwide lookup representative match",
			title: representative.name,
			url: representative.openstatesUrl || openStatesUrl,
		}),
	];

	if (districtTitle) {
		sources.push(toSource({
			authority: "official-government",
			date: updatedAt,
			id: `district:${representative.districtSlug}`,
			note: "District geography attached from the active nationwide lookup.",
			publisher: "U.S. Census Geocoder",
			sourceSystem: "U.S. Census Geocoder",
			title: districtTitle,
			url: censusGeocoderDocsUrl,
		}));
	}

	for (const action of context.actions.filter(item => item.kind === "official-verification" && item.url)) {
		sources.push(toSource({
			authority: "official-government",
			date: updatedAt,
			id: `official:${action.id}`,
			note: action.description,
			publisher: action.badge || "Official election tool",
			sourceSystem: "Official election verification",
			title: action.title,
			url: action.url as string,
		}));
	}

	return Array.from(new Map(sources.map(source => [source.id, source])).values());
}

function buildFallbackRouteSource(id: string, title: string, updatedAt: string) {
	return toSource({
		authority: "ballot-clarity-archive",
		date: updatedAt,
		id,
		note: "This public route is available, but Ballot Clarity still needs an active nationwide lookup or a published local record to attach richer person and district detail to it.",
		publisher: "Ballot Clarity route model",
		sourceSystem: "Ballot Clarity nationwide route layer",
		title,
		url: "/coverage",
	});
}

export function buildActiveNationwideLookupContext(response: LocationLookupResponse) {
	if (response.result !== "resolved" || response.guideAvailability !== "not-published")
		return null;

	return sanitizeActiveNationwideLookupContext({
		...response,
		resolvedAt: new Date().toISOString(),
	});
}

export function buildActiveNationwideLookupCookie(response: LocationLookupResponse) {
	const context = buildActiveNationwideLookupContext(response);

	if (!context)
		return null;

	return JSON.stringify(buildCookiePayload(context));
}

export function readActiveNationwideLookupContext(cookieHeader: string | undefined) {
	const cookies = parseCookieHeader(cookieHeader);
	const rawValue = cookies[activeNationwideLookupCookieName];

	if (!rawValue)
		return null;

	try {
		return sanitizeActiveNationwideLookupContext(JSON.parse(decodeURIComponent(rawValue)));
	}
	catch {
		return null;
	}
}

export function clearActiveNationwideLookupCookie(response: {
	clearCookie: (name: string, options?: Record<string, unknown>) => void;
}) {
	response.clearCookie(activeNationwideLookupCookieName, {
		path: "/",
		sameSite: "lax",
	});
}

export function persistActiveNationwideLookupCookie(response: {
	cookie: (name: string, value: string, options?: Record<string, unknown>) => void;
}, value: string) {
	response.cookie(activeNationwideLookupCookieName, value, {
		httpOnly: false,
		maxAge: cookieMaxAgeSeconds * 1000,
		path: "/",
		sameSite: "lax",
	});
}

export function buildNationwideDistrictsResponse(context: ActiveNationwideLookupContext): DistrictsResponse {
	const directory = buildDirectoryBundle(context);

	return {
		districts: directory.districts,
		mode: "nationwide",
		note: "District pages derived from the active nationwide lookup context attached to this request.",
		updatedAt: directory.updatedAt,
	};
}

export function buildNationwideRepresentativesResponse(context: ActiveNationwideLookupContext): RepresentativesResponse {
	const directory = buildDirectoryBundle(context);

	return {
		districts: directory.districts,
		mode: "nationwide",
		note: "Representative directory derived from the active nationwide lookup context attached to this request.",
		representatives: directory.representatives,
		updatedAt: directory.updatedAt,
	};
}

export function buildRouteFallbackDistrictRecordResponse(districtSlug: string): DistrictRecordResponse {
	const updatedAt = new Date().toISOString();
	const district = {
		candidateCount: 0,
		description: "This district route is available, but Ballot Clarity still needs either an active nationwide lookup or a published local guide to attach exact representatives, official tools, and any candidate field records to it.",
		electionSlug: "nationwide-lookup",
		href: `/districts/${districtSlug}`,
		jurisdiction: deriveNationwideDistrictJurisdiction(districtSlug),
		office: inferDistrictTitleFromSlug(districtSlug),
		representativeCount: 0,
		roleGuide: buildNationwideDistrictRoleGuide({
			jurisdiction: deriveNationwideDistrictJurisdiction(districtSlug),
			office: inferDistrictTitleFromSlug(districtSlug),
			title: inferDistrictTitleFromSlug(districtSlug),
		}),
		slug: districtSlug,
		summary: "Lookup-backed district context will attach here after Ballot Clarity resolves an active nationwide result for this request.",
		title: inferDistrictTitleFromSlug(districtSlug),
		updatedAt,
	};

	return {
		candidateAvailabilityNote: "Candidate field records remain guide-dependent here. Open a published local guide when Ballot Clarity has one for this district.",
		candidates: [],
		district,
		districtOriginLabel: "Lookup context required",
		districtOriginNote: "This district route is part of the nationwide results layer, but no active nationwide lookup was attached to this request. Open a lookup first to attach the exact geography, current representatives, and official verification tools for this district.",
		election: {
			date: updatedAt,
			jurisdictionSlug: "",
			locationName: "Nationwide civic lookup required",
			name: "Nationwide civic lookup required",
			slug: "nationwide-lookup",
			updatedAt,
		},
		mode: "nationwide",
		note: "This district page resolves as a public nationwide route, but richer district detail depends on an active lookup context or a published local guide.",
		officialResources: [],
		relatedContests: [],
		representativeAvailabilityNote: buildDistrictRepresentativeAvailabilityNote(district, 0),
		representatives: [],
		sources: [buildFallbackRouteSource(`district:${districtSlug}:fallback`, `${inferDistrictTitleFromSlug(districtSlug)} route availability`, updatedAt)],
		updatedAt,
	};
}

export function buildRouteFallbackPersonProfileResponse(representativeSlug: string): PersonProfileResponse {
	const updatedAt = new Date().toISOString();
	const name = inferRepresentativeNameFromSlug(representativeSlug);
	const sources = [buildFallbackRouteSource(`representative:${representativeSlug}:fallback`, `${name} route availability`, updatedAt)];

	return {
		note: "This representative route resolves publicly and keeps the person identity stable, even when Ballot Clarity cannot yet attach a provider-backed office record or user-specific lookup enrichment to it.",
		person: {
			ballotStatusLabel: "Current ballot status not yet attached",
			biography: [
				{
					id: `route:${representativeSlug}`,
					sources,
					summary: "This public person route is stable, but Ballot Clarity has not yet attached a provider-backed office record or user-specific lookup confirmation to it.",
					title: "Public route identity",
				},
			],
			comparison: null,
			contestSlug: "",
			districtLabel: "District confirmation pending",
			districtSlug: "",
			freshness: {
				contentLastVerifiedAt: updatedAt,
				dataLastUpdatedAt: updatedAt,
				nextReviewAt: updatedAt,
				status: "up-to-date",
				statusLabel: "Public route",
				statusNote: "This route is available and identity-stable, but Ballot Clarity has not attached a current provider-backed office record to it yet.",
			},
			funding: null,
			governmentLevel: null,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: "Public representative route",
			methodologyNotes: [
				"Representative routes stay public even when Ballot Clarity cannot yet attach a richer provider-backed person record.",
				"Active nationwide lookup context can still add user-specific district confirmation, official tools, and stronger locality context.",
			],
			name,
			officeDisplayLabel: "Office record pending provider crosswalk",
			officeholderLabel: "Current officeholder route",
			officeType: null,
			officeSought: "Office record pending provider crosswalk",
			onCurrentBallot: false,
			party: "Unknown",
			provenance: {
				asOf: updatedAt,
				label: "Representative route identity",
				note: "This route is live, but Ballot Clarity could not yet crosswalk it to a provider-backed officeholder record on this request.",
				source: "nationwide",
				status: "inferred",
			},
			publicStatements: [],
			slug: representativeSlug,
			sourceCount: sources.length,
			sources,
			summary: "This representative page resolves publicly and keeps the person identity stable, but Ballot Clarity has not yet attached provider-backed office, district, finance, or influence detail to it.",
			topIssues: [],
			updatedAt,
			whatWeDoNotKnow: [
				buildTrustBullet(
					"provider-crosswalk-pending",
					"Ballot Clarity has not yet attached a provider-backed office record, district confirmation, or person-level finance and influence modules to this route.",
					sources,
				),
			],
			whatWeKnow: [
				buildTrustBullet(
					"route-available",
					"This public route itself is live, identity-stable, and can render an honest unavailable state instead of failing.",
					sources,
				),
			],
		},
		updatedAt,
	};
}

export function buildNationwideDistrictRecordResponse(context: ActiveNationwideLookupContext, districtSlug: string): DistrictRecordResponse | null {
	const directory = buildDirectoryBundle(context);
	const district = directory.districts.find(item => item.slug === districtSlug);

	if (!district)
		return null;

	const updatedAt = directory.updatedAt;
	const representatives = directory.representatives.filter(item => item.districtSlug === district.slug);
	const officialResources = context.actions
		.map(buildOfficialResource)
		.filter((item): item is OfficialResource => Boolean(item));
	const districtMatch = context.districtMatches.find((match) => {
		return buildDistrictSlugFromMatch(match) === district.slug;
	}) ?? null;
	const sources: Array<ReturnType<typeof toSource> | null> = [
		districtMatch
			? toSource({
					authority: districtMatch.sourceSystem.toLowerCase().includes("census") ? "official-government" : "open-data",
					date: updatedAt,
					id: `district:${district.slug}:match`,
					note: "Provider-backed district match carried into this page from the active nationwide lookup.",
					publisher: districtMatch.sourceSystem,
					sourceSystem: districtMatch.sourceSystem,
					title: `${district.title} district match`,
					url: districtMatch.sourceSystem.toLowerCase().includes("census") ? censusGeocoderDocsUrl : openStatesUrl,
				})
			: null,
		...representatives.map(representative => toSource({
			authority: representative.openstatesUrl ? "nonprofit-provider" : "open-data",
			date: updatedAt,
			id: `representative:${representative.slug}`,
			note: "Representative record linked to this district from the active nationwide lookup.",
			publisher: representative.provenance?.label || "Nationwide lookup representative match",
			sourceSystem: representative.provenance?.label || "Nationwide lookup representative match",
			title: representative.name,
			url: representative.openstatesUrl || openStatesUrl,
		})),
		...officialResources.map(resource => toSource({
			authority: resource.authority,
			date: updatedAt,
			id: `official:${resource.label}`,
			note: resource.note || "",
			publisher: resource.sourceLabel,
			sourceSystem: resource.sourceSystem,
			title: resource.label,
			url: resource.url,
		})),
	];
	const resolvedSources = sources.filter(isPresent);
	const representativeAvailabilityNote = buildDistrictRepresentativeAvailabilityNote(district, representatives.length);
	const hasPublishedGuide = false;

	return {
		candidateAvailabilityNote: buildDistrictCandidateAvailabilityNote(hasPublishedGuide),
		candidates: [],
		district: {
			...district,
			description: `${district.summary}. This district page is being rendered from the active nationwide lookup context rather than a published local guide.`,
			electionSlug: context.electionSlug || "nationwide-lookup",
			roleGuide: buildNationwideDistrictRoleGuide(district),
		},
		districtOriginLabel: "Nationwide lookup record",
		districtOriginNote: context.inputKind === "zip"
			? "This district page was assembled from the active ZIP-based nationwide lookup. District and representative matches can still be useful, but a full street address remains the stronger precision path when multiple local layers could overlap."
			: "This district page was assembled from the active nationwide lookup so district links resolve even when a published local guide is not available.",
		election: {
			date: updatedAt,
			jurisdictionSlug: "",
			locationName: context.location?.displayName || context.normalizedAddress || "Nationwide lookup",
			name: "Nationwide civic lookup context",
			slug: context.electionSlug || "nationwide-lookup",
			updatedAt,
		} satisfies ElectionSummary,
		mode: "nationwide",
		note: "This district page is the API-backed nationwide district detail for the current active lookup. It keeps district context, linked officials, provider provenance, and official election tools visible even when a published local guide is not available.",
		officialResources,
		relatedContests: [],
		representativeAvailabilityNote,
		representatives,
		sources: Array.from(new Map(resolvedSources.map(source => [source.id, source])).values()),
		updatedAt,
	};
}

export function buildNationwidePersonProfileResponse(context: ActiveNationwideLookupContext, representativeSlug: string): PersonProfileResponse | null {
	const directory = buildDirectoryBundle(context);
	const representativeMatch = context.representativeMatches.find(match => buildNationwideRepresentativeRouteAliases(match).includes(representativeSlug)) ?? null;
	const representative = directory.representatives.find(item => item.slug === (representativeMatch ? buildNationwideRepresentativeSlug(representativeMatch) : representativeSlug));

	if (!representative)
		return null;

	const updatedAt = directory.updatedAt;
	const district = directory.districts.find(item => item.slug === representative.districtSlug) ?? null;
	const sources = buildRepresentativeSources(context, representative, district?.title ?? null, updatedAt);

	return {
		note: "Representative profile assembled from the active nationwide lookup context rather than a published local person record.",
		person: {
			ballotStatusLabel: "Published ballot status unavailable in this area",
			biography: [
				{
					id: `provider:${representative.slug}`,
					sources,
					summary: representative.openstatesUrl
						? `${representative.name} is linked here through the active nationwide lookup and the matched provider-backed representative record.`
						: `${representative.name} is linked here through the active nationwide lookup.`,
					title: "Provider-backed office record",
				},
			],
			comparison: null,
			contestSlug: district?.slug || representative.districtSlug,
			districtLabel: representative.districtLabel,
			districtSlug: district?.slug || representative.districtSlug,
			freshness: {
				contentLastVerifiedAt: updatedAt,
				dataLastUpdatedAt: updatedAt,
				nextReviewAt: updatedAt,
				status: "up-to-date",
				statusLabel: "Lookup-backed",
				statusNote: "This profile reflects the latest nationwide lookup currently saved in this browser. Verify critical details against the attached provider record and official election tools.",
			},
			funding: null,
			governmentLevel: representative.governmentLevel,
			incumbent: true,
			keyActions: [],
			lobbyingContext: [],
			location: representative.location,
			methodologyNotes: [
				"This page is generated from the active nationwide lookup and should not be mistaken for a published local person record.",
				"Provider-backed representative matches can be crosswalked or approximate, especially for ZIP-based lookups.",
			],
			name: representative.name,
			officeDisplayLabel: representative.officeDisplayLabel,
			officeholderLabel: representative.officeholderLabel,
			officeType: representative.officeType,
			officeSought: representative.officeSought,
			onCurrentBallot: false,
			openstatesUrl: representative.openstatesUrl,
			party: representative.party,
			provenance: {
				asOf: updatedAt,
				label: representative.provenance?.label || "Nationwide lookup representative match",
				note: representative.provenance?.note || "Derived from the active nationwide lookup rather than a published local person record.",
				source: "lookup",
				status: representative.provenance?.status || "crosswalked",
			},
			publicStatements: [],
			slug: representative.slug,
			sourceCount: sources.length,
			sources,
			summary: representative.summary,
			topIssues: [],
			updatedAt,
			whatWeDoNotKnow: [
				buildTrustBullet(
					"guide-status",
					"Candidate-field and ballot-comparison records are not attached to this person page. Finance and influence modules appear only when Ballot Clarity can verify a reliable person-level linkage for them.",
					sources,
				),
				buildTrustBullet(
					"lookup-precision",
					context.inputKind === "zip"
						? "This record came from a ZIP-based lookup and should be treated as a likely match until verified against a full street address or official election tools."
						: "Provider-backed person matching can still be incomplete and should be verified against the linked provider record and official tools.",
					sources,
				),
			],
			whatWeKnow: [
				buildTrustBullet(
					"lookup-match",
					district
						? buildDistrictRepresentativeAvailabilityNote(district, 1)
						: "District context is attached from the active nationwide lookup when available.",
					sources,
				),
				buildTrustBullet(
					"official-tools",
					context.actions.some(action => action.kind === "official-verification")
						? "Official election tools remain attached to the current lookup context for ballot confirmation, voter status, or polling-place verification."
						: "No official election tool links were attached to this lookup response.",
					sources,
				),
			],
		},
		updatedAt,
	};
}
