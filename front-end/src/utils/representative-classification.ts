import type {
	RepresentativeGovernmentLevel,
	RepresentativeOfficeType,
} from "~/types/civic";

export interface RepresentativeClassificationInput {
	districtLabel?: string | null;
	districtType?: string | null;
	governmentLevel?: RepresentativeGovernmentLevel | null;
	officeSought?: string | null;
	officeTitle?: string | null;
	officeType?: RepresentativeOfficeType | null;
	stateName?: string | null;
}

export interface RepresentativeClassification {
	governmentLevel: RepresentativeGovernmentLevel | null;
	officeDisplayLabel: string;
	officeType: RepresentativeOfficeType | null;
}

const districtNumberPattern = /(\d+)/;
const countySuffixPattern = /\s+county$/i;
const citySuffixPattern = /\s+city$/i;
const congressionalCodePattern = /\b[a-z]{2}-\d+\b/;
const stateDistrictCodePattern = /\b([A-Z]{2})-\d+\b/;
const stateDistrictNamePattern = /^(?:senator|representative)\s+([A-Z][A-Z .'-]+)$/i;
const usStateNamesByAbbreviation = {
	AK: "Alaska",
	AL: "Alabama",
	AR: "Arkansas",
	AZ: "Arizona",
	CA: "California",
	CO: "Colorado",
	CT: "Connecticut",
	DC: "District of Columbia",
	DE: "Delaware",
	FL: "Florida",
	GA: "Georgia",
	HI: "Hawaii",
	IA: "Iowa",
	ID: "Idaho",
	IL: "Illinois",
	IN: "Indiana",
	KS: "Kansas",
	KY: "Kentucky",
	LA: "Louisiana",
	MA: "Massachusetts",
	MD: "Maryland",
	ME: "Maine",
	MI: "Michigan",
	MN: "Minnesota",
	MO: "Missouri",
	MS: "Mississippi",
	MT: "Montana",
	NC: "North Carolina",
	ND: "North Dakota",
	NE: "Nebraska",
	NH: "New Hampshire",
	NJ: "New Jersey",
	NM: "New Mexico",
	NV: "Nevada",
	NY: "New York",
	OH: "Ohio",
	OK: "Oklahoma",
	OR: "Oregon",
	PA: "Pennsylvania",
	RI: "Rhode Island",
	SC: "South Carolina",
	SD: "South Dakota",
	TN: "Tennessee",
	TX: "Texas",
	UT: "Utah",
	VA: "Virginia",
	VT: "Vermont",
	WA: "Washington",
	WI: "Wisconsin",
	WV: "West Virginia",
	WY: "Wyoming",
} as const satisfies Record<string, string>;

function normalizeText(value: string | null | undefined) {
	return String(value ?? "").trim().toLowerCase();
}

function findDistrictNumber(...values: Array<string | null | undefined>) {
	for (const value of values) {
		const match = String(value ?? "").match(districtNumberPattern);
		if (match?.[1])
			return String(Number.parseInt(match[1], 10));
	}

	return "";
}

function formatOrdinal(value: string) {
	const numericValue = Number.parseInt(value, 10);

	if (Number.isNaN(numericValue))
		return value;

	const mod100 = numericValue % 100;
	if (mod100 >= 11 && mod100 <= 13)
		return `${numericValue}th`;

	switch (numericValue % 10) {
		case 1:
			return `${numericValue}st`;
		case 2:
			return `${numericValue}nd`;
		case 3:
			return `${numericValue}rd`;
		default:
			return `${numericValue}th`;
	}
}

function formatPossessive(value: string) {
	return value.endsWith("s") ? `${value}'` : `${value}'s`;
}

function normalizeCountyName(value: string | null | undefined) {
	return String(value ?? "").trim().replace(countySuffixPattern, "");
}

function normalizeCityName(value: string | null | undefined) {
	return String(value ?? "").trim().replace(citySuffixPattern, "");
}

function normalizeStateName(value: string | null | undefined) {
	const trimmed = String(value ?? "").trim();

	if (!trimmed)
		return "";

	return normalizeText(trimmed) === "united states" ? "" : trimmed;
}

function getStateNameForAbbreviation(stateAbbreviation: string) {
	return usStateNamesByAbbreviation[stateAbbreviation.toUpperCase() as keyof typeof usStateNamesByAbbreviation] || "";
}

function inferStateNameFromDistrictContext(...values: Array<string | null | undefined>) {
	for (const value of values) {
		const trimmedValue = String(value ?? "").trim();

		if (!trimmedValue)
			continue;

		const districtCodeMatch = trimmedValue.match(stateDistrictCodePattern);
		if (districtCodeMatch?.[1]) {
			const stateName = getStateNameForAbbreviation(districtCodeMatch[1]);

			if (stateName)
				return stateName;
		}

		const districtNameMatch = trimmedValue.match(stateDistrictNamePattern);
		const districtStateName = normalizeStateName(districtNameMatch?.[1]);

		if (districtStateName)
			return districtStateName;
	}

	return "";
}

function resolveStateName(input: RepresentativeClassificationInput) {
	const trimmedStateName = normalizeStateName(input.stateName);

	if (trimmedStateName)
		return trimmedStateName;

	return inferStateNameFromDistrictContext(input.districtLabel, input.officeSought, input.officeTitle);
}

function buildOfficeDisplayLabel(
	governmentLevel: RepresentativeGovernmentLevel | null,
	officeType: RepresentativeOfficeType | null,
	input: RepresentativeClassificationInput,
) {
	const districtLabel = String(input.districtLabel ?? "").trim();
	const officeTitle = String(input.officeTitle ?? "").trim();
	const officeSought = String(input.officeSought ?? "").trim();
	const stateName = resolveStateName(input);
	const districtNumber = findDistrictNumber(input.districtLabel, input.officeSought, input.districtType);
	const countyName = normalizeCountyName(districtLabel);
	const cityName = normalizeCityName(districtLabel);

	switch (officeType) {
		case "us_senate":
			return stateName ? `U.S. Senator for ${stateName}` : "U.S. Senator";
		case "us_house":
			if (districtNumber && stateName)
				return `U.S. Representative for ${formatPossessive(stateName)} ${formatOrdinal(districtNumber)} Congressional District`;

			if (districtNumber)
				return `U.S. Representative for the ${formatOrdinal(districtNumber)} Congressional District`;

			return stateName ? `U.S. Representative for ${stateName}` : "U.S. Representative";
		case "state_senate":
			if (districtNumber && stateName)
				return `${stateName} State Senator for District ${districtNumber}`;

			if (districtNumber)
				return `State Senator for District ${districtNumber}`;

			return stateName ? `${stateName} State Senator` : "State Senator";
		case "state_house":
			if (districtNumber && stateName)
				return `${stateName} State Representative for District ${districtNumber}`;

			if (districtNumber)
				return `State Representative for District ${districtNumber}`;

			return stateName ? `${stateName} State Representative` : "State Representative";
		case "county_commission":
			return countyName ? `${countyName} County Commission Chair` : "County Commission Chair";
		case "county_official":
			return countyName ? `${countyName} County official` : "County official";
		case "mayor":
			return cityName ? `Mayor of ${cityName}` : "Mayor";
		case "city_official":
			return cityName ? `${cityName} city official` : "City official";
		default:
			return officeSought || officeTitle || districtLabel || "Public officeholder";
	}
}

export function classifyRepresentative(input: RepresentativeClassificationInput): RepresentativeClassification {
	if (input.governmentLevel || input.officeType) {
		const governmentLevel = input.governmentLevel ?? null;
		const officeType = input.officeType ?? null;
		return {
			governmentLevel,
			officeDisplayLabel: buildOfficeDisplayLabel(governmentLevel, officeType, input),
			officeType,
		};
	}

	const districtLabel = normalizeText(input.districtLabel);
	const districtType = normalizeText(input.districtType);
	const officeTitle = normalizeText(input.officeTitle);
	const officeSought = normalizeText(input.officeSought);
	const combined = [districtType, districtLabel, officeTitle, officeSought].filter(Boolean).join(" ");
	const hasCongressionalCue = combined.includes("congressional district")
		|| congressionalCodePattern.test(districtLabel)
		|| officeSought.includes("u.s. house");
	const hasStateSenateCue = combined.includes("state senate district");
	const hasStateHouseCue = combined.includes("state house district");
	const hasCountyCue = combined.includes("county");
	const hasCityCue = combined.includes(" city") || officeTitle.includes("mayor") || officeSought.includes("mayor");
	const hasSenatorCue = officeTitle.includes("senator") || officeSought.includes("senator");
	const hasRepresentativeCue = officeTitle.includes("representative") || officeSought.includes("representative");
	const hasDistrictNumber = Boolean(findDistrictNumber(input.districtLabel, input.officeSought, input.districtType));

	if (officeTitle.includes("mayor") || officeSought.includes("mayor") || (hasCityCue && !hasDistrictNumber)) {
		return {
			governmentLevel: "city",
			officeDisplayLabel: buildOfficeDisplayLabel("city", "mayor", input),
			officeType: "mayor",
		};
	}

	if (officeTitle.includes("county commission") || officeSought.includes("county commission")) {
		return {
			governmentLevel: "county",
			officeDisplayLabel: buildOfficeDisplayLabel("county", "county_commission", input),
			officeType: "county_commission",
		};
	}

	if (hasCongressionalCue && hasRepresentativeCue) {
		return {
			governmentLevel: "federal",
			officeDisplayLabel: buildOfficeDisplayLabel("federal", "us_house", input),
			officeType: "us_house",
		};
	}

	if ((hasStateSenateCue || (hasSenatorCue && hasDistrictNumber && !hasCongressionalCue)) && !hasCountyCue && !hasCityCue) {
		return {
			governmentLevel: "state",
			officeDisplayLabel: buildOfficeDisplayLabel("state", "state_senate", input),
			officeType: "state_senate",
		};
	}

	if ((hasStateHouseCue || (hasRepresentativeCue && hasDistrictNumber && !hasCongressionalCue)) && !hasCountyCue && !hasCityCue) {
		return {
			governmentLevel: "state",
			officeDisplayLabel: buildOfficeDisplayLabel("state", "state_house", input),
			officeType: "state_house",
		};
	}

	if (hasSenatorCue) {
		return {
			governmentLevel: "federal",
			officeDisplayLabel: buildOfficeDisplayLabel("federal", "us_senate", input),
			officeType: "us_senate",
		};
	}

	if (hasCountyCue) {
		return {
			governmentLevel: "county",
			officeDisplayLabel: buildOfficeDisplayLabel("county", "county_official", input),
			officeType: "county_official",
		};
	}

	if (hasCityCue) {
		return {
			governmentLevel: "city",
			officeDisplayLabel: buildOfficeDisplayLabel("city", "city_official", input),
			officeType: "city_official",
		};
	}

	return {
		governmentLevel: null,
		officeDisplayLabel: buildOfficeDisplayLabel(null, null, input),
		officeType: "other",
	};
}

export function buildRepresentativeGovernmentLevelLabel(level: RepresentativeGovernmentLevel | null) {
	switch (level) {
		case "federal":
			return "Federal";
		case "state":
			return "State";
		case "county":
			return "County";
		case "city":
			return "City";
		default:
			return "Unclassified";
	}
}

export function buildRepresentativeGovernmentLevelSectionLabel(level: RepresentativeGovernmentLevel) {
	switch (level) {
		case "federal":
			return "Federal officials";
		case "state":
			return "State officials";
		case "county":
			return "County officials";
		case "city":
			return "City officials";
	}
}

export const representativeGovernmentLevelOrder: RepresentativeGovernmentLevel[] = ["federal", "state", "county", "city"];
