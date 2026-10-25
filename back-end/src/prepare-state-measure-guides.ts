import process from "node:process";
import { prepareStateMeasureGuideFiles } from "./state-measure-guides.js";

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length !== 1) throw new Error("Use prepare-state-measure-guides PLAN.json. Preparation never fetches, imports or publishes data.");
	console.log(JSON.stringify(await prepareStateMeasureGuideFiles(paths[0]!)));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "State-measure guide preparation failed.");
	process.exitCode = 1;
});
