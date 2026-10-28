import { Buffer } from "node:buffer";
import process from "node:process";
import { collectFultonOfficeholders } from "./collect-fulton-officeholders.js";
import { importFultonOfficeholders, readFultonOfficeholderEnvelope } from "./fulton-officeholder-storage.js";
import { fultonOfficeholderCsv } from "./fulton-officeholders.js";
import { readBoundedStateData } from "./state-ballot-storage.js";

async function main() {
	const [command, directory, file, ...extra] = process.argv.slice(2);
	if (!directory || extra.length || (command === "import" ? !file : file !== undefined) || !["collect", "import", "export", "csv"].includes(command ?? "")) throw new Error("Use collect DIRECTORY, import DIRECTORY SNAPSHOT.json, export DIRECTORY, or csv DIRECTORY.");
	if (command === "collect") {
		console.log(JSON.stringify(await collectFultonOfficeholders({ directory })));
	}
	else if (command === "import") {
		const body = await readBoundedStateData(file!);
		if (Buffer.byteLength(body) > 128 * 1024) throw new Error("The Fulton officeholder import exceeds its bounds.");
		const imported = await importFultonOfficeholders(directory, JSON.parse(body));
		console.log(JSON.stringify({ imported: true, retrievedAt: imported.snapshot.retrievedAt }));
	}
	else {
		const snapshot = readFultonOfficeholderEnvelope(directory).snapshot;
		process.stdout.write(command === "csv" ? fultonOfficeholderCsv(snapshot) : `${JSON.stringify(snapshot, null, 2)}\n`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "The Fulton officeholder operation failed.");
	process.exitCode = 1;
});
