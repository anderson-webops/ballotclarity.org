import process from "node:process";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { inspectUnionBallotAutomation, runUnionBallotAutomation } from "./union-ballot-automation.js";
import { enrollUnionBallotImport, syncUnionBallotImport } from "./union-ballot-import.js";
import { prepareUnionAutomatedMeasureGuides } from "./union-measure-automation.js";

async function main() {
	const [command, plan, pins, ...extra] = process.argv.slice(2);
	if (command === "guides") {
		if (!plan || !pins || extra.length) throw new Error("Use manage-union-ballot-automation guides PROFILE.json GUIDE-POLICY.json.");
		console.log(JSON.stringify(await prepareUnionAutomatedMeasureGuides(plan, pins)));
		return;
	}
	if (command === "enroll" || command === "sync") {
		if (!plan || !pins || extra.length) throw new Error("Use manage-union-ballot-automation enroll|sync PROFILE.json IMPORT-POLICY.json.");
		console.log(JSON.stringify(command === "enroll" ? await enrollUnionBallotImport(plan, pins) : await syncUnionBallotImport(plan, pins)));
		return;
	}
	if (!plan || extra.length || !["run", "inspect", "prepare"].includes(command ?? "") || (command === "prepare" ? !pins : Boolean(pins))) throw new Error("Use manage-union-ballot-automation run|inspect PLAN.json or prepare PLAN.json CAPTURE-PINS.json.");
	const result = command === "inspect" ? await inspectUnionBallotAutomation(plan) : await runUnionBallotAutomation(plan, command === "prepare" ? { captures: JSON.parse((await readBoundedStateDataBytes(pins!, 32768)).toString("utf8")) } : {});
	console.log(JSON.stringify(result));
}
main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Union ballot automation failed.");
	process.exitCode = 1;
});
