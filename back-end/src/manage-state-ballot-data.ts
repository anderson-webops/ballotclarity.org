import process from "node:process";
import { legacyReviewedStateBallotSource } from "./state-ballot-registry.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "./state-ballot-repository.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { createStateBallotStorage, readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const configuration = resolveStateBallotConfiguration();
	if (!configuration.dataDirectory)
		throw new Error("STATE_BALLOT_DATA_DIR is required for persistent candidate data.");
	const [command, ...requested] = process.argv.slice(2);
	const storage = createStateBallotStorage(configuration.dataDirectory);
	if (command === "import") {
		if (!requested.length)
			throw new Error("Provide at least one reviewed snapshot file.");
		for (const path of requested) {
			const body = await readBoundedStateData(path);
			const metadata = JSON.parse(body);
			const enabled = configuration.sources.find(item => item.id === metadata.sourceId);
			const source = enabled?.retrievalPolicy === "manual-snapshot" ? enabled : enabled ? legacyReviewedStateBallotSource(enabled) : null;
			if (!source)
				throw new Error("Every imported snapshot must match an enabled reviewed source.");
			const snapshot = parseBundledStateSnapshot(source, body);
			if (Date.parse(snapshot.retrievedAt) > Date.now())
				throw new Error("A reviewed snapshot cannot have a future capture time.");
			await storage.write(snapshot);
			console.log(JSON.stringify({ state: source.stateCode, sourceId: source.id, action: "imported", records: snapshot.records.length, retrievedAt: snapshot.retrievedAt }));
		}
		return;
	}
	if (command !== "refresh")
		throw new Error("Use refresh [STATE ...] or import SNAPSHOT.json [...].");
	const states = requested.map(state => state.toUpperCase());
	if (states.some(state => !configuration.sources.some(source => source.stateCode === state && source.retrievalPolicy !== "manual-snapshot")))
		throw new Error("Refresh accepts enabled automatic sources only; reviewed sources require import.");
	const sources = configuration.sources.filter(source => source.retrievalPolicy !== "manual-snapshot" && (!states.length || states.includes(source.stateCode)));
	const repository = createStateBallotRepository({
		refreshReviewedLegacy: true,
		onPersistenceError() {
			process.exitCode = 1;
		},
	});
	for (const source of sources) {
		const snapshot = await repository.getSnapshot(source.stateCode, source.id);
		console.log(JSON.stringify({ state: source.stateCode, sourceId: source.id, action: snapshot ? "available" : "unavailable", records: snapshot?.records.length ?? 0, retrievedAt: snapshot?.retrievedAt ?? null }));
		if (!snapshot || (await repository.inspectSources!()).find(item => item.id === source.id)?.failure) process.exitCode = 1;
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "State ballot data management failed.");
	process.exitCode = 1;
});
