import process from "node:process";
import { fetchMauiCharterCapture, writeMauiCharterCapture } from "./maui-charter-measures.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length !== 1) throw new Error("Use collect-maui-charter-measures PLAN.json.");
	const plan = JSON.parse(await readBoundedStateData(paths[0]!));
	if (!plan || Object.keys(plan).sort().join(",") !== "accessReview,outputDirectory,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "maui-charter-collection" || typeof plan.outputDirectory !== "string" || !plan.accessReview || Object.keys(plan.accessReview).sort().join(",") !== "reviewedAt,robotsSha256" || typeof plan.accessReview.reviewedAt !== "string" || !/^[a-f\d]{64}$/u.test(plan.accessReview.robotsSha256)) throw new Error("Provide an external output directory and an exact Maui access review.");
	console.log(JSON.stringify(await writeMauiCharterCapture(plan.outputDirectory, await fetchMauiCharterCapture({ accessReview: plan.accessReview }))));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Maui county measure collection failed.");
	process.exitCode = 1;
});
