import type { PublicStateCandidateRecord, StateRecordState } from "~/types/civic";

export const stateRecordScopes = [
	{ value: "all", label: "All offices" },
	{ value: "statewide", label: "Statewide and state districts" },
	{ value: "congressional", label: "Congress" },
	{ value: "state-senate", label: "State Senate" },
	{ value: "state-house", label: "State House" },
	{ value: "local", label: "Local and regional" },
];

export const stateRecordStatusLabels: Record<PublicStateCandidateRecord["status"], string> = {
	"listed": "Listed",
	"filed": "Filed",
	"qualified": "Qualified",
	"write-in": "Write-in",
	"withdrawn": "Withdrawn",
	"disqualified": "Disqualified",
	"defeated": "Defeated",
	"elected": "Elected",
	"unopposed": "Unopposed",
	"inactive": "Inactive",
	"unrecognized": "Status not recognized",
};

export function resolveStateRecordCode(value: unknown, states: readonly StateRecordState[]) {
	if (typeof value !== "string") return "";
	const normalized = value.trim().toLowerCase();
	return states.find(state => state.stateCode.toLowerCase() === normalized || state.stateName.toLowerCase() === normalized)?.stateCode ?? "";
}

export function readStateRecordQuery(query: Record<string, unknown>, states: readonly StateRecordState[]) {
	const offset = typeof query.offset === "string" && /^\d+$/u.test(query.offset) ? Number(query.offset) : 0;
	return {
		stateCode: resolveStateRecordCode(query.state, states),
		...(query.source === undefined ? {} : { sourceId: typeof query.source === "string" ? query.source.slice(0, 120) : "" }),
		search: typeof query.q === "string" ? query.q.slice(0, 120) : "",
		scope: typeof query.scope === "string" && stateRecordScopes.some(scope => scope.value === query.scope) ? query.scope : "all",
		status: query.status === "all" ? "all" : "active",
		offset: Number.isSafeInteger(offset) && offset <= 25_000 ? offset : 0,
	};
}

export function stateRecordArea(record: PublicStateCandidateRecord) {
	const office = record.office.toLowerCase();
	const areas = [record.jurisdiction, record.sourceDistrictLabel, !record.sourceDistrictLabel && record.district && !office.includes(record.district.toLowerCase()) ? `District ${record.district}` : "", record.sourceAreaLabel];
	return areas.find(area => area && !office.includes(area.toLowerCase())) || "";
}

export function stateRecordSummaryParts(record: PublicStateCandidateRecord) {
	return [
		{ label: record.office, isParty: false },
		{ label: stateRecordArea(record), isParty: false },
		{ label: record.party?.trim() ?? "", isParty: true },
		{ label: record.status === "listed" ? "" : stateRecordStatusLabels[record.status], isParty: false },
	].filter(part => part.label);
}

export function stateRecordSummary(record: PublicStateCandidateRecord) {
	return stateRecordSummaryParts(record).map(part => part.label).join(" · ");
}
