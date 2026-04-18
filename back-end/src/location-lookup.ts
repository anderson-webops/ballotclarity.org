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

const zipCodePattern = /^\d{5}(?:-\d{4})?$/;
const numericFragmentPattern = /^[\d-]+$/;
const myVoterPagePattern = /my voter page/i;
const pollingPlacePattern = /polling-place|precinct/i;

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
	officialLookup?: OfficialAddressMatch | null,
	addressEnrichment?: AddressEnrichmentResult | null
): LocationLookupResponse {
	const inputKind = classifyLookupInput(rawQuery);

	if (inputKind === "zip") {
		const officialVerification = buildOfficialVerificationAction(
			findOfficialVerificationResource(jurisdiction, coverage)
		);
		const actions = [
			...buildCoverageActions(jurisdictionSummaries),
			...(officialVerification ? [officialVerification] : [])
		];

		return {
			actions,
			inputKind,
			note: coverageMode === "snapshot"
				? "ZIP-only lookup can preview the currently supported coverage areas, but it cannot choose an exact district-level ballot. Pick a coverage area below or use the official voter tool for exact verification."
				: "ZIP-only lookup can preview the current public coverage area, but it cannot choose an exact district-level ballot. Pick the current coverage guide below or use the official voter tool for exact verification.",
			result: "selection-required"
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
		result: "resolved"
	};
}
