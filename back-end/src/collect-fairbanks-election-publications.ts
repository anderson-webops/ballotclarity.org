import { createHash } from "node:crypto";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fetchFairbanksElectionPublications, readFairbanksPublicationCapture, writeFairbanksElectionPublications } from "./fairbanks-election-publications.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const paths = process.argv.slice(2);
	if (paths.length !== 1) throw new Error("Use collect-fairbanks-election-publications PLAN.json.");
	const plan = JSON.parse((await readBoundedStateDataBytes(paths[0]!, 128 * 1024)).toString("utf8"));
	if (!plan || Object.keys(plan).sort().join(",") !== "accessReview,outputDirectory,previousCapture,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "fairbanks-election-publication-collection" || typeof plan.outputDirectory !== "string") throw new Error("Provide a reviewed Fairbanks publication collection plan.");
	let previous;
	if (plan.previousCapture !== null) {
		const pin = plan.previousCapture;
		if (!pin || Object.keys(pin).sort().join(",") !== "path,sha256" || typeof pin.path !== "string" || !/^[a-f\d]{64}$/u.test(pin.sha256)) throw new Error("Provide an exact previous Fairbanks capture pin.");
		const body = await readBoundedStateDataBytes(pin.path);
		if (createHash("sha256").update(body).digest("hex") !== pin.sha256) throw new Error("The previous Fairbanks bundle changed.");
		const bundle = JSON.parse(body.toString("utf8"));
		if (!isDeepStrictEqual(readFairbanksPublicationCapture(bundle.capture), bundle.inventory)) throw new Error("The previous Fairbanks inventory changed.");
		previous = bundle.capture;
	}
	const capture = await fetchFairbanksElectionPublications({ accessReview: plan.accessReview, previous });
	console.log(JSON.stringify(await writeFairbanksElectionPublications(plan.outputDirectory, capture)));
}
main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Fairbanks publication collection failed.");
	process.exitCode = 1;
});
