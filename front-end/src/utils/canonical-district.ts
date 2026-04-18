import type { LocationDistrictMatch, LocationRepresentativeMatch } from "../types/civic";

type DistrictScope = "city" | "county" | "federal-house" | "label" | "state-house" | "state-senate";
const stateDistrictCodePattern = /\b[A-Z]{2}\s*-\s*(\d+)\b/i;
const numericDistrictCodePattern = /\d+/;
const senatorPrefixPattern = /^senator-/;
const representativePrefixPattern = /^representative-/;
const representativeStateDistrictPattern = /\b[A-Z]{2}\s*-\s*\d+\b/i;

function normalizeKey(value: string | null | undefined) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
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

	return normalizeKey(rawValue);
}

function buildLabelFallbackKey(label: string, locationState: string | undefined) {
	return `label:${normalizeKey(locationState) || "unknown"}:${normalizeKey(label)}`;
}

function buildCanonicalKey(scope: DistrictScope, districtCode: string, locationState: string | undefined, label: string) {
	return `${scope}:${normalizeKey(locationState) || "unknown"}:${districtCode || normalizeKey(label)}`;
}

function deriveDistrictScopeFromMatch(match: LocationDistrictMatch): DistrictScope {
	const normalizedType = normalizeKey(match.districtType);
	const normalizedLabel = normalizeKey(match.label);

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

function deriveRepresentativeScope(match: LocationRepresentativeMatch, locationState: string | undefined): DistrictScope {
	const normalizedOfficeTitle = normalizeKey(match.officeTitle);
	const normalizedDistrictLabel = normalizeKey(match.districtLabel);
	const normalizedState = normalizeKey(locationState);
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

export function buildDistrictMatchKeys(match: LocationDistrictMatch, locationState: string | undefined) {
	const scope = deriveDistrictScopeFromMatch(match);
	const districtCode = normalizeDistrictCode(match.districtCode || match.label);

	return [
		buildCanonicalKey(scope, districtCode, locationState, match.label),
		buildLabelFallbackKey(match.label, locationState)
	];
}

export function buildRepresentativeMatchKeys(match: LocationRepresentativeMatch, locationState: string | undefined) {
	const scope = deriveRepresentativeScope(match, locationState);
	const districtCode = normalizeDistrictCode(match.districtLabel);
	const keys = new Set<string>([
		buildLabelFallbackKey(match.districtLabel, locationState)
	]);

	keys.add(buildCanonicalKey(scope, districtCode, locationState, match.districtLabel));

	return [...keys];
}
