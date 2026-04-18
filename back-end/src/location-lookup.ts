import type { AddressEnrichmentResult } from "./address-enrichment.js";
import type { OfficialAddressMatch } from "./google-civic.js";
import type {
	CoverageResponse,
	Jurisdiction,
	JurisdictionSummary,
	LocationLookupAction,
	LocationLookupInputKind,
	LocationLookupResponse,
	LocationSelection,
	OfficialResource,
} from "./types/civic.js";
import { getOfficialToolsForState, getStateNameForAbbreviation } from "./official-election-tools.js";

const zipCodePattern = /^\d{5}(?:-\d{4})?$/;
const numericFragmentPattern = /^[\d-]+$/;
const myVoterPagePattern = /my voter page/i;
const pollingPlacePattern = /polling-place|precinct/i;
const coverageMatcherBySlug = new Map([
	["fulton-county-georgia", { countyFips: "121", stateAbbreviation: "GA" }]
]);

export interface LookupGeoContext {
	countyFips?: string;
	countyName?: string;
	locality?: string;
	normalizedAddress?: string;
	postalCode?: string;
	sourceSystem?: string;
	stateAbbreviation?: string;
	stateName?: string;
}

function buildCoverageSelection(summary: JurisdictionSummary): LocationSelection {
	return {
		coverageLabel: `Current launch jurisdiction: ${summary.displayName}`,
		displayName: summary.displayName,
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: true,
		slug: summary.slug,
		state: summary.state
	};
}

function findOfficialVerificationResource(jurisdiction: Jurisdiction, coverage: CoverageResponse) {
	const candidates = [
		...jurisdiction.officialResources,
		...coverage.launchTarget.officialResources
	];

	return candidates.find(resource => myVoterPagePattern.test(resource.label))
		?? candidates.find(resource => pollingPlacePattern.test(resource.label))
		?? candidates.find(resource => resource.authority === "official-government");
}

function buildCoverageActions(jurisdictionSummaries: JurisdictionSummary[]): LocationLookupAction[] {
	return jurisdictionSummaries.map(summary => ({
		badge: "Approximate",
		description: `Open the current ${summary.displayName} coverage guide. ZIP-only lookups can cross district or city boundaries, so verify the final ballot in the official tools before relying on this guide.`,
		electionSlug: summary.nextElectionSlug,
		id: `coverage:${summary.slug}`,
		kind: "ballot-guide",
		location: buildCoverageSelection(summary),
		title: summary.displayName
	}));
}

function buildOfficialVerificationAction(resource: OfficialResource | undefined): LocationLookupAction | undefined {
	if (!resource)
		return undefined;

	return {
		badge: "Official",
		description: resource.note || "Use the official election-office tool to verify your precinct, polling place, and sample ballot before relying on an approximate coverage guide.",
		id: "official-verification",
		kind: "official-verification",
		title: resource.label,
		url: resource.url
	};
}

function dedupeActions(actions: Array<LocationLookupAction | undefined>) {
	const seen = new Set<string>();
	const unique: LocationLookupAction[] = [];

	for (const action of actions) {
		if (!action)
			continue;

		const key = action.url || `${action.kind}:${action.title}:${action.electionSlug || action.id}`;

		if (seen.has(key))
			continue;

		seen.add(key);
		unique.push(action);
	}

	return unique;
}

function buildOfficialVerificationActions(resources: OfficialResource[]) {
	return dedupeActions(resources.map(buildOfficialVerificationAction));
}

function findSupportedCoverageSummaries(jurisdictionSummaries: JurisdictionSummary[], geoContext: LookupGeoContext | null | undefined) {
	if (!geoContext?.stateAbbreviation)
		return [];

	return jurisdictionSummaries.filter((summary) => {
		const matcher = coverageMatcherBySlug.get(summary.slug);

		if (!matcher)
			return false;

		return geoContext.stateAbbreviation === matcher.stateAbbreviation
			&& (!matcher.countyFips || geoContext.countyFips === matcher.countyFips);
	});
}

function describeDetectedLocation(
	inputKind: LocationLookupInputKind,
	rawQuery: string,
	geoContext: LookupGeoContext | null | undefined
) {
	if (inputKind === "zip") {
		if (geoContext?.locality && (geoContext.stateName || geoContext.stateAbbreviation))
			return `ZIP code ${geoContext.postalCode || rawQuery} appears to be in ${geoContext.locality}, ${geoContext.stateName || geoContext.stateAbbreviation}.`;

		if (geoContext?.stateName || geoContext?.stateAbbreviation)
			return `ZIP code ${geoContext.postalCode || rawQuery} appears to be in ${geoContext.stateName || geoContext.stateAbbreviation}.`;

		return `ZIP code ${rawQuery} is outside Ballot Clarity's current supported coverage.`;
	}

	if (geoContext?.countyName && (geoContext.stateName || geoContext.stateAbbreviation))
		return `This address appears to be in ${geoContext.countyName}, ${geoContext.stateName || geoContext.stateAbbreviation}.`;

	if (geoContext?.stateName || geoContext?.stateAbbreviation)
		return `This address appears to be in ${geoContext.stateName || geoContext.stateAbbreviation}.`;

	return "This address is outside Ballot Clarity's current supported coverage.";
}

