import process from "node:process";
import { collectMagistrateCourt } from "./collect-magistrate-court.js";
import { magistrateCourtPublication, prepareMagistrateCourtDirectory } from "./magistrate-court-directory.js";
import { importMagistrateCourt, readMagistrateCourtEnvelope } from "./magistrate-court-storage.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const [command, directory, file, ...extra] = process.argv.slice(2);
	if (command === "prepare" && directory && file === undefined && !extra.length) {
		const capture = JSON.parse((await readBoundedStateDataBytes(directory, magistrateCourtPublication.maximumCaptureBytes)).toString("utf8"));
		console.log(JSON.stringify(prepareMagistrateCourtDirectory(capture), null, 2));
		return;
	}
	if (!directory || extra.length || (command === "import" ? !file : file !== undefined) || !["collect", "import", "export"].includes(command ?? "")) throw new Error("Use collect DIRECTORY, import DIRECTORY SNAPSHOT.json, or export DIRECTORY.");
	if (command === "collect") {
		console.log(JSON.stringify(await collectMagistrateCourt({ directory })));
	}
	else if (command === "import") {
		const value = JSON.parse((await readBoundedStateDataBytes(file!, magistrateCourtPublication.maximumCaptureBytes)).toString("utf8"));
		console.log(JSON.stringify(await importMagistrateCourt(directory, value)));
	}
	else {
		console.log(JSON.stringify((await readMagistrateCourtEnvelope(directory)).envelope.snapshot, null, 2));
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : "Magistrate Court management failed.");
	process.exitCode = 1;
});
