import type { CountyAreaScope } from "./types/civic.js";
import { containsControlCharacters } from "./text-validation.js";
import { usStates } from "./us-states.js";

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function areaName(value: unknown): value is string {
	return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 120 && !containsControlCharacters(value);
}

function normalized(value: string) {
	return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

export function isCountyAreaScope(value: unknown, state: string): value is CountyAreaScope {
	if (!record(value) || Object.keys(value).sort().join(",") !== "countyName,excludedMunicipalities,kind,matching,stateCode"
		|| value.kind !== "county-excluding-municipalities" || value.matching !== "reference-only"
		|| !usStates.some(item => item[0] === value.stateCode && (item[0] === state || item[1] === state))
		|| !areaName(value.countyName) || !Array.isArray(value.excludedMunicipalities) || value.excludedMunicipalities.length < 1 || value.excludedMunicipalities.length > 10
		|| !value.excludedMunicipalities.every(areaName)) {
		return false;
	}
	const names = value.excludedMunicipalities.map(normalized);
	return normalized(value.countyName).length > 0 && names.every(Boolean) && new Set(names).size === names.length
		&& `${value.countyName} outside ${value.excludedMunicipalities.join(", ")}`.length <= 120;
}

export function countyAreaLabel(scope: CountyAreaScope) {
	return `${scope.countyName} outside ${scope.excludedMunicipalities.join(", ")}`;
}

export function countyAreaIdentity(scope: CountyAreaScope) {
	return JSON.stringify([scope.stateCode, normalized(scope.countyName), scope.excludedMunicipalities.map(normalized).sort()]);
}

export function assertJurisdictionCountyArea(value: unknown) {
	if (!record(value)) return;
	if (value.jurisdictionType === "county-area") {
		if (typeof value.state !== "string" || !isCountyAreaScope(value.countyAreaScope, value.state) || value.name !== countyAreaLabel(value.countyAreaScope))
			throw new Error("County-area coverage requires an exact reference-only scope and its full area label.");
	}
	else if (value.countyAreaScope !== undefined) {
		throw new Error("A partial-county scope must retain its county-area jurisdiction type.");
	}
}
