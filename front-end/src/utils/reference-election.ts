export function readReferenceElection(value: unknown, source?: unknown) {
	if (value === undefined) return undefined;
	if (source !== undefined) return "";
	return typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
		? value
		: "";
}

export function referenceElectionControl(sourceId: string | undefined, electionDate: string | undefined) {
	return electionDate === undefined
		? sourceId ?? ""
		: `references:${electionDate}`;
}

export function referenceElectionQuery(value: string) {
	return value.startsWith("references:")
		? {
				referenceElection: value.slice("references:".length)
			}
		: value
			? { source: value }
			: {};
}
