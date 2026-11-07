import process from "node:process";
import { prepareFairbanksCandidateFiles } from "./fairbanks-candidate-preparation.js";

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length !== 1) throw new Error("Use prepare-fairbanks-ballot-candidates PLAN.json.");
	console.log(JSON.stringify(await prepareFairbanksCandidateFiles(paths[0]!)));
}
main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Fairbanks native candidate preparation failed.");
	process.exitCode = 1;
});