function buildUnsupportedNote(
	rawQuery: string,
	inputKind: LocationLookupInputKind,
	geoContext: LookupGeoContext | null | undefined,
	supportedAreaLabel: string,
	hasOfficialActions: boolean
) {
	const locationSentence = describeDetectedLocation(inputKind, rawQuery, geoContext);
	const stateName = geoContext?.stateName || getStateNameForAbbreviation(geoContext?.stateAbbreviation);
	const officialSentence = hasOfficialActions
		? `Ballot Clarity is currently live only for ${supportedAreaLabel}. Use the official ${stateName ? `${stateName} ` : ""}voter or election tools below for the correct ballot, voter-status, and polling-place information.`
		: `Ballot Clarity is currently live only for ${supportedAreaLabel}. Enter a full street address for a more precise check, or use the official voter or election tool for this state.`;

	return `${locationSentence} ${officialSentence}`.trim();
}

export function classifyLookupInput(raw: string): LocationLookupInputKind {
	if (zipCodePattern.test(raw))
		return "zip";

	return "address";
}

export function validateLookupInput(raw: string) {
	if (raw.length < 3)
		return "Enter at least a street address or ZIP code fragment to continue.";

	if (numericFragmentPattern.test(raw) && !zipCodePattern.test(raw))
		return "Enter a full 5-digit ZIP code or a street address to continue.";

	return null;
}

export function buildLocationLookupResponse(
	rawQuery: string,
	jurisdiction: Jurisdiction,
	jurisdictionSummaries: JurisdictionSummary[],
	location: LocationSelection,
	electionSlug: string,
	coverageMode: "seed" | "snapshot",
	coverage: CoverageResponse,
	geoContext?: LookupGeoContext | null,
	officialLookup?: OfficialAddressMatch | null,
	addressEnrichment?: AddressEnrichmentResult | null
): LocationLookupResponse {
	const inputKind = classifyLookupInput(rawQuery);
	const supportedAreaLabel = coverage.launchTarget.displayName;
	const stateOfficialActions = buildOfficialVerificationActions(
		getOfficialToolsForState(geoContext?.stateAbbreviation)
	);
	const supportedCoverageSummaries = findSupportedCoverageSummaries(jurisdictionSummaries, geoContext);

	if (inputKind === "zip") {
		if (!supportedCoverageSummaries.length) {
			return {
				actions: stateOfficialActions,
				inputKind,
				note: buildUnsupportedNote(rawQuery, inputKind, geoContext, supportedAreaLabel, Boolean(stateOfficialActions.length)),
				result: "unsupported",
				supportedAreaLabel
			};
		}

		const officialVerification = buildOfficialVerificationAction(
			findOfficialVerificationResource(jurisdiction, coverage)
		);
		const actions = [
			...buildCoverageActions(supportedCoverageSummaries),
			...(officialVerification ? [officialVerification] : [])
		];
		const coverageSentence = describeDetectedLocation(inputKind, rawQuery, geoContext);

		return {
			actions,
			inputKind,
			note: coverageMode === "snapshot"
				? `${coverageSentence} ZIP-only lookup can preview the currently supported coverage area, but it cannot choose an exact district-level ballot. Pick the coverage guide below or use the official voter tool for exact verification.`
				: `${coverageSentence} ZIP-only lookup can preview the current public coverage area, but it cannot choose an exact district-level ballot. Pick the current coverage guide below or use the official voter tool for exact verification.`,
			result: "selection-required",
			supportedAreaLabel
		};
	}

	if (!supportedCoverageSummaries.length) {
		return {
			actions: dedupeActions([
				...(officialLookup?.actions ?? []),
				...stateOfficialActions
			]),
			fromCache: addressEnrichment?.fromCache,
			inputKind,
			districtMatches: addressEnrichment?.districtMatches,
			note: buildUnsupportedNote(rawQuery, inputKind, geoContext, supportedAreaLabel, Boolean((officialLookup?.actions?.length ?? 0) || stateOfficialActions.length)),
			normalizedAddress: addressEnrichment?.normalizedAddress,
			representativeMatches: addressEnrichment?.representativeMatches,
			result: "unsupported",
			supportedAreaLabel
		};
	}

	return {
		actions: officialLookup?.actions?.length ? officialLookup.actions : undefined,
		electionSlug,
		fromCache: addressEnrichment?.fromCache,
		inputKind,
		districtMatches: addressEnrichment?.districtMatches,
		location: {
			...location,
			lookupMode: officialLookup?.verified ? "address-verified" : "address-submitted",
			lookupInput: addressEnrichment?.normalizedAddress || rawQuery,
			requiresOfficialConfirmation: !officialLookup?.verified
		},
		note: [
			officialLookup?.note || (coverageMode === "snapshot"
				? "A full address is the right input for exact ballot matching. The current release still opens the latest imported public coverage snapshot and should be verified against official election tools for the final district-level ballot."
				: "A full address is the right input for exact ballot matching. The current release still opens the Fulton County reference guide while verified address-to-ballot matching is being connected, so confirm the final ballot in the official election tools."),
			addressEnrichment?.districtMatches?.length
				? `Census geography matched ${addressEnrichment.districtMatches.map(match => match.label).join(", ")}.`
				: "",
			addressEnrichment?.representativeMatches?.length
				? `Open States returned ${addressEnrichment.representativeMatches.length} representative match${addressEnrichment.representativeMatches.length === 1 ? "" : "es"} for this address.`
				: "",
			addressEnrichment?.fromCache
				? "District geography came from the local lookup cache."
				: ""
		].filter(Boolean).join(" "),
		normalizedAddress: addressEnrichment?.normalizedAddress,
		representativeMatches: addressEnrichment?.representativeMatches,
		result: "resolved",
		supportedAreaLabel
	};
}
