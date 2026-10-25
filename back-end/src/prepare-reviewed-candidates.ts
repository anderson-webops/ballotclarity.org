import process from "node:process";
import { prepareReviewedCandidateFiles } from "./reviewed-candidate-preparation.js";

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length !== 1) throw new Error("Use prepare-reviewed-candidates PLAN.json. Preparation never fetches, imports or publishes data.");
	console.log(JSON.stringify(await prepareReviewedCandidateFiles(paths[0]!)));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Candidate preparation failed.");
	process.exitCode = 1;
});
