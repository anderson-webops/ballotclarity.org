import process from "node:process";
import { createCongressClient } from "./congress.js";
import { buildLaunchDirectorySnapshot, writeLaunchDirectorySnapshot } from "./launch-directory.js";
import { createOpenStatesClient } from "./openstates.js";

async function main() {
	try {
		const snapshot = await buildLaunchDirectorySnapshot({
			congressClient: createCongressClient(),
			openStatesClient: createOpenStatesClient()
		});
		const outputPath = writeLaunchDirectorySnapshot(snapshot);

		console.log(`Wrote launch directory snapshot to ${outputPath}.`);
		process.exit(0);
	}
	catch (error) {
		console.error(error instanceof Error ? error.message : "Unable to sync launch directory snapshot.");
		process.exit(1);
	}
}

void main();
