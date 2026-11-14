import process from "node:process";
import { readMauiPreparationRun } from "./maui-measure-automation-storage.js";
import { readMauiMeasureAutomationPlan, runMauiMeasureAutomation } from "./maui-measure-automation.js";

async function main() {
	const [command, path, ...extra] = process.argv.slice(2);
	if (!path || extra.length || !["run", "prepare", "status"].includes(command ?? "")) throw new Error("Use manage-maui-measures run|prepare|status PLAN.json.");
	if (command === "status") {
		const plan = await readMauiMeasureAutomationPlan(path);
		console.log(JSON.stringify(await readMauiPreparationRun(plan.preparationDirectory)));
	}
	else {
		console.log(JSON.stringify(await runMauiMeasureAutomation(path, { collect: command === "run" })));
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Maui measure automation failed.");
	process.exitCode = 1;
});
