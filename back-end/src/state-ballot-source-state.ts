import type { StateBallotSource } from "./state-ballot-sources.js";

export class StateBallotAwaitingRecordsError extends Error {
	constructor(readonly sourceId: string) {
		super("The validated official candidate export has no records yet.");
	}
}

export function supportsPendingStateBallotRecords(source: StateBallotSource) {
	return !source.retrievalPolicy && ((source.stateCode === "FL" && source.format === "florida-local-tsv") || (source.stateCode === "MD" && ["csv", "maryland-local-csv"].includes(source.format)) || (source.stateCode === "KY" && ["kentucky-html", "kentucky-courts-html"].includes(source.format)) || (source.stateCode === "UT" && source.format === "utah-html" && source.id !== "ut-lg-2026") || (source.stateCode === "MI" && source.format === "michigan-html" && source.id !== "mi-dos-2026"));
}

export function orderStateBallotSources(sources: readonly StateBallotSource[], now = Date.now()) {
	const expired = (source: StateBallotSource) => Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 <= now;
	return [...sources].sort((first, second) => Number(expired(first)) - Number(expired(second)) || first.electionDate.localeCompare(second.electionDate));
}
