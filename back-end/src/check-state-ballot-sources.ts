import process from "node:process";
import { createStateBallotRepository } from "./state-ballot-repository.js";
import { stateBallotSources } from "./state-ballot-sources.js";

async function main() {
	const requestedStates = process.argv.slice(2).map(value => value.toUpperCase());
	const sources = requestedStates.length ? stateBallotSources.filter(source => requestedStates.includes(source.stateCode)) : stateBallotSources;
	const unknownStates = requestedStates.filter(state => !sources.some(source => source.stateCode === state));
	if (unknownStates.length) throw new Error(`No configured candidate source for: ${unknownStates.join(", ")}`);
	const repository = createStateBallotRepository({
		onUnavailable: (state, reason) => console.error(JSON.stringify({ state, reason })),
	});
	let failed = 0;
	for (const source of sources) {
		const snapshot = await repository.getSnapshot(source.stateCode);
		if (!snapshot) failed += 1;
		console.log(JSON.stringify({
			state: source.stateCode,
			sourceUrl: source.pageUrl,
			electionDate: source.electionDate,
			status: snapshot ? "available" : "unavailable",
			retrievedAt: snapshot?.retrievedAt,
			sha256: snapshot?.sha256,
			records: snapshot?.records.length,
			statuses: snapshot ? Object.fromEntries([...new Set(snapshot.records.map(record => record.status))].map(status => [status, snapshot.records.filter(record => record.status === status).length])) : undefined,
		}));
	}
	process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "State source verification failed.");
	process.exitCode = 1;
});
