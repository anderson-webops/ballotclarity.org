import process from "node:process";
import { syncStateBallotCycleFamilies } from "./state-ballot-cycle-sync.js";
import { getStateBallotCycleFamily, stateBallotCycleCatalogLocations } from "./state-ballot-cycles.js";
import { resolveStateBallotConfiguration } from "./state-ballot-repository.js";

async function main() {
	if (process.argv.length !== 2) throw new Error("Election-cycle synchronization accepts configuration through the environment only.");
	const configuration = resolveStateBallotConfiguration();
	const locations = stateBallotCycleCatalogLocations();
	const dataDirectory = configuration.dataDirectory;
	if (!locations.length || !dataDirectory) throw new Error("An election cycle catalog and STATE_BALLOT_DATA_DIR are required.");
	for (const { familyId } of locations) {
		const family = getStateBallotCycleFamily(familyId);
		if (!configuration.sources.some(source => source.id === family.source.id || (source.stateCode === family.source.stateCode && source.format === family.format && source.id.startsWith(`${family.prefix}-`))))
			throw new Error(`Enable the supported ${family.source.stateCode} source family for election-cycle synchronization.`);
	}
	const enabledFamilies = process.env.STATE_BALLOT_ENABLED_FAMILIES?.split(",").map(value => value.trim());
	const results = await syncStateBallotCycleFamilies(locations.map(location => ({ ...location, dataDirectory, enabledSourceIds: enabledFamilies?.includes(location.familyId) ? undefined : process.env.STATE_BALLOT_ENABLED_SOURCES?.split(",").map(value => value.trim()) })));
	console.log(JSON.stringify(results.length === 1 && results[0]?.status === "completed" ? results[0] : { families: results }));
	if (results.some(result => result.status === "failed" || result.results.some(item => item.status === "unavailable" || item.status === "persistence-failed"))) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Election-cycle synchronization failed.");
	process.exitCode = 1;
});
