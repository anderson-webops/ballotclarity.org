import process from "node:process";
import { collectMauiCharterMeasures, readLatestMauiCharterCapture } from "./maui-charter-collection.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const args = process.argv.slice(2);
	const command = args.length === 1 ? "collect" : args[0];
	const paths = args.length === 1 ? args : args.slice(1);
	if (paths.length !== 1 || !["collect", "status", "inventory"].includes(command ?? "")) throw new Error("Use collect-maui-charter-measures [collect|status|inventory] PLAN.json.");
	const plan = JSON.parse(await readBoundedStateData(paths[0]!));
	if (!plan || Object.keys(plan).sort().join(",") !== "accessReview,outputDirectory,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "maui-charter-collection" || typeof plan.outputDirectory !== "string" || !plan.accessReview || Object.keys(plan.accessReview).sort().join(",") !== "reviewedAt,robotsSha256" || typeof plan.accessReview.reviewedAt !== "string" || !/^[a-f\d]{64}$/u.test(plan.accessReview.robotsSha256)) throw new Error("Provide an external output directory and an exact Maui access review.");
	if (command === "collect") {
		console.log(JSON.stringify(await collectMauiCharterMeasures({ directory: plan.outputDirectory, accessReview: plan.accessReview })));
	}
	else {
		const result = await readLatestMauiCharterCapture(plan.outputDirectory);
		console.log(JSON.stringify(command === "inventory" ? result.inventory : { run: result.run, electionDate: result.inventory?.electionDate ?? null, questions: result.inventory?.questions.length ?? null, publicationApproved: false, automaticImportApproved: false, imported: false }));
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Maui county measure collection failed.");
	process.exitCode = 1;
});
