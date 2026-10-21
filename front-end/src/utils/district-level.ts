import type { LocationDistrictMatch } from "../types/civic";

export interface DistrictLevel {
	label: "City or local" | "County" | "Federal" | "Other" | "State";
	order: number;
}

const federalPattern = /congress|u\.s\.|united states|federal/;
const statePattern = /state|legislat|assembly|general assembly/;
const countyPattern = /county|parish|borough/;
const localPattern = /city|town|village|place|school|municipal|board|council|ward|precinct/;

/**
 * Orders a district from the largest jurisdiction to the most local one.
 * State checks run before federal ones so "State Senate" never reads as the U.S. Senate.
 */
export function classifyDistrictLevel(match: Pick<LocationDistrictMatch, "districtType" | "label">): DistrictLevel {
	const text = `${match.districtType} ${match.label}`.toLowerCase();

	if (statePattern.test(text))
		return { label: "State", order: 2 };

	if (federalPattern.test(text))
		return { label: "Federal", order: 1 };

	if (countyPattern.test(text))
		return { label: "County", order: 3 };

	if (localPattern.test(text))
		return { label: "City or local", order: 4 };

	return { label: "Other", order: 5 };
}
