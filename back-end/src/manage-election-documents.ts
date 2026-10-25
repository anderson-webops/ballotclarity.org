import process from "node:process";
import { collectElectionDocuments, electionDocumentConfigurationSha256, seedElectionDocuments } from "./election-document-collection.js";
import { electionDocumentSources } from "./election-document-sources.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const [command, ...paths] = process.argv.slice(2);
	if (command === "catalog" && !paths.length) {
		console.log(JSON.stringify(electionDocumentSources.map(source => ({ ...source, configurationSha256: electionDocumentConfigurationSha256(source) }))));
		return;
	}
	if ((command !== "collect" || paths.length !== 1) && (command !== "seed" || paths.length !== 2)) throw new Error("Use catalog, collect PLAN.json, or seed PLAN.json CAPTURES.json. Documents are never imported or published.");
	const plan = JSON.parse(await readBoundedStateData(paths[0]!));
	if (command === "seed") {
		console.log(JSON.stringify(await seedElectionDocuments(plan, JSON.parse(await readBoundedStateData(paths[1]!)))));
		return;
	}
	const result = await collectElectionDocuments(plan);
	console.log(JSON.stringify(result));
	if (!result.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Election document collection failed.");
	process.exitCode = 1;
});
