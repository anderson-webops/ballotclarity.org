import process from "node:process";
import { prepareLafayetteMeasureGuideFiles } from "./lafayette-measure-guides.js";

const [path, ...extra] = process.argv.slice(2);
Promise.resolve().then(() => {
	if (!path || extra.length) throw new Error("Use prepare-lafayette-measure-guides PLAN.json.");
	return prepareLafayetteMeasureGuideFiles(path);
}).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Lafayette measure-guide preparation failed.");
	process.exitCode = 1;
});
