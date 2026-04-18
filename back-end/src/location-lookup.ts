import type { AddressEnrichmentResult } from "./address-enrichment.js";
import type { OfficialAddressMatch } from "./google-civic.js";
import type {
	CoverageResponse,
	Jurisdiction,
	JurisdictionSummary,
	LocationLookupAction,
	LocationLookupInputKind,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	LocationSelection,
	OfficialResource,
} from "./types/civic.js";
import { getOfficialToolsForState, getStateNameForAbbreviation } from "./official-election-tools.js";

const zipCodePattern = /^\d{5}(?:-\d{4})?$/;
const numericFragmentPattern = /^[\d-]+$/;
const myVoterPagePattern = /my voter page/i;
const pollingPlacePattern = /polling-place|precinct/i;

function normalizePlaceName(value: string | undefined) {
	return (value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\b(?:county|city|parish|borough|township|town)\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

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
		coverageLabel: `Published ballot guide area: ${summary.displayName}`,
		displayName: summary.displayName,
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: true,
		slug: summary.slug,
		state: summary.state
	};
}

function buildZipNationwideSelection(
	rawQuery: string,
	geoContext: LookupGeoContext | null | undefined
): LocationSelection | null {
	const state = geoContext?.stateName
		|| getStateNameForAbbreviation(geoContext?.stateAbbreviation)
		|| geoContext?.stateAbbreviation;
	const displayName = geoContext?.locality && state
		? `${geoContext.locality}, ${state}`
		: state
			? `${rawQuery}, ${state}`
			: geoContext?.postalCode || rawQuery;

	if (!displayName)
		return null;

	return {
		coverageLabel: "Nationwide civic results available",
		displayName,
		lookupInput: geoContext?.postalCode || rawQuery,
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
		state: state || ""
	};
}

