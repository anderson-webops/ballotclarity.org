import process from "node:process";
import { electionReferenceSources } from "./election-reference-sources.js";
import { createElectionReferenceStorage, parseElectionReferenceSnapshot } from "./election-references.js";
import { collectOpenStatesFile } from "./openstates-collection.js";
import { collectOpenStatesProfilesFile } from "./openstates-profile-collection.js";
import { prepareCongressionalBiographyFiles } from "./prepare-congressional-biographies.js";
import { prepareOpenStatesProfileFiles } from "./prepare-openstates-profiles.js";
import { prepareOpenStatesReferenceFiles } from "./prepare-openstates-references.js";
import { prepareWashingtonStatementFiles } from "./prepare-washington-statements.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const [command, ...requested] = process.argv.slice(2);
	if (command === "collect-openstates-profiles") {
		if (requested.length !== 1) throw new Error("Use collect-openstates-profiles PLAN.json. Collection prepares external files but does not import them.");
		const result = await collectOpenStatesProfilesFile(requested[0]!);
		console.log(JSON.stringify(result));
		if (!result.complete) process.exitCode = 1;
		return;
	}
	if (command === "enrich-openstates") {
		if (requested.length !== 1) throw new Error("Use enrich-openstates PLAN.json. Enrichment does not import or download data.");
		console.log(JSON.stringify(await prepareOpenStatesProfileFiles(requested[0]!)));
		return;
	}
	if (command === "collect-openstates") {
		if (requested.length !== 1) throw new Error("Use collect-openstates PLAN.json. Collection prepares external files but does not import them.");
		console.log(JSON.stringify(await collectOpenStatesFile(requested[0]!)));
		return;
	}
	if (command === "prepare-openstates") {
		if (requested.length !== 1) throw new Error("Use prepare-openstates PLAN.json. Preparation does not import or download data.");
		console.log(JSON.stringify(await prepareOpenStatesReferenceFiles(requested[0]!)));
		return;
	}
	if (command === "prepare-washington") {
		if (requested.length !== 1) throw new Error("Use prepare-washington PLAN.json. Preparation does not import or download data.");
		console.log(JSON.stringify(await prepareWashingtonStatementFiles(requested[0]!)));
		return;
	}
	if (command === "prepare-congressional") {
		if (requested.length !== 1) throw new Error("Use prepare-congressional PLAN.json. Preparation does not import or download data.");
		console.log(JSON.stringify(await prepareCongressionalBiographyFiles(requested[0]!)));
		return;
	}
	const directory = process.env.STATE_BALLOT_DATA_DIR;
	if (!directory) throw new Error("STATE_BALLOT_DATA_DIR is required for persistent election references.");
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
			console.log(JSON.stringify({ state: source.stateCode, sourceId: source.id, action: "imported", references: snapshot.recordCount, retrievedAt: snapshot.retrievedAt }));
		}
		return;
	}
	if (command !== "export" || ![1, 3].includes(requested.length) || (requested.length === 3 && requested[1] !== "--source")) throw new Error("Use import SNAPSHOT.json [...] or export STATE [--source SOURCE_ID]. Automatic refresh is not supported.");
	const matching = electionReferenceSources.filter(item => item.stateCode === requested[0]!.toUpperCase() && (requested.length === 1 || item.id === requested[2]));
	if (matching.length > 1) throw new Error("More than one reference collection is configured; provide --source SOURCE_ID.");
	const source = matching[0];
	if (!source) throw new Error("The requested reference collection is not configured.");
	const snapshot = await storage.read(source);
	if (!snapshot) throw new Error("The reviewed reference collection has not been imported.");
	console.log(JSON.stringify(snapshot));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Election reference management failed.");
	process.exitCode = 1;
});
