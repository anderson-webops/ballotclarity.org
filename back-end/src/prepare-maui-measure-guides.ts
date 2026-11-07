import process from "node:process";
import { prepareMauiMeasureGuideFiles } from "./maui-measure-guides.js";

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length !== 1) throw new Error("Use prepare-maui-measure-guides PLAN.json. Preparation uses pinned local evidence and retains publication review.");
	console.log(JSON.stringify(await prepareMauiMeasureGuideFiles(paths[0]!)));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Maui native measure preparation failed.");
	process.exitCode = 1;
});
