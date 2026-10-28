import type { StateBallotSource } from "./state-ballot-sources.js";
import type { JurisdictionSummary } from "./types/civic.js";
import { getStateAbbreviationForName } from "./official-election-tools.js";
import { orderStateBallotSources } from "./state-ballot-source-state.js";

export function electionRecordSource(date: string, jurisdiction: Pick<JurisdictionSummary, "name" | "state" | "jurisdictionType"> | null | undefined, sources: readonly StateBallotSource[]) {
	if (!jurisdiction) return undefined;
	const stateCode = /^[A-Z]{2}$/u.test(jurisdiction.state) ? jurisdiction.state : getStateAbbreviationForName(jurisdiction.state);
	const name = jurisdiction.name.normalize("NFKC").trim().toLowerCase();
	const kind = jurisdiction.jurisdictionType.toLowerCase();
	const matches = sources.filter((source) => {
		if (source.stateCode !== stateCode || source.electionDate !== date || source.ballotPreview === false) return false;
		const countyName = source.countyName ?? (source.stateCode === "GA" && /^ga-fulton-(?:\d{4}|(?:general|primary|special)-\d{4}-\d{2}-\d{2})$/u.test(source.id) ? "Fulton County" : undefined);
		if (kind === "county") return countyName?.normalize("NFKC").trim().toLowerCase() === name && !source.placeName;
		if (kind === "city") return source.placeName?.normalize("NFKC").trim().toLowerCase() === name;
		return false;
	});
	const source = orderStateBallotSources(matches)[0];
	return source ? { stateCode: source.stateCode, sourceId: source.id } : undefined;
}
