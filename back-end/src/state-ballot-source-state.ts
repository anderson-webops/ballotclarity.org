import type { StateBallotSource } from "./state-ballot-sources.js";

export class StateBallotAwaitingRecordsError extends Error {
	constructor(readonly sourceId: string) {
		super("The validated official candidate export has no records yet.");
	}
}

export function supportsPendingStateBallotRecords(source: StateBallotSource) {
	if (!source.retrievalPolicy && source.format === "kanawha-pdf" && source.stateCode === "WV") return true;
	if (!source.retrievalPolicy && source.format === "boone-xlsx" && source.stateCode === "IN") return true;
	if (!source.retrievalPolicy && source.format === "orange-pdf" && source.stateCode === "CA") return true;
	if (!source.retrievalPolicy && source.format === "maine-house-html" && source.stateCode === "ME") return true;
	if (!source.retrievalPolicy && source.format === "nyc-pdf" && source.stateCode === "NY") return true;
	if (!source.retrievalPolicy && source.format === "douglas-html" && source.stateCode === "NE") return true;
	if (!source.retrievalPolicy && source.format === "hamilton-html" && source.stateCode === "TN") return true;
	if (!source.retrievalPolicy && source.format === "pima-pdf" && source.stateCode === "AZ") return true;
	if (!source.retrievalPolicy && source.format === "goffstown-pdf" && source.stateCode === "NH") return true;
	if (!source.retrievalPolicy && ["chicago-pdf", "winnebago-pdf"].includes(source.format) && source.stateCode === "IL") return true;
	if (!source.retrievalPolicy && source.format === "east-greenwich-pdf" && source.stateCode === "RI") return true;
	if (!source.retrievalPolicy && source.format === "dane-pdf" && source.stateCode === "WI") return true;
	if (!source.retrievalPolicy && source.format === "pulaski-pdf" && source.stateCode === "AR") return true;
	if (!source.retrievalPolicy && source.format === "tuscola-pdf" && source.stateCode === "MI") return true;
	if (!source.retrievalPolicy && source.stateCode === "DC" && source.format === "dc-pdf") return true;
	if (!source.retrievalPolicy && source.stateCode === "OH" && source.format === "franklin-pdf") return true;
	if (!source.retrievalPolicy && source.stateCode === "ID" && source.format === "cassia-pdf") return true;
	if (!source.retrievalPolicy && source.stateCode === "MN" && source.format === "independence-html") return true;
	if (!source.retrievalPolicy && source.stateCode === "IA" && ["iowa-county-pdf", "iowa-polk-pdf", "iowa-johnson-html"].includes(source.format)) return true;
	if (!source.retrievalPolicy && source.stateCode === "CO" && source.format === "boulder-html") return true;
	if (!source.retrievalPolicy && source.stateCode === "PA" && source.format === "bucks-pdf") return true;
	if (!source.retrievalPolicy && source.stateCode === "NV" && source.format === "washoe-html") return true;
	if (!source.retrievalPolicy && source.stateCode === "NV" && source.format === "clark-pdf") return true;
	if (!source.retrievalPolicy && source.stateCode === "VT" && source.format === "vermont-xlsx" && source.id !== "vt-sos-2026") return true;
	if (!source.retrievalPolicy && source.stateCode === "VA" && ["virginia-html", "virginia-local-html"].includes(source.format) && !source.id.startsWith("va-elect-2026-")) return true;
	if (!source.retrievalPolicy && source.stateCode === "KS" && source.format === "kansas-html" && source.id !== "ks-johnson-2026") return true;
	return !source.retrievalPolicy && ((source.stateCode === "FL" && source.format === "florida-local-tsv") || (source.stateCode === "MD" && ["csv", "maryland-local-csv"].includes(source.format)) || (source.stateCode === "KY" && ["kentucky-html", "kentucky-courts-html"].includes(source.format)) || (source.stateCode === "UT" && source.format === "utah-html" && source.id !== "ut-lg-2026") || (source.stateCode === "MI" && source.format === "michigan-html" && source.id !== "mi-dos-2026"));
}

export function stateBallotSourceIsCurrent(source: Pick<StateBallotSource, "electionDate">, now = Date.now()) {
	return Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 86400000 > now;
}

export function orderStateBallotSources(sources: readonly StateBallotSource[], now = Date.now()) {
	const expired = (source: StateBallotSource) => !stateBallotSourceIsCurrent(source, now);
	return [...sources].sort((first, second) => Number(expired(first)) - Number(expired(second)) || first.electionDate.localeCompare(second.electionDate) || (second.defaultPriority ?? 0) - (first.defaultPriority ?? 0));
}
