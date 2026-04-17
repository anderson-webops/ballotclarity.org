import process from "node:process";
import { buildSeedCoverageSnapshot, writeCoverageSnapshot } from "./coverage-repository.js";

function readFlag(flag: string) {
	const index = process.argv.indexOf(flag);

	if (index === -1)
		return undefined;

	return process.argv[index + 1];
}

try {
	const outputPath = writeCoverageSnapshot(
		buildSeedCoverageSnapshot(),
		readFlag("--output") || process.env.LIVE_COVERAGE_FILE || undefined
	);
	console.log(`Wrote local seed coverage snapshot to ${outputPath}.`);
}
catch (error) {
	console.error(error instanceof Error ? error.message : "Unable to write local seed coverage snapshot.");
	process.exit(1);
}