function findOfficialVerificationResource(jurisdiction: Jurisdiction | null, coverage: CoverageResponse) {
	const candidates = [
		...(jurisdiction?.officialResources ?? []),
		...(coverage.launchTarget?.officialResources ?? [])
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

export function findSupportedCoverageSummaries(jurisdictionSummaries: JurisdictionSummary[], geoContext: LookupGeoContext | null | undefined) {
	if (!geoContext?.stateAbbreviation)
		return [];

	const geoState = normalizePlaceName(
		geoContext.stateName
		|| getStateNameForAbbreviation(geoContext.stateAbbreviation)
		|| geoContext.stateAbbreviation
	);
	const matchingStateSummaries = jurisdictionSummaries.filter((summary) => {
		const summaryState = normalizePlaceName(summary.state);
		return Boolean(summaryState && geoState && summaryState === geoState);
	});

	return matchingStateSummaries.filter((summary) => {
		const summaryNames = [
			normalizePlaceName(summary.name),
			normalizePlaceName(summary.displayName)
		].filter(Boolean);
		const countyName = normalizePlaceName(geoContext.countyName);
		const locality = normalizePlaceName(geoContext.locality);

		if (countyName && summaryNames.some(name => name.includes(countyName) || countyName.includes(name)))
			return true;

		if (locality && summaryNames.some(name => name.includes(locality) || locality.includes(name)))
			return true;

		return !countyName && !locality && matchingStateSummaries.length === 1;
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
	hasOfficialActions: boolean
) {
	const locationSentence = describeDetectedLocation(inputKind, rawQuery, geoContext);
	const officialSentence = hasOfficialActions
		? "Ballot Clarity could not map this lookup into a confirmed local result. Use the official voter or election tools below for the correct ballot, voter-status, and polling-place information."
		: "Ballot Clarity could not map this lookup into a confirmed local result. Enter a full street address for a more precise lookup, or use the official voter or election tool for this state.";

	return `${locationSentence} ${officialSentence}`.trim();
}

function buildGuideUnavailableNote(
	rawQuery: string,
	inputKind: LocationLookupInputKind,
	geoContext: LookupGeoContext | null | undefined,
	hasOfficialActions: boolean,
	addressEnrichment?: AddressEnrichmentResult | null
) {
	const locationSentence = describeDetectedLocation(inputKind, rawQuery, geoContext);
	const publishedGuideSentence = `Ballot Clarity matched this ${inputKind === "zip" ? "location" : "address"} and loaded the nationwide civic result layers available here.`;
	const districtSentence = addressEnrichment?.districtMatches?.length
		? `Census geography matched ${addressEnrichment.districtMatches.map(match => match.label).join(", ")}.`
		: "";
	const representativeSentence = addressEnrichment?.representativeMatches?.length
		? `Open States returned ${addressEnrichment.representativeMatches.length} representative match${addressEnrichment.representativeMatches.length === 1 ? "" : "es"} for this ${inputKind}.`
		: "";
	const officialSentence = hasOfficialActions
		? "Official election tools are included below for the current ballot, voter-status, and polling-place details."
		: "Use the relevant official election tool for current ballot, voter-status, and polling-place details.";

	return [
		locationSentence,
		publishedGuideSentence,
		districtSentence,
		representativeSentence,
		officialSentence
	].filter(Boolean).join(" ");
}

function buildPublishedZipGuideNote(
	rawQuery: string,
	geoContext: LookupGeoContext | null | undefined,
	hasOfficialActions: boolean,
	addressEnrichment?: AddressEnrichmentResult | null
) {
	const locationSentence = describeDetectedLocation("zip", rawQuery, geoContext);
	const guideSentence = "Ballot Clarity matched a single guide area for this ZIP and loaded the nationwide civic result layers available here.";
	const districtSentence = addressEnrichment?.districtMatches?.length
		? `Census geography matched ${addressEnrichment.districtMatches.map(match => match.label).join(", ")}.`
		: "";
	const representativeSentence = addressEnrichment?.representativeMatches?.length
		? `Open States returned ${addressEnrichment.representativeMatches.length} representative match${addressEnrichment.representativeMatches.length === 1 ? "" : "es"} for this ZIP.`
		: "";
	const officialSentence = hasOfficialActions
		? "Official election tools are included below for ballot confirmation, voter-status, and polling-place details."
		: "Use the relevant official election tool for ballot confirmation, voter-status, and polling-place details.";

	return [
		locationSentence,
		guideSentence,
		districtSentence,
		representativeSentence,
		officialSentence
	].filter(Boolean).join(" ");
}

function buildZipSelectionNote(
	rawQuery: string,
	selectionOptions: LocationLookupSelectionOption[],
	hasOfficialActions: boolean
) {
	const officialSentence = hasOfficialActions
		? "Official election tools stay visible below while you choose the right matched area."
		: "Choose the right matched area below to continue with district and ballot lookup.";

	return `ZIP code ${rawQuery} matched ${selectionOptions.length} possible civic areas in the current provider data. Choose the correct area below so Ballot Clarity can load the right districts, representatives, and any published guide coverage for this ZIP. ${officialSentence}`;
}

function buildAvailabilitySummary(
	inputKind: LocationLookupInputKind,
	guideAvailability: "published" | "not-published",
	addressEnrichment?: AddressEnrichmentResult | null,
	selectionOptions?: LocationLookupSelectionOption[]
) {
	const representativeCount = addressEnrichment?.representativeMatches?.length ?? 0;
	const hasRepresentatives = representativeCount > 0;
	const hasGuide = guideAvailability === "published";
	const selectionRequired = inputKind === "zip" && Boolean(selectionOptions?.length);
	const financeInfluenceDetail = hasGuide
		? "Funding and influence pages are available through the published Ballot Clarity candidate pages and any linked person profiles for this area."
		: selectionRequired
			? "Choose one of the matched areas below to see whether any person-level funding or influence records are attached to this lookup."
			: hasRepresentatives
				? "No person-level funding or influence records are attached to this lookup yet. Ballot Clarity only shows those modules when a matched candidate or representative profile has reliable linked data."
				: "No person-level funding or influence records are attached to this lookup yet.";
	const nationwideDetail = hasGuide
		? "Nationwide civic results, district context, and official election tools are available alongside the published local guide for this lookup."
		: selectionRequired
			? "Nationwide civic results are available for this ZIP after you choose one of the matched areas below."
			: inputKind === "zip"
				? "Nationwide civic results and official election tools are available for this ZIP lookup even though a published local guide is not available for this area yet."
				: "Nationwide civic results, district context, and official election tools are available for this address even though a published local guide is not available for this area yet.";

	return {
		nationwideCivicResults: {
			detail: nationwideDetail,
			label: "Nationwide civic results",
			status: "available"
		},
		ballotCandidates: {
			detail: hasGuide
				? inputKind === "zip"
					? "Ballot Clarity has contest and candidate coverage for the matched ZIP area."
					: "Ballot Clarity has contest and candidate coverage for this area."
				: "Ballot candidate pages are not published for this area yet.",
			label: "Ballot candidate data",
			status: hasGuide ? "available" : "unavailable"
		},
		financeInfluence: {
			detail: financeInfluenceDetail,
			label: "Finance and influence",
			status: hasGuide ? "available" : "unavailable"
		},
		fullLocalGuide: {
			detail: hasGuide
				? inputKind === "zip"
					? "A published local guide is available for the matched ZIP area."
					: "A published local ballot guide is available for this lookup."
				: "A full local contest and measure guide is not published for this area yet.",
			label: "Full local guide",
			status: hasGuide ? "available" : "unavailable"
		},
		representatives: {
			detail: hasRepresentatives
				? `Current representative data is available for this lookup from Open States (${representativeCount} match${representativeCount === 1 ? "" : "es"}).`
				: selectionRequired
					? "This ZIP matched more than one possible area. Choose one below to load the correct representative records."
					: inputKind === "zip"
						? "Representative data is not available for the matched ZIP area yet."
						: "Current representative data is not available for this lookup yet.",
			label: "Representative data",
			status: hasRepresentatives ? "available" : "unavailable"
		}
	} satisfies NonNullable<LocationLookupResponse["availability"]>;
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
	jurisdiction: Jurisdiction | null,
	jurisdictionSummaries: JurisdictionSummary[],
	location: LocationSelection | null,
	electionSlug: string | undefined,
	coverageMode: "empty" | "snapshot",
	coverage: CoverageResponse,
	geoContext?: LookupGeoContext | null,
	officialLookup?: OfficialAddressMatch | null,
	addressEnrichment?: AddressEnrichmentResult | null,
	selectionOptions?: LocationLookupSelectionOption[],
	selectionId?: string
): LocationLookupResponse {
	const inputKind = classifyLookupInput(rawQuery);
	const stateOfficialActions = buildOfficialVerificationActions(
		getOfficialToolsForState(geoContext?.stateAbbreviation)
	);
	const supportedCoverageSummaries = findSupportedCoverageSummaries(jurisdictionSummaries, geoContext);

	if (inputKind === "zip") {
		if (!geoContext) {
			return {
				actions: stateOfficialActions,
				inputKind,
				lookupQuery: rawQuery,
				note: buildUnsupportedNote(rawQuery, inputKind, geoContext, Boolean(stateOfficialActions.length)),
				result: "unsupported"
			};
		}

		const autoSelectedCoverage = supportedCoverageSummaries.length === 1
			? supportedCoverageSummaries[0]
			: null;
		const hasPublishedGuide = Boolean(autoSelectedCoverage);
		const officialVerification = hasPublishedGuide
			? buildOfficialVerificationAction(findOfficialVerificationResource(jurisdiction, coverage))
			: undefined;
		const actions = dedupeActions([
			...(supportedCoverageSummaries.length > 1 ? buildCoverageActions(supportedCoverageSummaries) : []),
			...stateOfficialActions,
			...(officialVerification ? [officialVerification] : [])
		]);
		const guideAvailability = hasPublishedGuide ? "published" : "not-published";
		const nationwideSelection = selectionOptions?.length
			? undefined
			: autoSelectedCoverage
				? buildCoverageSelection(autoSelectedCoverage)
				: buildZipNationwideSelection(rawQuery, geoContext) || undefined;

		return {
			actions,
			availability: buildAvailabilitySummary(inputKind, guideAvailability, addressEnrichment, selectionOptions),
			districtMatches: addressEnrichment?.districtMatches,
			electionSlug: autoSelectedCoverage?.nextElectionSlug,
			fromCache: addressEnrichment?.fromCache,
			guideAvailability,
			inputKind,
			location: nationwideSelection,
			lookupQuery: rawQuery,
			note: selectionOptions?.length
				? buildZipSelectionNote(rawQuery, selectionOptions, Boolean(actions.length))
				: guideAvailability === "published"
					? buildPublishedZipGuideNote(rawQuery, geoContext, Boolean(actions.length), addressEnrichment)
					: buildGuideUnavailableNote(rawQuery, inputKind, geoContext, Boolean(actions.length), addressEnrichment),
			normalizedAddress: addressEnrichment?.normalizedAddress || geoContext.postalCode || rawQuery,
			representativeMatches: addressEnrichment?.representativeMatches,
			selectionId,
			selectionOptions,
			result: "resolved"
		};
	}

	if (!supportedCoverageSummaries.length || !location || !electionSlug) {
		const officialActions = dedupeActions([
			...(officialLookup?.actions ?? []),
			...stateOfficialActions
		]);

		if (geoContext || officialLookup || addressEnrichment?.normalizedAddress || addressEnrichment?.districtMatches?.length || addressEnrichment?.representativeMatches?.length) {
			return {
				actions: officialActions,
				availability: buildAvailabilitySummary(inputKind, "not-published", addressEnrichment),
				fromCache: addressEnrichment?.fromCache,
				guideAvailability: "not-published",
				inputKind,
				districtMatches: addressEnrichment?.districtMatches,
				lookupQuery: rawQuery,
				note: buildGuideUnavailableNote(rawQuery, inputKind, geoContext, Boolean(officialActions.length), addressEnrichment),
				normalizedAddress: addressEnrichment?.normalizedAddress,
				representativeMatches: addressEnrichment?.representativeMatches,
				selectionId,
				result: "resolved"
			};
		}

		return {
			actions: officialActions,
			fromCache: addressEnrichment?.fromCache,
			inputKind,
			districtMatches: addressEnrichment?.districtMatches,
			lookupQuery: rawQuery,
			note: buildUnsupportedNote(rawQuery, inputKind, geoContext, Boolean(officialActions.length)),
			normalizedAddress: addressEnrichment?.normalizedAddress,
			representativeMatches: addressEnrichment?.representativeMatches,
			selectionId,
			result: "unsupported"
		};
	}

	return {
		actions: officialLookup?.actions?.length ? officialLookup.actions : undefined,
		availability: buildAvailabilitySummary(inputKind, "published", addressEnrichment),
		electionSlug,
		fromCache: addressEnrichment?.fromCache,
		guideAvailability: "published",
		inputKind,
		districtMatches: addressEnrichment?.districtMatches,
		lookupQuery: rawQuery,
		location: {
			...location,
			lookupMode: officialLookup?.verified ? "address-verified" : "address-submitted",
			lookupInput: addressEnrichment?.normalizedAddress || rawQuery,
			requiresOfficialConfirmation: !officialLookup?.verified
		},
		note: [
			officialLookup?.note || (coverageMode === "snapshot"
				? "A full address is the right input for exact ballot matching. The current release still opens the latest published public guide for this area and should be verified against official election tools for the final district-level ballot."
				: "A full address is the right input for exact ballot matching. The current release still opens the published local guide for this area while verified address-to-ballot matching is being connected, so confirm the final ballot in the official election tools."),
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
		selectionId,
		result: "resolved"
	};
}
