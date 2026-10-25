export function fullAreaGuideLabels(state?: string) {
	return state === "DC" || state === "District of Columbia"
		? { status: "Districtwide information only", limitation: "Candidate races are not included." }
		: { status: "Statewide information only", limitation: "Local races are not included." };
}
