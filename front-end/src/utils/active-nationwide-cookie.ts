import type { NationwideLookupResultContext } from "~/types/civic";

export const activeNationwideLookupCookieName = "ballot-clarity-nationwide-lookup";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

export function parseActiveNationwideLookupCookie(cookieValue: string | null | undefined): NationwideLookupResultContext | null {
	if (!cookieValue)
		return null;

	try {
		const parsed = JSON.parse(decodeURIComponent(cookieValue));

		if (!isRecord(parsed) || parsed.result !== "resolved" || parsed.guideAvailability !== "not-published")
			return null;

		return {
			actions: Array.isArray(parsed.actions) ? parsed.actions as NationwideLookupResultContext["actions"] : [],
			availability: null,
			detectedFromIp: parsed.detectedFromIp === true,
			districtMatches: Array.isArray(parsed.districtMatches) ? parsed.districtMatches as NationwideLookupResultContext["districtMatches"] : [],
			election: null,
			electionSlug: typeof parsed.electionSlug === "string" ? parsed.electionSlug : undefined,
			fromCache: false,
			guideAvailability: "not-published",
			inputKind: parsed.inputKind === "address" ? "address" : "zip",
			location: isRecord(parsed.location) ? parsed.location as unknown as NationwideLookupResultContext["location"] : null,
			normalizedAddress: typeof parsed.normalizedAddress === "string" ? parsed.normalizedAddress : "",
			note: typeof parsed.note === "string" ? parsed.note : "Nationwide civic lookup context is active in this browser.",
			representativeMatches: Array.isArray(parsed.representativeMatches) ? parsed.representativeMatches as NationwideLookupResultContext["representativeMatches"] : [],
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
