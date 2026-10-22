import process from "node:process";
import { electionReferenceSources } from "./election-reference-sources.js";
import { createElectionReferenceStorage, parseElectionReferenceSnapshot } from "./election-references.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const directory = process.env.STATE_BALLOT_DATA_DIR;
	if (!directory) throw new Error("STATE_BALLOT_DATA_DIR is required for persistent election references.");
	const [command, ...requested] = process.argv.slice(2);
	const storage = createElectionReferenceStorage(directory);
	if (command === "import") {
		if (!requested.length) throw new Error("Provide at least one reviewed reference snapshot.");
		for (const path of requested) {
			const body = await readBoundedStateData(path);
			const metadata = JSON.parse(body);
			const source = electionReferenceSources.find(item => item.id === metadata?.sourceId);
			if (!source) throw new Error("Each reference import must match a configured reviewed collection.");
			const snapshot = parseElectionReferenceSnapshot(source, body);
			await storage.write(source, snapshot);
			console.log(JSON.stringify({ state: source.stateCode, action: "imported", references: snapshot.recordCount, retrievedAt: snapshot.retrievedAt }));
		}
		return;
	}
	if (command !== "export" || requested.length !== 1) throw new Error("Use import SNAPSHOT.json [...] or export STATE. Automatic refresh is not supported.");
	const source = electionReferenceSources.find(item => item.stateCode === requested[0]!.toUpperCase());
	if (!source) throw new Error("The requested reference collection is not configured.");
	const snapshot = await storage.read(source);
	if (!snapshot) throw new Error("The reviewed reference collection has not been imported.");
	console.log(JSON.stringify(snapshot));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Election reference management failed.");
	process.exitCode = 1;
});
