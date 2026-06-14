import type { NationwideLookupResultContext } from "~/types/civic";
import { classifyRepresentative } from "./representative-classification";

export const activeNationwideLookupCookieName = "ballot-clarity-nationwide-lookup";

function compactOptionalString(value: string | null | undefined) {
	return value || "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function readCompactString(tuple: unknown[], index: number) {
	const value = tuple[index];
	return typeof value === "string" ? value : "";
}

function readCompactOptionalString(tuple: unknown[], index: number) {
	const value = readCompactString(tuple, index);
	return value || undefined;
}

function expandCompactCookiePayload(value: unknown) {
	if (!isRecord(value) || value.v !== 2)
		return value;

	const locationTuple = Array.isArray(value.l) ? value.l : null;

	return {
		actions: Array.isArray(value.a)
			? value.a.map((item) => {
					if (!Array.isArray(item))
						return null;

					return {
						badge: readCompactOptionalString(item, 3),
						description: readCompactString(item, 4),
						id: readCompactString(item, 0),
						kind: "official-verification",
						title: readCompactString(item, 1),
						url: readCompactOptionalString(item, 2),
					};
				}).filter(Boolean)
			: [],
		detectedFromIp: value.d === 1,
		districtMatches: Array.isArray(value.dm)
			? value.dm.map((item) => {
					if (!Array.isArray(item))
						return null;

					return {
						districtCode: readCompactString(item, 3),
						districtType: readCompactString(item, 2),
						id: readCompactString(item, 0),
						label: readCompactString(item, 1),
						sourceSystem: readCompactString(item, 4),
					};
				}).filter(Boolean)
			: [],
		electionSlug: typeof value.es === "string" ? value.es : undefined,
		electionLogistics: null,
		guideAvailability: value.ga === "p" ? "published" : "not-published",
		inputKind: value.ik === "a" ? "address" : "zip",
		location: locationTuple
			? {
					displayName: readCompactString(locationTuple, 0),
					lookupMode: readCompactOptionalString(locationTuple, 3),
					requiresOfficialConfirmation: locationTuple[4] === 1,
					slug: readCompactString(locationTuple, 1),
					state: readCompactString(locationTuple, 2),
				}
			: null,
		normalizedAddress: typeof value.q === "string" ? value.q : "",
		representativeMatches: Array.isArray(value.rm)
			? value.rm.map((item) => {
					if (!Array.isArray(item))
						return null;

					return {
						districtLabel: readCompactString(item, 2),
						governmentLevel: readCompactOptionalString(item, 5),
						id: readCompactString(item, 0),
						name: readCompactString(item, 1),
						officeDisplayLabel: readCompactOptionalString(item, 7),
						officeTitle: readCompactString(item, 3),
						officeType: readCompactOptionalString(item, 6),
						openstatesUrl: readCompactOptionalString(item, 9),
						party: readCompactOptionalString(item, 4),
						profileImages: readCompactOptionalString(item, 10)
							? [
									{
										alt: `Portrait of ${readCompactString(item, 1)}`,
										priority: 20,
										sourceKind: "provider",
										sourceLabel: "Provider image",
										sourceSystem: readCompactOptionalString(item, 8) ?? "Lookup results representative match",
										url: readCompactString(item, 10),
									}
								]
							: undefined,
						sourceSystem: readCompactOptionalString(item, 8) ?? "Lookup results representative match",
					};
				}).filter(Boolean)
			: [],
		resolvedAt: typeof value.t === "string" ? value.t : "",
		result: "resolved",
		selectionId: typeof value.s === "string" ? value.s : undefined,
	};
}

export function buildActiveNationwideLookupCookieValue(result: NationwideLookupResultContext) {
	return encodeURIComponent(JSON.stringify({
		a: result.actions.map(action => [
			action.id,
			action.title,
			compactOptionalString(action.url),
			compactOptionalString(action.badge),
			action.description
		]),
		d: result.detectedFromIp ? 1 : 0,
		dm: result.districtMatches.map(district => [
			district.id,
			district.label,
			district.districtType,
			district.districtCode,
			district.sourceSystem
		]),
		es: result.electionSlug,
		ga: result.guideAvailability === "published" ? "p" : "n",
		ik: result.inputKind === "address" ? "a" : "z",
		l: result.location
			? [
					result.location.displayName,
					result.location.slug,
					result.location.state,
					compactOptionalString(result.location.lookupMode),
					result.location.requiresOfficialConfirmation ? 1 : 0
				]
			: null,
		q: result.normalizedAddress || result.lookupQuery || "",
		rm: result.representativeMatches.map(representative => [
			representative.id,
			representative.name,
			representative.districtLabel,
			representative.officeTitle,
			compactOptionalString(representative.party),
			compactOptionalString(representative.governmentLevel),
			compactOptionalString(representative.officeType),
			compactOptionalString(representative.officeDisplayLabel),
			compactOptionalString(representative.sourceSystem),
			compactOptionalString(representative.openstatesUrl),
			compactOptionalString(representative.profileImages?.[0]?.url)
		]),
		s: result.selectionId,
		t: result.resolvedAt,
		v: 2
	}));
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
		const parsed = expandCompactCookiePayload(JSON.parse(decodeURIComponent(cookieValue)));

		if (!isRecord(parsed) || parsed.result !== "resolved")
			return null;

		const guideAvailability = parsed.guideAvailability === "published" || parsed.guideAvailability === "not-published"
			? parsed.guideAvailability
			: null;

		if (!guideAvailability)
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
			guideAvailability,
			guideContent: null,
			inputKind: parsed.inputKind === "address" ? "address" : "zip",
			location,
			lookupQuery: typeof parsed.lookupQuery === "string" ? parsed.lookupQuery : typeof parsed.normalizedAddress === "string" ? parsed.normalizedAddress : "",
			normalizedAddress: typeof parsed.normalizedAddress === "string" ? parsed.normalizedAddress : "",
			note: typeof parsed.note === "string" ? parsed.note : "Saved lookup results are active in this browser.",
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
