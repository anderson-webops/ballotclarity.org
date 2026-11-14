import process from "node:process";
import { collectLafayetteGuideResearch } from "./lafayette-guide-collection.js";

const [planPath, ...extra] = process.argv.slice(2);
if (!planPath || extra.length) {
	console.error("Use collect-lafayette-guide-research PLAN.json.");
	process.exitCode = 1;
}
else {
	collectLafayetteGuideResearch(planPath).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "Lafayette guide collection failed.");
		process.exitCode = 1;
	});
}
