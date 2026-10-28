import process from "node:process";
import { collectCourtDirectory } from "./collect-court-directory.js";
import { importCourtDirectory, readCourtDirectoryEnvelope } from "./court-directory-storage.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

async function main() {
	const [command, directory, file, ...extra] = process.argv.slice(2);
	if (!directory || extra.length || (command === "import" ? !file : file !== undefined) || !["collect", "import", "export"].includes(command ?? "")) throw new Error("Use collect DIRECTORY, import DIRECTORY SNAPSHOT.json, or export DIRECTORY.");
	if (command === "collect") {
		console.log(JSON.stringify(await collectCourtDirectory({ directory })));
	}
	else if (command === "import") {
		const value = JSON.parse((await readBoundedStateDataBytes(file!, 128 * 1024)).toString("utf8"));
		const imported = await importCourtDirectory(directory, value);
		console.log(JSON.stringify({ imported: true, retrievedAt: imported.snapshot.retrievedAt }));
	}
	else {
		process.stdout.write(`${JSON.stringify((await readCourtDirectoryEnvelope(directory)).envelope.snapshot, null, 2)}\n`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "The court directory operation failed.");
	process.exitCode = 1;
});
