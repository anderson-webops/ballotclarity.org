import process from "node:process";
import { prepareMarylandQuestionReview } from "./maryland-question-review.js";

async function main() {
	const [planPath, ...extra] = process.argv.slice(2);
	if (!planPath || extra.length) throw new Error("Provide one Maryland question review plan. Preparation never fetches, imports or publishes data.");
	console.log(JSON.stringify(await prepareMarylandQuestionReview(planPath)));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Maryland question review preparation failed.");
	process.exitCode = 1;
});
