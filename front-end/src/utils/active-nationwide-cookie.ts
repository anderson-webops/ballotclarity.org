import type { NationwideLookupResultContext } from "~/types/civic";
import { classifyRepresentative } from "./representative-classification";

export const activeNationwideLookupCookieName = "ballot-clarity-nationwide-lookup";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function normalizeRepresentativeMatch(
	value: NationwideLookupResultContext["representativeMatches"][number],
	stateName: string | null
) {
	const classification = classifyRepresentative({
		districtLabel: value.districtLabel,
		governmentLevel: value.governmentLevel,
		officeSought: value.officeDisplayLabel,
		officeTitle: value.officeTitle,
		officeType: value.officeType,
		stateName,
	});

	return {
		...value,
		governmentLevel: classification.governmentLevel,
		officeDisplayLabel: value.officeDisplayLabel || classification.officeDisplayLabel,
		officeType: classification.officeType,
	};
}

export function parseActiveNationwideLookupCookie(cookieValue: string | null | undefined): NationwideLookupResultContext | null {
	if (!cookieValue)
		return null;

	try {
		const parsed = JSON.parse(decodeURIComponent(cookieValue));

		if (!isRecord(parsed) || parsed.result !== "resolved" || parsed.guideAvailability !== "not-published")
			return null;

		const location = isRecord(parsed.location) ? parsed.location as unknown as NationwideLookupResultContext["location"] : null;
		const stateName = location?.state ?? null;
		const representativeMatches = Array.isArray(parsed.representativeMatches)
			? (parsed.representativeMatches as NationwideLookupResultContext["representativeMatches"])
					.map(item => normalizeRepresentativeMatch(item, stateName))
			: [];

		return {
			actions: Array.isArray(parsed.actions) ? parsed.actions as NationwideLookupResultContext["actions"] : [],
			availability: null,
			detectedFromIp: parsed.detectedFromIp === true,
			districtMatches: Array.isArray(parsed.districtMatches) ? parsed.districtMatches as NationwideLookupResultContext["districtMatches"] : [],
			election: null,
			electionLogistics: isRecord(parsed.electionLogistics) ? parsed.electionLogistics as unknown as NationwideLookupResultContext["electionLogistics"] : null,
			electionSlug: typeof parsed.electionSlug === "string" ? parsed.electionSlug : undefined,
			fromCache: false,
			guideAvailability: "not-published",
			inputKind: parsed.inputKind === "address" ? "address" : "zip",
			location,
			normalizedAddress: typeof parsed.normalizedAddress === "string" ? parsed.normalizedAddress : "",
			note: typeof parsed.note === "string" ? parsed.note : "Nationwide civic lookup context is active in this browser.",
			representativeMatches,
			selectionId: typeof parsed.selectionId === "string" ? parsed.selectionId : undefined,
			resolvedAt: typeof parsed.resolvedAt === "string" ? parsed.resolvedAt : "",
			result: "resolved",
			selectionOptions: [],
		};
	}
	catch {
		return null;
	}
}
