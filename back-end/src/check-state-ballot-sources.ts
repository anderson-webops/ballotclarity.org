import process from "node:process";
import { parseArgs } from "node:util";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "./state-ballot-repository.js";

async function main() {
	const { positionals, values } = parseArgs({ options: { source: { type: "string", multiple: true } }, allowPositionals: true });
	const requestedStates = positionals.map(value => value.toUpperCase());
	const configuration = resolveStateBallotConfiguration();
	if (values.source?.some(id => !configuration.sources.some(source => source.id === id && (!requestedStates.length || requestedStates.includes(source.stateCode)))))
		throw new Error("Every requested source must match an enabled state and source.");
	const sources = configuration.sources.filter(source => (!requestedStates.length || requestedStates.includes(source.stateCode)) && (!values.source || values.source.includes(source.id)));
	const unknownStates = requestedStates.filter(state => !sources.some(source => source.stateCode === state));
	if (unknownStates.length) throw new Error(`No configured candidate source for: ${unknownStates.join(", ")}`);
	const repository = createStateBallotRepository({
		onUnavailable: (state, reason) => console.error(JSON.stringify({ state, reason })),
	});
	let failed = 0;
	for (const source of sources) {
		const snapshot = await repository.getSnapshot(source.stateCode, source.id);
		if (!snapshot) failed += 1;
		console.log(JSON.stringify({
			state: source.stateCode,
			sourceId: source.id,
			sourceUrl: source.pageUrl,
			retrievalPolicy: source.retrievalPolicy ?? "automatic",
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
