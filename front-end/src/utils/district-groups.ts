import type { DistrictSummary } from "~/types/civic";

export function groupDistrictSummaries(districts: DistrictSummary[]) {
	return (["Federal", "State", "Local"] as const).map(jurisdiction => ({
		jurisdiction,
		districts: districts.filter(district => district.jurisdiction === jurisdiction)
	}));
}
