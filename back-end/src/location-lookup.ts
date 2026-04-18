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
import { getOfficialToolsForState } from "./official-election-tools.js";

const zipCodePattern = /^\d{5}(?:-\d{4})?$/;
const numericFragmentPattern = /^[\d-]+$/;
const myVoterPagePattern = /my voter page/i;
const pollingPlacePattern = /polling-place|precinct/i;
const publishedGuideMatcherBySlug = new Map([
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
		coverageLabel: `Published ballot guide area: ${summary.displayName}`,
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
		const matcher = publishedGuideMatcherBySlug.get(summary.slug);

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

function buildAvailabilitySummary(
	inputKind: LocationLookupInputKind,
	guideAvailability: "published" | "not-published",
	addressEnrichment?: AddressEnrichmentResult | null
) {
	const representativeCount = addressEnrichment?.representativeMatches?.length ?? 0;
	const hasRepresentatives = representativeCount > 0;
	const hasGuide = guideAvailability === "published";
	const nationwideDetail = hasGuide
		? "Nationwide civic results, district context, and official election tools are available alongside the published local guide for this lookup."
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
					? "Ballot Clarity has contest and candidate coverage for this area, but a ZIP-only result is still an approximate guide preview."
					: "Ballot Clarity has contest and candidate coverage for this area."
				: "Ballot candidate pages are not published for this area yet.",
			label: "Ballot candidate data",
			status: hasGuide ? "available" : "unavailable"
		},
		financeInfluence: {
			detail: hasGuide
				? "Funding and influence surfaces are available through the published Ballot Clarity candidate pages for this area."
				: "Finance and influence pages are only published where Ballot Clarity has source-backed local candidate records.",
			label: "Finance and influence",
			status: hasGuide ? "available" : "unavailable"
		},
		fullLocalGuide: {
			detail: hasGuide
				? inputKind === "zip"
					? "A published local guide exists here. Use the official tools to confirm the exact ballot before relying on a ZIP preview."
					: "A published local ballot guide is available for this lookup."
				: "A full local contest and measure guide is not published for this area yet.",
			label: "Full local guide",
			status: hasGuide ? "available" : "unavailable"
		},
		representatives: {
			detail: hasRepresentatives
				? `Current representative data is available for this lookup from Open States (${representativeCount} match${representativeCount === 1 ? "" : "es"}).`
				: inputKind === "zip"
					? "ZIP-only lookups do not reliably identify exact current representatives without a full street address."
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
	const stateOfficialActions = buildOfficialVerificationActions(
		getOfficialToolsForState(geoContext?.stateAbbreviation)
	);
	const supportedCoverageSummaries = findSupportedCoverageSummaries(jurisdictionSummaries, geoContext);

	if (inputKind === "zip") {
		if (!geoContext) {
			return {
				actions: stateOfficialActions,
				inputKind,
				note: buildUnsupportedNote(rawQuery, inputKind, geoContext, Boolean(stateOfficialActions.length)),
				result: "unsupported"
			};
		}

		const officialVerification = supportedCoverageSummaries.length
			? buildOfficialVerificationAction(findOfficialVerificationResource(jurisdiction, coverage))
			: undefined;
		const actions = dedupeActions([
			...(supportedCoverageSummaries.length ? buildCoverageActions(supportedCoverageSummaries) : []),
			...stateOfficialActions,
			...(officialVerification ? [officialVerification] : [])
		]);
		const guideAvailability = supportedCoverageSummaries.length ? "published" : "not-published";
		const coverageSentence = describeDetectedLocation(inputKind, rawQuery, geoContext);

		return {
			actions,
			availability: buildAvailabilitySummary(inputKind, guideAvailability),
			guideAvailability,
			inputKind,
			note: guideAvailability === "published"
				? coverageMode === "snapshot"
					? `${coverageSentence} ZIP-only lookup can preview the published guide surfaces for this area, but it cannot choose an exact district-level ballot. Use the official tools below to confirm the final ballot before relying on the guide preview.`
					: `${coverageSentence} ZIP-only lookup can preview the public guide surfaces for this area, but it cannot choose an exact district-level ballot. Use the official tools below to confirm the final ballot before relying on the guide preview.`
				: buildGuideUnavailableNote(rawQuery, inputKind, geoContext, Boolean(actions.length)),
			result: "resolved"
		};
	}

	if (!supportedCoverageSummaries.length) {
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
				note: buildGuideUnavailableNote(rawQuery, inputKind, geoContext, Boolean(officialActions.length), addressEnrichment),
				normalizedAddress: addressEnrichment?.normalizedAddress,
				representativeMatches: addressEnrichment?.representativeMatches,
				result: "resolved"
			};
		}

		return {
			actions: officialActions,
			fromCache: addressEnrichment?.fromCache,
			inputKind,
			districtMatches: addressEnrichment?.districtMatches,
			note: buildUnsupportedNote(rawQuery, inputKind, geoContext, Boolean(officialActions.length)),
			normalizedAddress: addressEnrichment?.normalizedAddress,
			representativeMatches: addressEnrichment?.representativeMatches,
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
		result: "resolved"
	};
}
