import type { Election } from "./types/civic.js";

export function reviewedElectionDates<ElectionRecord extends Election>(election: ElectionRecord): ElectionRecord {
	if (election.slug !== "2026-fulton-county-general" || election.date !== "2026-11-03") return election;
	return {
		...election,
		timeZone: "America/New_York",
		keyDates: election.keyDates.map(entry => entry.label === "Election Day polls close"
			&& entry.date === "2026-11-03T19:00:00.000Z"
			&& entry.note === "Polls close at 7:00 p.m. local time on Election Day."
			? { ...entry, date: "2026-11-04T00:00:00.000Z" }
			: entry),
	};
}
