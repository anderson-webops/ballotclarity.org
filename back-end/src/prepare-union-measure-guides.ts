import process from "node:process";
import { prepareUnionMeasureGuideFiles } from "./union-measure-guides.js";

const [plan, ...extra] = process.argv.slice(2);
if (!plan || extra.length) {
	console.error("Use prepare-union-measure-guides PLAN.json.");
	process.exitCode = 1;
}
else {
	prepareUnionMeasureGuideFiles(plan).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "Union measure preparation failed.");
		process.exitCode = 1;
	});
}
