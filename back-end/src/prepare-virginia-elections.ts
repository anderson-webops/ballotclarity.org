import process from "node:process";
import { prepareVirginiaElectionReview } from "./virginia-election-review.js";

async function main() {
	const [planPath, ...extra] = process.argv.slice(2);
	if (!planPath || extra.length) throw new Error("Provide one Virginia election review plan. Preparation never fetches, imports or publishes data.");
	console.log(JSON.stringify(await prepareVirginiaElectionReview(planPath)));
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Virginia election review preparation failed.");
	process.exitCode = 1;
});
